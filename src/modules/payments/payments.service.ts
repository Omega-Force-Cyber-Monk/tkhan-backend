import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: any;
  private pendingRefundTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
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

  async createCheckoutSession(
    bookingId: string,
    buyerId: string,
    apiBaseUrl?: string,
  ) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    if (booking.buyerId !== buyerId)
      throw new BadRequestException('Booking belongs to another buyer');
    if (booking.status !== 'PAYMENT_PENDING')
      throw new BadRequestException('Booking is not awaiting payment');
    const payment =
      (await this.prisma.payment.findFirst({
        where: { bookingId, status: 'PENDING' },
      })) ??
      (await this.prisma.payment.create({
        data: {
          bookingId,
          amount: booking.totalAmount,
          currency: this.config.get('STRIPE_CURRENCY') ?? 'usd',
        },
      }));
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      success_url:
        (apiBaseUrl ?? this.config.get('APP_URL') ?? 'http://localhost:3000') +
        '/api/v1/payments/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:
        (this.config.get('FRONTEND_URL') ?? 'http://localhost:5173') +
        '/bookings/' +
        bookingId +
        '/payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: payment.currency,
            unit_amount: Math.round(Number(booking.totalAmount) * 100),
            product_data: { name: 'Booking ' + booking.bookingNumber },
          },
        },
      ],
      metadata: { bookingId, paymentId: payment.id },
    });
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { stripeCheckoutSessionId: session.id },
    });
    return { checkoutUrl: session.url, sessionId: session.id };
  }

  async confirmBookingCheckout(bookingId: string, buyerId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        payments: {
          where: { stripeCheckoutSessionId: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (booking.buyerId !== buyerId)
      throw new BadRequestException('Booking belongs to another buyer');
    const payment = booking.payments[0];
    if (!payment?.stripeCheckoutSessionId)
      throw new BadRequestException('No checkout session found for booking');

    return this.confirmCheckoutSession(payment.stripeCheckoutSessionId);
  }

  async confirmCheckoutSession(sessionId: string) {
    if (!sessionId)
      throw new BadRequestException('Missing checkout session id');

    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid')
      throw new BadRequestException('Checkout session is not paid');

    const paymentId = session.metadata?.paymentId;
    const bookingId = session.metadata?.bookingId;
    if (!paymentId || !bookingId)
      throw new BadRequestException('Checkout session metadata is missing');

    await this.markPaymentSucceeded(
      String(paymentId),
      this.paymentIntentId(session.payment_intent),
    );

    return {
      bookingId,
      redirectUrl:
        (this.config.get('FRONTEND_URL') ?? 'http://localhost:5173') +
        '/bookings/' +
        bookingId +
        '/success',
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
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await this.markPaymentSucceeded(
        String(session.metadata?.paymentId),
        this.paymentIntentId(session.payment_intent),
      );
    }
    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object;
      await this.prisma.payment.updateMany({
        where: { stripePaymentIntentId: intent.id },
        data: {
          status: 'FAILED',
          failureReason: intent.last_payment_error?.message,
        },
      });
    }
    return { received: true };
  }
  async markPaymentSucceeded(paymentId: string, paymentIntentId: string) {
    const existingPayment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { booking: true },
    });
    if (existingPayment.status === 'REFUNDED') {
      return existingPayment;
    }
    if (
      existingPayment.status === 'SUCCEEDED' &&
      existingPayment.booking.status !== 'PAYMENT_PENDING'
    ) {
      return existingPayment;
    }

    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'SUCCEEDED',
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
      },
      include: { booking: true },
    });
    if (payment.booking.status !== 'PAYMENT_PENDING') {
      return payment;
    }
    const booking = await this.prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'PENDING', requestedAt: new Date() },
    });
    await this.notifications.create(
      booking.buyerId,
      'PAYMENT_SUCCESS',
      'Payment received',
      'Your booking payment is held until completion.',
      { bookingId: booking.id },
    );
    await this.notifications.create(
      booking.groomerId,
      'BOOKING_CREATED',
      'New booking request',
      'A buyer requested a booking.',
      { bookingId: booking.id },
    );
    return payment;
  }

  private paymentIntentId(paymentIntent: unknown) {
    if (typeof paymentIntent === 'string') return paymentIntent;
    if (
      paymentIntent &&
      typeof paymentIntent === 'object' &&
      'id' in paymentIntent
    ) {
      return String((paymentIntent as { id: unknown }).id);
    }
    throw new BadRequestException('Checkout session payment intent is missing');
  }
  async refundBooking(bookingId: string, reason?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { bookingId, status: 'SUCCEEDED' },
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
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });
      if (updated.availabilitySlotId) {
        await tx.groomerAvailabilitySlot.update({
          where: { id: updated.availabilitySlotId },
          data: { isBooked: false },
        });
      }
      return updated;
    });
    await this.notifications.create(
      booking.buyerId,
      'PAYMENT_REFUND',
      'Payment refunded',
      'A full refund was issued.',
      { bookingId },
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
        payments: { some: { status: 'SUCCEEDED' } },
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
}
