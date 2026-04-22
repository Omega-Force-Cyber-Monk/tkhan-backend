import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly stripe: any;
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    this.stripe = new Stripe(
      this.config.getOrThrow<string>('STRIPE_SECRET_KEY'),
    );
  }
  async createCheckoutSession(bookingId: string, buyerId: string) {
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
        (this.config.get('FRONTEND_URL') ?? 'http://localhost:5173') +
        '/bookings/' +
        bookingId +
        '/success',
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
      const session = event.data.object as any;
      await this.markPaymentSucceeded(
        String(session.metadata?.paymentId),
        String(session.payment_intent),
      );
    }
    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as any;
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
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'SUCCEEDED',
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
      },
      include: { booking: true },
    });
    const booking = await this.prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'REQUESTED', requestedAt: new Date() },
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
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REFUNDED',
        stripeRefundId: refund?.id,
        refundedAt: new Date(),
      },
    });
    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'REFUNDED', refundedAt: new Date() },
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
}
