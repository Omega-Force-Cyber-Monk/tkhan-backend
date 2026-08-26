import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from './notifications.service';
import { renderNotificationTemplate } from './notification-templates';

const reviewBookingInclude = {
  buyer: { select: { fullName: true } },
  groomer: { select: { fullName: true } },
  pet: { select: { name: true } },
} satisfies Prisma.BookingInclude;

type ReviewBooking = Prisma.BookingGetPayload<{
  include: typeof reviewBookingInclude;
}>;

@Injectable()
export class ReviewReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewReminderService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    const intervalMinutes = Number(
      process.env.REVIEW_REMINDER_CHECK_MINUTES ??
        process.env.BOOKING_REMINDER_CHECK_MINUTES ??
        5,
    );
    const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;
    this.timer = setInterval(() => {
      void this.processDueReviewReminders();
    }, intervalMs);
    this.timer.unref?.();

    setTimeout(() => void this.processDueReviewReminders(), 7000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async sendReviewRequest(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: reviewBookingInclude,
    });
    if (!booking || booking.status !== 'COMPLETED') return;

    const alreadyReviewed = await this.hasBuyerReviewed(booking);
    if (alreadyReviewed) return;

    await this.sendBuyerReviewNotification(booking, 'REVIEW_REQUEST');
  }

  private async processDueReviewReminders() {
    if (this.running) return;
    this.running = true;
    try {
      const delayHours = Number(process.env.REVIEW_REMINDER_DELAY_HOURS ?? 24);
      const completedBefore = new Date(
        Date.now() - Math.max(delayHours, 1) * 60 * 60 * 1000,
      );
      const bookings = await this.prisma.booking.findMany({
        where: {
          status: 'COMPLETED',
          completedAt: {
            not: null,
            lte: completedBefore,
          },
          reviews: {
            none: {
              targetType: 'GROOMER',
            },
          },
        },
        include: reviewBookingInclude,
        orderBy: { completedAt: 'asc' },
        take: 100,
      });

      for (const booking of bookings) {
        await this.sendBuyerReviewNotification(booking, 'REVIEW_REMINDER');
      }
    } catch (error) {
      this.logger.warn(
        `Failed to process review reminders: ${
          error instanceof Error ? error.message : error
        }`,
      );
    } finally {
      this.running = false;
    }
  }

  private async sendBuyerReviewNotification(
    booking: ReviewBooking,
    kind: 'REVIEW_REQUEST' | 'REVIEW_REMINDER',
  ) {
    const reminder = await this.reserveReviewNotification(
      booking.id,
      kind,
      booking.buyerId,
    );
    if (!reminder) return;

    const notification = renderNotificationTemplate(
      kind === 'REVIEW_REQUEST'
        ? 'BUYER_REVIEW_REQUEST'
        : 'BUYER_REVIEW_REMINDER',
      {
        CustomerName: booking.buyer.fullName,
        GroomerName: booking.groomer.fullName,
        PetName: booking.pet.name,
      },
    );
    const created = await this.notifications.create(
      booking.buyerId,
      'REVIEW_REQUEST',
      notification.title,
      notification.body,
      {
        targetScreen: 'reviews',
        bookingId: booking.id,
        groomerId: booking.groomerId,
        reminderKind: kind,
      },
    );

    await this.prisma.bookingReminder.update({
      where: { id: reminder.id },
      data: { notificationId: created.id },
    });
  }

  private async reserveReviewNotification(
    bookingId: string,
    kind: 'REVIEW_REQUEST' | 'REVIEW_REMINDER',
    recipientId: string,
  ) {
    try {
      return await this.prisma.bookingReminder.create({
        data: {
          bookingId,
          kind,
          recipientRole: 'BUYER',
          recipientId,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) return null;
      throw error;
    }
  }

  private async hasBuyerReviewed(booking: ReviewBooking) {
    const count = await this.prisma.review.count({
      where: {
        bookingId: booking.id,
        reviewerId: booking.buyerId,
        targetType: 'GROOMER',
      },
    });
    return count > 0;
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
