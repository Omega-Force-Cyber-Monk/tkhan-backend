import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { renderNotificationTemplate } from '../notifications/notification-templates';
import { PayoutsService } from '../payouts/payouts.service';

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: any;
  private pendingRefundTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly payouts: PayoutsService,
  ) {
    this.stripe = new Stripe(
      this.config.getOrThrow<string>('STRIPE_SECRET_KEY'),
    );
  }

  onModuleInit() {
    const intervalMinutes = Number(
      this.config.get('PENDING_BOOKING_REFUND_CHECK_MINUTES') ?? 60,
    );
    const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;
    this.pendingRefundTimer = setInterval(() => {
      void this.refundExpiredPendingBookings();
    }, intervalMs);
    this.pendingRefundTimer.unref?.();
    void this.refundExpiredPendingBookings();
  }

  onModuleDestroy() {
    if (this.pendingRefundTimer) clearInterval(this.pendingRefundTimer);
  }

  async createPaymentIntent(bookingId: string, buyerId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Selected booking was not found');
    if (booking.buyerId !== buyerId) {
      throw new BadRequestException(
        'You can only create a payment intent for your own booking',
      );
    }
    if (!['PENDING', 'PAYMENT_PENDING'].includes(booking.status)) {
      throw new BadRequestException(
        `Payment intent can only be created while the booking is waiting for payment. Current booking status: ${booking.status}`,
      );
    }
    const amountInCents = Math.round(Number(booking.totalAmount) * 100);
    if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
      throw new InternalServerErrorException(
        'Booking total amount is invalid for payment processing',
      );
    }
    const payment =
      (await this.prisma.payment.findFirst({
        where: {
          bookingId,
          status: {
            in: ['PAYMENT_PENDING', 'PENDING', 'FAILED', 'REQUIRES_ACTION'],
          },
        },
        orderBy: { createdAt: 'desc' },
      })) ??
      (await this.prisma.payment.create({
        data: {
          bookingId,
          amount: booking.totalAmount,
          currency: this.config.get('STRIPE_CURRENCY') ?? 'usd',
          status: 'PAYMENT_PENDING',
        },
      }));

    let intent: any;
    if (payment.stripePaymentIntentId) {
      try {
        const existingIntent = await this.stripe.paymentIntents.retrieve(
          payment.stripePaymentIntentId,
        );
        if (
          existingIntent.status !== 'canceled' &&
          existingIntent.client_secret
        ) {
          return {
            paymentId: payment.id,
            paymentIntentId: existingIntent.id,
            clientSecret: existingIntent.client_secret,
            amount: payment.amount,
            currency: payment.currency,
          };
        }
      } catch (error) {
        if (this.isStripeMissingResourceError(error)) {
          this.logger.warn(
            `Stored Stripe PaymentIntent ${payment.stripePaymentIntentId} for booking ${bookingId} no longer exists. Creating a fresh intent.`,
          );
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { stripePaymentIntentId: null },
          });
        } else {
          throw this.wrapStripeError(
            'retrieve existing payment intent',
            error,
          );
        }
      }
    }

    try {
      intent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: payment.currency,
        automatic_payment_methods: { enabled: true },
        metadata: {
          bookingId,
          paymentId: payment.id,
        },
      });
    } catch (error) {
      throw this.wrapStripeError('create payment intent', error);
    }
    if (!intent.client_secret) {
      throw new InternalServerErrorException(
        'Stripe did not return a client secret for the payment intent',
      );
    }
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { stripePaymentIntentId: intent.id },
    });
    return {
      paymentId: payment.id,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amount: payment.amount,
      currency: payment.currency,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET'),
      );
    } catch (error) {
      throw new BadRequestException('Invalid Stripe signature');
    }
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      await this.markPaymentSucceeded(
        String(intent.metadata?.paymentId),
        String(intent.id),
        intent.latest_charge ? String(intent.latest_charge) : null,
      );
    }
    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object;
      const payment = await this.prisma.payment.findFirst({
        where: { stripePaymentIntentId: intent.id },
        include: { booking: true },
      });
      if (payment) {
        await this.markPaymentFailed(
          payment,
          intent.last_payment_error?.message,
        );
      } else {
        await this.prisma.payment.updateMany({
          where: { stripePaymentIntentId: intent.id },
          data: {
            status: 'FAILED',
            failureReason: intent.last_payment_error?.message,
          },
        });
      }
    }
    if (event.type === 'account.updated') {
      await this.payouts.handleConnectedAccountUpdated(event.data.object);
    }
    return { received: true };
  }
  async confirmBookingPayment(bookingId: string, buyerId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Selected booking was not found');
    if (booking.buyerId !== buyerId) {
      throw new BadRequestException(
        'You can only confirm payment for your own booking',
      );
    }
    return this.syncPaymentStatusForBooking(bookingId);
  }

  async syncPaymentStatusForBooking(bookingId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      throw new NotFoundException(
        'No payment record was found for this booking',
      );
    }
    if (payment.status === 'SUCCEEDED' || payment.status === 'COMPLETED') {
      return payment;
    }
    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException(
        'Create a payment intent first before confirming booking payment',
      );
    }

    let intent: any;
    try {
      intent = await this.stripe.paymentIntents.retrieve(
        payment.stripePaymentIntentId,
      );
    } catch (error) {
      throw this.wrapStripeError('retrieve payment intent for confirmation', error);
    }

    if (intent.status === 'succeeded') {
      return this.markPaymentSucceeded(
        payment.id,
        intent.id,
        intent.latest_charge ? String(intent.latest_charge) : null,
      );
    }
    if (intent.status === 'canceled') {
      await this.markPaymentFailed(
        {
          ...payment,
          booking: await this.prisma.booking.findUniqueOrThrow({
            where: { id: payment.bookingId },
          }),
        },
        'Payment intent was canceled in Stripe',
      );
      throw new BadRequestException(
        'Stripe payment was canceled. Create a new payment intent and try again',
      );
    }
    if (intent.status === 'requires_payment_method') {
      await this.markPaymentFailed(
        {
          ...payment,
          booking: await this.prisma.booking.findUniqueOrThrow({
            where: { id: payment.bookingId },
          }),
        },
        intent.last_payment_error?.message ?? 'Payment method is required',
      );
      throw new BadRequestException(
        intent.last_payment_error?.message ??
          'Stripe payment is incomplete. Complete the card payment first',
      );
    }

    throw new BadRequestException(
      `Stripe payment is not completed yet. Complete the payment first. Current Stripe status: ${intent.status}`,
    );
  }

  async markPaymentSucceeded(
    paymentId: string,
    paymentIntentId: string,
    stripeChargeId?: string | null,
  ) {
    const existingPayment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });
    if (!existingPayment) {
      throw new NotFoundException(
        'Payment record was not found during Stripe confirmation',
      );
    }
    if (existingPayment.status === 'REFUNDED') {
      return existingPayment;
    }
    if (existingPayment.status === 'SUCCEEDED') {
      return existingPayment;
    }

    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'SUCCEEDED',
        stripePaymentIntentId: paymentIntentId,
        stripeChargeId: stripeChargeId ?? existingPayment.stripeChargeId,
        paidAt: new Date(),
      },
      include: { booking: true },
    });
    const booking = await this.prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        status: 'PENDING',
        requestedAt: payment.booking.requestedAt ?? new Date(),
      },
    });
    const [buyer, groomer] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: booking.buyerId },
        select: { fullName: true },
      }),
      this.prisma.user.findUnique({
        where: { id: booking.groomerId },
        select: { fullName: true },
      }),
    ]);
    const buyerNotification = renderNotificationTemplate(
      'BUYER_PAYMENT_SUCCESS',
    );
    await this.notifications.create(
      booking.buyerId,
      'PAYMENT_SUCCESS',
      buyerNotification.title,
      buyerNotification.body,
      { targetScreen: 'booking_details', bookingId: booking.id },
    );
    const groomerNotification = renderNotificationTemplate(
      'GROOMER_NEW_BOOKING_REQUEST',
      {
        CustomerName: buyer?.fullName,
      },
    );
    await this.notifications.create(
      booking.groomerId,
      'BOOKING_CREATED',
      groomerNotification.title,
      groomerNotification.body,
      { targetScreen: 'booking_details', bookingId: booking.id },
    );
    this.notifications.emitBookingUpdated(
      [booking.buyerId, booking.groomerId],
      {
        bookingId: booking.id,
        status: booking.status,
        updatedAt: booking.updatedAt,
        buyerId: booking.buyerId,
        groomerId: booking.groomerId,
      },
    );
    const adminNotification = renderNotificationTemplate(
      'ADMIN_NEW_PAID_BOOKING',
      {
        CustomerName: buyer?.fullName,
        GroomerName: groomer?.fullName,
      },
    );
    await this.notifications.createForAdmins(
      'BOOKING_CREATED',
      adminNotification.title,
      adminNotification.body,
      {
        targetScreen: 'booking_details',
        bookingId: booking.id,
        buyerId: booking.buyerId,
        groomerId: booking.groomerId,
      },
    );
    return payment;
  }

  async refundBooking(
    bookingId: string,
    reason?: string,
    bookingStatus: 'REJECTED' | 'REFUNDED' = 'REFUNDED',
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        bookingId,
        status: 'SUCCEEDED',
        paidAt: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new BadRequestException('No successful payment found');
    const refund = payment.stripePaymentIntentId
      ? await this.stripe.refunds.create({
          payment_intent: payment.stripePaymentIntentId,
          reason: 'requested_by_customer',
          metadata: { bookingId, reason: reason ?? '' },
        })
      : null;
    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'REFUNDED',
          stripeRefundId: refund?.id,
          refundedAt: new Date(),
        },
      });
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: bookingStatus,
          ...(bookingStatus === 'REFUNDED' && { refundedAt: new Date() }),
        },
      });
      if (updated.availabilitySlotId) {
        await tx.groomerAvailabilitySlot.update({
          where: { id: updated.availabilitySlotId },
          data: { isBooked: false },
        });
      }
      return updated;
    });
    const buyerNotification = renderNotificationTemplate('BUYER_REFUND_ISSUED');
    await this.notifications.create(
      booking.buyerId,
      'PAYMENT_REFUND',
      buyerNotification.title,
      buyerNotification.body,
      { targetScreen: 'booking_details', bookingId },
    );
    if (bookingStatus === 'REFUNDED') {
      this.notifications.emitBookingUpdated(
        [booking.buyerId, booking.groomerId],
        {
          bookingId,
          status: booking.status,
          updatedAt: booking.updatedAt,
          buyerId: booking.buyerId,
          groomerId: booking.groomerId,
          refundId: refund?.id ?? null,
          reason,
        },
      );
    }
    const adminNotification = renderNotificationTemplate('ADMIN_REFUND_ISSUED');
    await this.notifications.createForAdmins(
      'PAYMENT_REFUND',
      adminNotification.title,
      reason ?? adminNotification.body,
      {
        targetScreen: 'booking_details',
        bookingId,
        buyerId: booking.buyerId,
        groomerId: booking.groomerId,
        refundId: refund?.id,
      },
    );
    return { refundId: refund?.id, booking };
  }

  async refundExpiredPendingBookings() {
    const hours = Number(this.config.get('PENDING_BOOKING_REFUND_HOURS') ?? 48);
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const expired = await this.prisma.booking.findMany({
      where: {
        status: 'PENDING',
        requestedAt: { lte: cutoff },
        payments: {
          some: {
            status: 'SUCCEEDED',
            paidAt: { not: null },
          },
        },
      },
      select: { id: true },
      take: 50,
    });

    for (const booking of expired) {
      try {
        await this.refundBooking(
          booking.id,
          `Groomer did not accept within ${hours} hours`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to auto-refund pending booking ${booking.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    return { processed: expired.length };
  }

  private isStripeMissingResourceError(error: unknown) {
    const stripeError = error as { code?: string };
    return stripeError.code === 'resource_missing';
  }

  private async markPaymentFailed(
    payment: any,
    failureReason?: string | null,
  ) {
    const shouldNotify = payment.status !== 'FAILED';
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureReason: failureReason ?? 'Payment failed',
      },
    });
    if (!shouldNotify || !payment.booking) {
      return updated;
    }

    const buyerNotification = renderNotificationTemplate('BUYER_PAYMENT_FAILED');
    await this.notifications.create(
      payment.booking.buyerId,
      'PAYMENT_FAILED',
      buyerNotification.title,
      buyerNotification.body,
      {
        targetScreen: 'booking_details',
        bookingId: payment.bookingId,
        paymentId: payment.id,
        reason: failureReason,
      },
    );

    const adminNotification = renderNotificationTemplate('ADMIN_PAYMENT_ISSUE');
    await this.notifications.createForAdmins(
      'PAYMENT_FAILED',
      adminNotification.title,
      failureReason ?? adminNotification.body,
      {
        targetScreen: 'booking_details',
        bookingId: payment.bookingId,
        buyerId: payment.booking.buyerId,
        groomerId: payment.booking.groomerId,
        paymentId: payment.id,
        reason: failureReason,
      },
    );

    return updated;
  }

  private wrapStripeError(action: string, error: unknown) {
    const stripeError = error as { message?: string; code?: string };
    const message = stripeError.message ?? 'Unknown Stripe error';
    this.logger.error(
      `Stripe failed to ${action}: ${message}${
        stripeError.code ? ` code=${stripeError.code}` : ''
      }`,
      error instanceof Error ? error.stack : undefined,
    );
    return new BadGatewayException(
      `Stripe failed to ${action}: ${message}`,
    );
  }
}
