import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from './notifications.service';
import { renderNotificationTemplate } from './notification-templates';

type BuyerGrowthAlertKind =
  | 'INACTIVE_USER'
  | 'REPEAT_CUSTOMER'
  | 'FAVORITE_GROOMER_OPENED_AVAILABILITY'
  | 'LAST_MINUTE_AVAILABILITY';

@Injectable()
export class BuyerGrowthAlertScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BuyerGrowthAlertScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    const intervalHours = this.numberEnv('BUYER_GROWTH_ALERT_CHECK_HOURS', 12);
    const intervalMs = Math.max(intervalHours, 1) * 60 * 60 * 1000;
    this.timer = setInterval(() => {
      void this.processGrowthAlerts();
    }, intervalMs);
    this.timer.unref?.();

    setTimeout(() => void this.processGrowthAlerts(), 11000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async processGrowthAlerts() {
    if (this.running) return;
    this.running = true;
    try {
      await this.processInactiveBuyers();
      await this.processRepeatCustomerReminders();
      await this.processFavoriteGroomerAvailability();
      await this.processLastMinuteAvailability();
    } catch (error) {
      this.logger.warn(
        `Failed to process buyer growth alerts: ${
          error instanceof Error ? error.message : error
        }`,
      );
    } finally {
      this.running = false;
    }
  }

  private async processInactiveBuyers() {
    const inactiveDays = this.numberEnv('BUYER_INACTIVE_ALERT_DAYS', 30);
    const cutoff = new Date(
      Date.now() - Math.max(inactiveDays, 1) * 24 * 60 * 60 * 1000,
    );
    const buyers = await this.prisma.user.findMany({
      where: {
        role: 'BUYER',
        status: 'ACTIVE',
        isBlocked: false,
        createdAt: { lte: cutoff },
        bookingsAsBuyer: {
          none: { createdAt: { gte: cutoff } },
        },
      },
      select: { id: true },
      take: 100,
    });

    for (const buyer of buyers) {
      const reserved = await this.reserveAlert(
        buyer.id,
        'INACTIVE_USER',
        null,
        this.numberEnv('BUYER_INACTIVE_ALERT_THROTTLE_DAYS', 30),
      );
      if (!reserved) continue;

      const notification = renderNotificationTemplate('GROWTH_INACTIVE_USER');
      await this.sendReservedAlert(
        reserved.id,
        buyer.id,
        'INACTIVE_USER',
        notification.title,
        notification.body,
        {
          targetScreen: 'buyer_groomers',
          alertKind: 'INACTIVE_USER',
        },
      );
    }
  }

  private async processRepeatCustomerReminders() {
    const repeatDays = this.numberEnv('BUYER_REPEAT_REMINDER_DAYS', 45);
    const cutoff = new Date(
      Date.now() - Math.max(repeatDays, 1) * 24 * 60 * 60 * 1000,
    );
    const completedBookings = await this.prisma.booking.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { lte: cutoff },
        buyer: {
          role: 'BUYER',
          status: 'ACTIVE',
          isBlocked: false,
        },
      },
      include: {
        pet: { select: { name: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 200,
    });

    const seenBuyers = new Set<string>();
    for (const booking of completedBookings) {
      if (seenBuyers.has(booking.buyerId)) continue;
      seenBuyers.add(booking.buyerId);

      const newerBooking = await this.prisma.booking.findFirst({
        where: {
          buyerId: booking.buyerId,
          createdAt: { gt: booking.completedAt ?? booking.createdAt },
          status: { notIn: ['REJECTED', 'CANCELLED', 'REFUNDED'] },
        },
        select: { id: true },
      });
      if (newerBooking) continue;

      const reserved = await this.reserveAlert(
        booking.buyerId,
        'REPEAT_CUSTOMER',
        null,
        this.numberEnv('BUYER_REPEAT_REMINDER_THROTTLE_DAYS', 30),
      );
      if (!reserved) continue;

      const notification = renderNotificationTemplate(
        'GROWTH_REPEAT_CUSTOMER_REMINDER',
        {
          Duration: `${repeatDays} days`,
          PetName: booking.pet.name,
        },
      );
      await this.sendReservedAlert(
        reserved.id,
        booking.buyerId,
        'REPEAT_CUSTOMER',
        notification.title,
        notification.body,
        {
          targetScreen: 'buyer_groomers',
          alertKind: 'REPEAT_CUSTOMER',
          petId: booking.petId,
          bookingId: booking.id,
        },
      );
    }
  }

  private async processFavoriteGroomerAvailability() {
    const recentHours = this.numberEnv(
      'BUYER_FAVORITE_AVAILABILITY_RECENT_HOURS',
      24,
    );
    const lookaheadDays = this.numberEnv(
      'BUYER_FAVORITE_AVAILABILITY_LOOKAHEAD_DAYS',
      7,
    );
    const createdSince = new Date(
      Date.now() - Math.max(recentHours, 1) * 60 * 60 * 1000,
    );
    const horizon = new Date(
      Date.now() + Math.max(lookaheadDays, 1) * 24 * 60 * 60 * 1000,
    );

    const favorites = await this.prisma.buyerFavoriteGroomer.findMany({
      where: {
        buyer: {
          status: 'ACTIVE',
          isBlocked: false,
        },
        groomer: {
          approvalStatus: 'APPROVED',
          availableForBookings: true,
          availability: {
            some: {
              isAvailable: true,
              slots: {
                some: {
                  isBooked: false,
                  createdAt: { gte: createdSince },
                  startTime: { gte: new Date(), lte: horizon },
                },
              },
            },
          },
        },
      },
      include: {
        groomer: {
          include: {
            user: { select: { fullName: true } },
          },
        },
      },
      take: 200,
    });

    for (const favorite of favorites) {
      const reserved = await this.reserveAlert(
        favorite.buyerId,
        'FAVORITE_GROOMER_OPENED_AVAILABILITY',
        favorite.groomerId,
        this.numberEnv('BUYER_FAVORITE_AVAILABILITY_THROTTLE_DAYS', 7),
      );
      if (!reserved) continue;

      const notification = renderNotificationTemplate(
        'GROWTH_FAVORITE_GROOMER_OPENED_AVAILABILITY',
        { GroomerName: favorite.groomer.user.fullName },
      );
      await this.sendReservedAlert(
        reserved.id,
        favorite.buyerId,
        'FAVORITE_GROOMER_OPENED_AVAILABILITY',
        notification.title,
        notification.body,
        {
          targetScreen: 'groomer_details',
          alertKind: 'FAVORITE_GROOMER_OPENED_AVAILABILITY',
          groomerProfileId: favorite.groomerId,
        },
      );
    }
  }

  private async processLastMinuteAvailability() {
    const hours = this.numberEnv('BUYER_LAST_MINUTE_AVAILABILITY_HOURS', 24);
    const horizon = new Date(Date.now() + Math.max(hours, 1) * 60 * 60 * 1000);
    const slots = await this.prisma.groomerAvailabilitySlot.findMany({
      where: {
        isBooked: false,
        startTime: { gte: new Date(), lte: horizon },
        availability: {
          isAvailable: true,
          groomer: {
            approvalStatus: 'APPROVED',
            availableForBookings: true,
          },
        },
      },
      include: {
        availability: {
          include: {
            groomer: {
              include: {
                user: { select: { fullName: true } },
                favorites: {
                  where: {
                    buyer: {
                      status: 'ACTIVE',
                      isBlocked: false,
                    },
                  },
                  select: { buyerId: true },
                },
              },
            },
          },
        },
      },
      orderBy: { startTime: 'asc' },
      take: 100,
    });

    for (const slot of slots) {
      const groomer = slot.availability.groomer;
      for (const favorite of groomer.favorites) {
        const reserved = await this.reserveAlert(
          favorite.buyerId,
          'LAST_MINUTE_AVAILABILITY',
          groomer.id,
          this.numberEnv('BUYER_LAST_MINUTE_AVAILABILITY_THROTTLE_DAYS', 3),
        );
        if (!reserved) continue;

        const notification = renderNotificationTemplate(
          'GROWTH_LAST_MINUTE_AVAILABILITY',
          { GroomerName: groomer.user.fullName },
        );
        await this.sendReservedAlert(
          reserved.id,
          favorite.buyerId,
          'LAST_MINUTE_AVAILABILITY',
          notification.title,
          notification.body,
          {
            targetScreen: 'groomer_details',
            alertKind: 'LAST_MINUTE_AVAILABILITY',
            groomerProfileId: groomer.id,
            availabilitySlotId: slot.id,
            appointmentStartTime: slot.startTime,
          },
        );
      }
    }
  }

  private async reserveAlert(
    buyerId: string,
    kind: BuyerGrowthAlertKind,
    contextId: string | null,
    throttleDays: number,
  ) {
    const since = new Date(
      Date.now() - Math.max(throttleDays, 1) * 24 * 60 * 60 * 1000,
    );
    const recent = await this.prisma.buyerGrowthAlert.findFirst({
      where: {
        buyerId,
        kind,
        contextId,
        sentAt: { gte: since },
      },
      select: { id: true },
    });
    if (recent) return null;

    return this.prisma.buyerGrowthAlert.create({
      data: {
        buyerId,
        kind,
        contextId,
      },
    });
  }

  private async sendReservedAlert(
    alertId: string,
    buyerId: string,
    kind: BuyerGrowthAlertKind,
    title: string,
    body: string,
    data: Record<string, any>,
  ) {
    const notification = await this.notifications.create(
      buyerId,
      'GROWTH_ALERT',
      title,
      body,
      data,
    );
    await this.prisma.buyerGrowthAlert.update({
      where: { id: alertId },
      data: { notificationId: notification.id, kind },
    });
  }

  private numberEnv(name: string, fallback: number) {
    const value = Number(process.env[name] ?? fallback);
    return Number.isFinite(value) ? value : fallback;
  }
}
