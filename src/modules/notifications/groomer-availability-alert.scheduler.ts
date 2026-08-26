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

type AvailabilityAlertKind =
  | 'NO_AVAILABILITY'
  | 'RUNNING_LOW'
  | 'CALENDAR_EXPIRING';

const availabilityGroomerSelect = {
  id: true,
  userId: true,
  user: { select: { fullName: true } },
  availability: {
    select: {
      slots: {
        select: { startTime: true },
      },
    },
  },
} satisfies Prisma.GroomerProfileSelect;

type AvailabilityGroomer = Prisma.GroomerProfileGetPayload<{
  select: typeof availabilityGroomerSelect;
}>;

@Injectable()
export class GroomerAvailabilityAlertScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(GroomerAvailabilityAlertScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    const intervalHours = Number(
      process.env.GROOMER_AVAILABILITY_ALERT_CHECK_HOURS ?? 6,
    );
    const intervalMs = Math.max(intervalHours, 1) * 60 * 60 * 1000;
    this.timer = setInterval(() => {
      void this.processAvailabilityAlerts();
    }, intervalMs);
    this.timer.unref?.();

    setTimeout(() => void this.processAvailabilityAlerts(), 9000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async processAvailabilityAlerts() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const lookaheadDays = this.numberEnv(
        'GROOMER_AVAILABILITY_ALERT_LOOKAHEAD_DAYS',
        14,
      );
      const horizon = new Date(
        now.getTime() + Math.max(lookaheadDays, 1) * 24 * 60 * 60 * 1000,
      );

      const groomers = await this.prisma.groomerProfile.findMany({
        where: {
          approvalStatus: 'APPROVED',
          user: {
            status: 'ACTIVE',
            isBlocked: false,
          },
        },
        select: {
          ...availabilityGroomerSelect,
          availability: {
            where: {
              isAvailable: true,
              date: { gte: this.startOfToday(now) },
            },
            select: {
              slots: {
                where: {
                  isBooked: false,
                  startTime: {
                    gte: now,
                    lte: horizon,
                  },
                },
                select: { startTime: true },
              },
            },
          },
        },
        take: 500,
      });

      for (const groomer of groomers) {
        await this.processGroomer(groomer, now);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to process groomer availability alerts: ${
          error instanceof Error ? error.message : error
        }`,
      );
    } finally {
      this.running = false;
    }
  }

  private async processGroomer(groomer: AvailabilityGroomer, now: Date) {
    const slots = groomer.availability.flatMap((day) => day.slots);
    const slotCount = slots.length;

    if (slotCount === 0) {
      await this.sendAlert(groomer, 'NO_AVAILABILITY');
      return;
    }

    const lowThreshold = this.numberEnv(
      'GROOMER_AVAILABILITY_LOW_SLOT_THRESHOLD',
      3,
    );
    if (slotCount <= Math.max(lowThreshold, 1)) {
      await this.sendAlert(groomer, 'RUNNING_LOW');
    }

    const expiringDays = this.numberEnv(
      'GROOMER_AVAILABILITY_EXPIRING_DAYS',
      7,
    );
    const latestSlotTime = Math.max(
      ...slots.map((slot) => slot.startTime.getTime()),
    );
    const expiringCutoff = now.getTime() + expiringDays * 24 * 60 * 60 * 1000;
    if (latestSlotTime <= expiringCutoff) {
      await this.sendAlert(groomer, 'CALENDAR_EXPIRING');
    }
  }

  private async sendAlert(
    groomer: AvailabilityGroomer,
    kind: AvailabilityAlertKind,
  ) {
    const throttleDays = this.numberEnv(
      'GROOMER_AVAILABILITY_ALERT_THROTTLE_DAYS',
      7,
    );
    const since = new Date(
      Date.now() - Math.max(throttleDays, 1) * 24 * 60 * 60 * 1000,
    );
    const recent = await this.prisma.groomerAvailabilityAlert.findFirst({
      where: {
        groomerId: groomer.id,
        kind,
        sentAt: { gte: since },
      },
      select: { id: true },
    });
    if (recent) return;

    const templateKey =
      kind === 'NO_AVAILABILITY'
        ? 'GROOMER_NO_AVAILABILITY'
        : kind === 'RUNNING_LOW'
          ? 'GROOMER_AVAILABILITY_RUNNING_LOW'
          : 'GROOMER_CALENDAR_EXPIRING';
    const notification = renderNotificationTemplate(templateKey, {
      GroomerName: groomer.user.fullName,
    });
    const created = await this.notifications.create(
      groomer.userId,
      'AVAILABILITY_ALERT',
      notification.title,
      notification.body,
      {
        targetScreen: 'availability',
        alertKind: kind,
        groomerProfileId: groomer.id,
      },
    );

    await this.prisma.groomerAvailabilityAlert.create({
      data: {
        groomerId: groomer.id,
        kind,
        notificationId: created.id,
      },
    });
  }

  private numberEnv(name: string, fallback: number) {
    const value = Number(process.env[name] ?? fallback);
    return Number.isFinite(value) ? value : fallback;
  }

  private startOfToday(now: Date) {
    return new Date(now.toISOString().slice(0, 10));
  }
}
