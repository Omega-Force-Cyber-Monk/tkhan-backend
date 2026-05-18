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

  async createPaymentIntent(bookingId: string, buyerId: string) {
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

    let intent: any;
    if (payment.stripePaymentIntentId) {
      const existingIntent = await this.stripe.paymentIntents.retrieve(
        payment.stripePaymentIntentId,
      );
      if (existingIntent.status !== 'canceled') {
        return {
          paymentId: payment.id,
          paymentIntentId: existingIntent.id,
          clientSecret: existingIntent.client_secret,
          amount: payment.amount,
          currency: payment.currency,
        };
      }
    }

    intent = await this.stripe.paymentIntents.create({
      amount: Math.round(Number(booking.totalAmount) * 100),
      currency: payment.currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        bookingId,
        paymentId: payment.id,
      },
    });
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
