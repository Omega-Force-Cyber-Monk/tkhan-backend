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

type ReminderKind = 'TWENTY_FOUR_HOURS' | 'ONE_HOUR';
type ReminderRecipientRole = 'BUYER' | 'GROOMER';

const reminderBookingInclude = {
  buyer: { select: { id: true, fullName: true } },
  groomer: { select: { id: true, fullName: true } },
  pet: { select: { name: true } },
  availabilitySlot: { select: { startTime: true } },
} satisfies Prisma.BookingInclude;

type ReminderBooking = Prisma.BookingGetPayload<{
  include: typeof reminderBookingInclude;
}>;

@Injectable()
export class BookingReminderScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingReminderScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    const intervalMinutes = Number(
      process.env.BOOKING_REMINDER_CHECK_MINUTES ?? 5,
    );
    const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;
    this.timer = setInterval(() => {
      void this.processDueReminders();
    }, intervalMs);
    this.timer.unref?.();

    setTimeout(() => void this.processDueReminders(), 5000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async processDueReminders() {
    if (this.running) return;
    this.running = true;
    try {
      await this.processKind('TWENTY_FOUR_HOURS');
      await this.processKind('ONE_HOUR');
    } catch (error) {
      this.logger.warn(
        `Failed to process booking reminders: ${
          error instanceof Error ? error.message : error
        }`,
      );
    } finally {
      this.running = false;
    }
  }

  private async processKind(kind: ReminderKind) {
    const now = new Date();
    const upperBound =
      kind === 'TWENTY_FOUR_HOURS'
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 60 * 60 * 1000);
    const lowerBound =
      kind === 'TWENTY_FOUR_HOURS'
        ? new Date(now.getTime() + 60 * 60 * 1000)
        : now;

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'ACCEPTED',
        availabilitySlot: {
          startTime: {
            gt: lowerBound,
            lte: upperBound,
          },
        },
      },
      include: reminderBookingInclude,
      orderBy: { availabilitySlot: { startTime: 'asc' } },
      take: 100,
    });

    for (const booking of bookings) {
      await this.sendReminder(booking, kind, 'BUYER');
      await this.sendReminder(booking, kind, 'GROOMER');
    }
  }

  private async sendReminder(
    booking: ReminderBooking,
    kind: ReminderKind,
    recipientRole: ReminderRecipientRole,
  ) {
    const startTime = booking.availabilitySlot?.startTime;
    if (!startTime) return;

    const recipientId =
      recipientRole === 'BUYER' ? booking.buyerId : booking.groomerId;
    const reminder = await this.reserveReminder(
      booking.id,
      kind,
      recipientRole,
      recipientId,
    );
    if (!reminder) return;

    const variables = {
      CustomerName: booking.buyer.fullName,
      GroomerName: booking.groomer.fullName,
      PetName: booking.pet.name,
      Date: this.formatDate(startTime),
      Time: this.formatTime(startTime),
    };
    const templateKey =
      recipientRole === 'BUYER'
        ? kind === 'TWENTY_FOUR_HOURS'
          ? 'BUYER_REMINDER_24_HOURS'
          : 'BUYER_REMINDER_1_HOUR'
        : kind === 'TWENTY_FOUR_HOURS'
          ? 'GROOMER_REMINDER_24_HOURS'
          : 'GROOMER_REMINDER_1_HOUR';
    const notification = renderNotificationTemplate(templateKey, variables);
    const created = await this.notifications.create(
      recipientId,
      'BOOKING_REMINDER',
      notification.title,
      notification.body,
      {
        targetScreen: 'booking_details',
        bookingId: booking.id,
        reminderKind: kind,
        appointmentStartTime: startTime,
      },
    );

    await this.prisma.bookingReminder.update({
      where: { id: reminder.id },
      data: { notificationId: created.id },
    });
  }

  private async reserveReminder(
    bookingId: string,
    kind: ReminderKind,
    recipientRole: ReminderRecipientRole,
    recipientId: string,
  ) {
    try {
      return await this.prisma.bookingReminder.create({
        data: {
          bookingId,
          kind,
          recipientRole,
          recipientId,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) return null;
      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(value);
  }

  private formatTime(value: Date) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    }).format(value);
  }
}
