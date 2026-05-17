import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class PayoutsService {
  private readonly stripe: any;
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.config.getOrThrow<string>('STRIPE_SECRET_KEY'),
    );
  }
  async releaseForBooking(bookingId: string) {
    const existingPayout = await this.prisma.payout.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
    if (existingPayout) return existingPayout;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        groomer: {
          include: { groomerProfile: { include: { paymentMethods: true } } },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'COMPLETED')
      throw new BadRequestException(
        'Booking must be completed before payout release',
      );
    const groomerProfile = booking.groomer.groomerProfile;
    if (!groomerProfile)
      throw new BadRequestException('Booking groomer profile not found');
    const paymentMethod = groomerProfile.paymentMethods.find(
      (pm) => pm.isDefault && pm.payoutsEnabled,
    );
    const payout = await this.prisma.payout.create({
      data: {
        bookingId,
        groomerId: groomerProfile.id,
        amount: booking.groomerEarningAmount,
        platformFee: booking.platformFeeAmount,
        status: paymentMethod?.stripeAccountId ? 'PROCESSING' : 'PENDING',
      },
    });
    if (paymentMethod?.stripeAccountId) {
      // Stripe Connect transfers require the groomer's connected account to be fully onboarded.
      try {
        const transfer = await this.stripe.transfers.create({
          amount: Math.round(Number(payout.amount) * 100),
          currency: payout.currency,
          destination: paymentMethod.stripeAccountId,
          metadata: { bookingId, payoutId: payout.id },
        });
        return this.prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: 'PAID',
            stripeTransferId: transfer.id,
            releasedAt: new Date(),
          },
        });
      } catch (error) {
        return this.prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: 'FAILED',
            failureReason:
              error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
    return payout;
  }
  list() {
    return this.prisma.payout.findMany({
      orderBy: { createdAt: 'desc' },
      include: { booking: true, groomer: { include: { user: true } } },
    });
  }
}
