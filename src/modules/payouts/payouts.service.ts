import {
  BadRequestException,
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { renderNotificationTemplate } from '../notifications/notification-templates';

const payoutListInclude = {
  booking: true,
  groomer: {
    include: {
      user: true,
    },
  },
} as const;

const payoutDetailInclude = {
  booking: {
    include: {
      buyer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          profileImage: true,
        },
      },
      groomer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          profileImage: true,
        },
      },
      pet: true,
      services: true,
      addons: true,
    },
  },
  groomer: {
    include: {
      user: true,
    },
  },
} as const;

type StripePayoutInterval = 'daily' | 'weekly' | 'monthly' | 'manual';
type StripeWeeklyPayoutDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly stripe: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.config.getOrThrow<string>('STRIPE_SECRET_KEY'),
    );
  }

  async releaseForBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        groomer: {
          include: {
            groomerProfile: true,
          },
        },
        payments: {
          where: {
            status: { in: ['SUCCEEDED', 'COMPLETED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Booking must be completed before payout transfer',
      );
    }

    const groomerProfile = booking.groomer.groomerProfile;
    if (!groomerProfile) {
      throw new BadRequestException('Booking groomer profile not found');
    }

    let payout = await this.prisma.payout.findUnique({
      where: { bookingId },
      include: payoutListInclude,
    });
    if (!payout) {
      payout = await this.prisma.payout.create({
        data: {
          bookingId,
          groomerId: groomerProfile.id,
          amount: booking.groomerEarningAmount,
          platformFee: booking.platformFeeAmount,
          currency: booking.payments[0]?.currency ?? 'usd',
          status: 'PENDING',
        },
        include: payoutListInclude,
      });
    }

    if (['TRANSFERRED', 'PAID_OUT'].includes(payout.status)) {
      return payout;
    }

    if (!this.isConnectReady(groomerProfile)) {
      return payout;
    }

    const payment = booking.payments[0];
    if (!payment?.stripeChargeId) {
      const failed = await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'FAILED',
          failureReason: 'Stripe charge reference not found for payout transfer',
        },
        include: payoutListInclude,
      });

      const groomerNotification = renderNotificationTemplate(
        'GROOMER_PAYOUT_FAILED',
      );
      await this.notifications.create(
        booking.groomerId,
        'PAYOUT_FAILED',
        groomerNotification.title,
        groomerNotification.body,
        {
          targetScreen: 'earnings',
          bookingId: booking.id,
          payoutId: failed.id,
          reason: failed.failureReason,
        },
      );

      return failed;
    }

    const amountInCents = Math.round(Number(payout.amount) * 100);
    if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
      return this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'TRANSFERRED',
          transferredAt: new Date(),
          failureReason: null,
        },
        include: payoutListInclude,
      });
    }

    try {
      const transfer = await this.stripe.transfers.create({
        amount: amountInCents,
        currency: payout.currency,
        destination: groomerProfile.stripeConnectedAccountId,
        source_transaction: payment.stripeChargeId,
        transfer_group: booking.bookingNumber,
        metadata: {
          bookingId: booking.id,
          payoutId: payout.id,
          groomerId: groomerProfile.id,
          groomerUserId: booking.groomerId,
        },
      });

      const updated = await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'TRANSFERRED',
          stripeTransferId: transfer.id,
          transferredAt: new Date(),
          failureReason: null,
        },
        include: payoutListInclude,
      });

      const groomerNotification = renderNotificationTemplate(
        'GROOMER_PAYOUT_SENT',
      );
      await this.notifications.create(
        booking.groomerId,
        'ADMIN_ACTION',
        groomerNotification.title,
        groomerNotification.body,
        {
          targetScreen: 'earnings',
          bookingId: booking.id,
          payoutId: updated.id,
          stripeTransferId: updated.stripeTransferId,
        },
      );

      const adminNotification = renderNotificationTemplate('ADMIN_PAYOUT_SENT');
      await this.notifications.createForAdmins(
        'ADMIN_ACTION',
        adminNotification.title,
        adminNotification.body,
        {
          targetScreen: 'booking_details',
          bookingId: booking.id,
          payoutId: updated.id,
          groomerId: groomerProfile.id,
          groomerUserId: booking.groomerId,
          stripeTransferId: updated.stripeTransferId,
        },
      );

      return updated;
    } catch (error) {
      const failed = await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'FAILED',
          failureReason: this.getStripeErrorMessage(error),
        },
        include: payoutListInclude,
      });

      this.logger.error(
        `Failed to transfer payout ${payout.id} for booking ${booking.id}: ${this.getStripeErrorMessage(
          error,
        )}`,
      );

      const groomerNotification = renderNotificationTemplate(
        'GROOMER_PAYOUT_FAILED',
      );
      await this.notifications.create(
        booking.groomerId,
        'PAYOUT_FAILED',
        groomerNotification.title,
        groomerNotification.body,
        {
          targetScreen: 'earnings',
          bookingId: booking.id,
          payoutId: failed.id,
          reason: failed.failureReason,
        },
      );

      const adminNotification = renderNotificationTemplate('ADMIN_PAYOUT_FAILED');
      await this.notifications.createForAdmins(
        'ADMIN_ACTION',
        adminNotification.title,
        adminNotification.body,
        {
          targetScreen: 'booking_details',
          bookingId: booking.id,
          payoutId: failed.id,
          groomerId: groomerProfile.id,
          groomerUserId: booking.groomerId,
          reason: failed.failureReason,
        },
      );

      return failed;
    }
  }

  list() {
    return this.prisma.payout.findMany({
      orderBy: { createdAt: 'desc' },
      include: payoutListInclude,
    });
  }

  async detail(userId: string, role: string, id: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { id },
      include: payoutDetailInclude,
    });
    if (!payout) {
      throw new NotFoundException('Payout transaction not found');
    }
    if (role !== 'ADMIN' && payout.groomer.userId !== userId) {
      throw new ForbiddenException('Payout transaction access denied');
    }

    return {
      type: 'PAYOUT',
      data: payout,
    };
  }

  async summary(userId: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [earned, pending, transferred, failed, week, month, recentEarnings] =
      await Promise.all([
        this.prisma.payout.aggregate({
          where: { groomerId: groomer.id },
          _sum: { amount: true },
        }),
        this.prisma.payout.aggregate({
          where: {
            groomerId: groomer.id,
            status: 'PENDING',
          },
          _sum: { amount: true },
        }),
        this.prisma.payout.aggregate({
          where: {
            groomerId: groomer.id,
            status: { in: ['TRANSFERRED', 'PAID_OUT'] },
          },
          _sum: { amount: true },
        }),
        this.prisma.payout.aggregate({
          where: {
            groomerId: groomer.id,
            status: 'FAILED',
          },
          _sum: { amount: true },
        }),
        this.prisma.payout.aggregate({
          where: {
            groomerId: groomer.id,
            createdAt: { gte: weekStart },
          },
          _sum: { amount: true },
        }),
        this.prisma.payout.aggregate({
          where: {
            groomerId: groomer.id,
            createdAt: { gte: monthStart },
          },
          _sum: { amount: true },
        }),
        this.prisma.payout.findMany({
          where: { groomerId: groomer.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            booking: true,
          },
        }),
      ]);

    const totalEarned = Number(earned._sum.amount ?? 0);
    const pendingTransfer = Number(pending._sum.amount ?? 0);
    const transferredTotal = Number(transferred._sum.amount ?? 0);
    const failedTransferTotal = Number(failed._sum.amount ?? 0);

    return {
      totalEarned,
      availableBalance: Number((pendingTransfer + failedTransferTotal).toFixed(2)),
      pendingWithdrawal: pendingTransfer,
      paidOutTotal: transferredTotal,
      pendingTransferTotal: pendingTransfer,
      transferredTotal,
      failedTransferTotal,
      thisWeekIncome: week._sum.amount ?? 0,
      thisMonthIncome: month._sum.amount ?? 0,
      recentEarnings,
      connectStatus: this.mapConnectStatus(groomer),
    };
  }

  async connectStatus(userId: string) {
    let groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    if (groomer.stripeConnectedAccountId) {
      try {
        const account = await this.stripe.accounts.retrieve(
          groomer.stripeConnectedAccountId,
        );
        groomer =
          (await this.handleConnectedAccountUpdated(account)) ?? groomer;
      } catch (error) {
        this.logger.warn(
          `Failed to refresh Stripe Connect status for groomer ${groomer.id}: ${this.getStripeErrorMessage(
            error,
          )}`,
        );
      }
    }
    return this.mapConnectStatus(groomer);
  }

  async createOnboardingLink(userId: string) {
    const groomer = await this.prisma.groomerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!groomer) {
      throw new NotFoundException('Groomer profile not found');
    }
    if (groomer.approvalStatus !== 'APPROVED') {
      throw new BadRequestException(
        'Admin approval is required before Stripe onboarding can start',
      );
    }

    const accountId = await this.ensureConnectedAccount(groomer);
    let link: any;
    try {
      link = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: this.resolveConnectUrl(
          'STRIPE_CONNECT_REFRESH_URL',
          '/groomer/connect/refresh',
        ),
        return_url: this.resolveConnectUrl(
          'STRIPE_CONNECT_RETURN_URL',
          '/groomer/connect/return',
        ),
        type: 'account_onboarding',
        collection_options: {
          fields: 'currently_due',
        },
      });
    } catch (error) {
      throw this.wrapStripeError('create Stripe onboarding link', error);
    }

    await this.prisma.groomerProfile.update({
      where: { id: groomer.id },
      data: {
        stripeOnboardingStartedAt:
          groomer.stripeOnboardingStartedAt ?? new Date(),
      },
    });

    return {
      url: link.url,
      expiresAt: link.expires_at
        ? new Date(link.expires_at * 1000).toISOString()
        : null,
      accountId,
    };
  }

  async createDashboardLink(userId: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    if (!groomer.stripeConnectedAccountId) {
      throw new BadRequestException(
        'Stripe Connect account is not set up yet. Generate the onboarding link first',
      );
    }

    let link: any;
    try {
      await this.configureConnectedAccountPayoutSchedule(
        groomer.stripeConnectedAccountId,
      );
      link = await this.stripe.accounts.createLoginLink(
        groomer.stripeConnectedAccountId,
      );
    } catch (error) {
      throw this.wrapStripeError('create Stripe dashboard login link', error);
    }

    return { url: link.url };
  }

  async handleConnectedAccountUpdated(account: any) {
    const groomer = await this.prisma.groomerProfile.findFirst({
      where: {
        stripeConnectedAccountId: String(account.id),
      },
    });
    if (!groomer) {
      return null;
    }

    const wasReady = this.isConnectReady(groomer);
    const updated = await this.prisma.groomerProfile.update({
      where: { id: groomer.id },
      data: {
        stripeOnboardingCompleted: Boolean(account.details_submitted),
        stripeTransfersEnabled:
          account.capabilities?.transfers === 'active',
        stripePayoutsEnabled: Boolean(account.payouts_enabled),
        stripeOnboardingCompletedAt: account.details_submitted
          ? groomer.stripeOnboardingCompletedAt ?? new Date()
          : null,
        stripeConnectCountry: account.country ?? groomer.stripeConnectCountry,
        stripeConnectEmail: account.email ?? groomer.stripeConnectEmail,
      },
    });

    const isReady = this.isConnectReady(updated);
    if (isReady && !wasReady) {
      const notification = renderNotificationTemplate(
        'GROOMER_STRIPE_SETUP_COMPLETE',
      );
      await this.notifications.create(
        groomer.userId,
        'ADMIN_ACTION',
        notification.title,
        notification.body,
        {
          targetScreen: 'earnings',
          connectedAccountId: updated.stripeConnectedAccountId,
        },
      );
      await this.releasePendingPayoutsForGroomer(updated.id);
    }

    return updated;
  }

  async releasePendingPayoutsForGroomer(groomerId: string) {
    const pendingPayouts = await this.prisma.payout.findMany({
      where: {
        groomerId,
        status: { in: ['PENDING', 'FAILED'] },
      },
      select: { bookingId: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const payout of pendingPayouts) {
      try {
        await this.releaseForBooking(payout.bookingId);
      } catch (error) {
        this.logger.warn(
          `Failed to retry payout for booking ${payout.bookingId}: ${this.getStripeErrorMessage(
            error,
          )}`,
        );
      }
    }
  }

  assertGroomerPayoutSetupComplete(groomer: {
    stripeConnectedAccountId?: string | null;
    stripeOnboardingCompleted?: boolean | null;
    stripeTransfersEnabled?: boolean | null;
    stripePayoutsEnabled?: boolean | null;
  }) {
    if (!groomer.stripeConnectedAccountId) {
      throw new BadRequestException(
        'This groomer has not started Stripe Connect onboarding yet',
      );
    }
    if (!groomer.stripeOnboardingCompleted) {
      throw new BadRequestException(
        'This groomer has not completed Stripe Connect onboarding yet',
      );
    }
    if (!groomer.stripeTransfersEnabled) {
      throw new BadRequestException(
        'Stripe transfers are not enabled for this groomer yet. Check pending Stripe requirements and webhook sync',
      );
    }
    if (!groomer.stripePayoutsEnabled) {
      throw new BadRequestException(
        'Stripe payouts are not enabled for this groomer yet. Finish payout setup in Stripe',
      );
    }
  }

  private async ensureConnectedAccount(groomer: any) {
    if (groomer.stripeConnectedAccountId) {
      await this.configureConnectedAccountPayoutSchedule(
        groomer.stripeConnectedAccountId,
      );
      return groomer.stripeConnectedAccountId;
    }

    let account: any;
    try {
      account = await this.stripe.accounts.create({
        type: 'express',
        email: groomer.user.email,
        business_type: 'individual',
        business_profile: {
          name: groomer.businessName || groomer.legalFullName,
          product_description:
            'Mobile pet grooming services provided by an individual groomer.',
          mcc: '7299',
        },
        capabilities: {
          transfers: {
            requested: true,
          },
        },
        ...this.buildConnectedAccountPayoutSettings(),
        metadata: {
          groomerProfileId: groomer.id,
          userId: groomer.userId,
        },
      });
    } catch (error) {
      throw this.wrapStripeError('create Stripe Connect account', error);
    }

    await this.prisma.groomerProfile.update({
      where: { id: groomer.id },
      data: {
        stripeConnectedAccountId: account.id,
        stripeConnectCountry: account.country ?? null,
        stripeConnectEmail: account.email ?? groomer.user.email,
        stripeOnboardingStartedAt: new Date(),
      },
    });

    return account.id;
  }

  private async configureConnectedAccountPayoutSchedule(accountId: string) {
    try {
      await this.stripe.accounts.update(
        accountId,
        this.buildConnectedAccountPayoutSettings(),
      );
    } catch (error) {
      throw this.wrapStripeError('configure Stripe payout schedule', error);
    }
  }

  private buildConnectedAccountPayoutSettings() {
    const interval = this.getPayoutInterval();
    const schedule: Record<string, unknown> = { interval };

    const delayDays = this.getPayoutDelayDays();
    if (interval !== 'manual' && delayDays !== undefined) {
      schedule.delay_days = delayDays;
    }

    if (interval === 'weekly') {
      schedule.weekly_payout_days = [this.getWeeklyPayoutDay()];
    }

    if (interval === 'monthly') {
      schedule.monthly_payout_days = [this.getMonthlyPayoutDay()];
    }

    return {
      settings: {
        payouts: {
          schedule,
        },
      },
    };
  }

  private getPayoutInterval(): StripePayoutInterval {
    const interval = (
      this.config.get<string>('STRIPE_CONNECT_PAYOUT_INTERVAL') || 'daily'
    )
      .trim()
      .toLowerCase();
    const allowed: StripePayoutInterval[] = [
      'daily',
      'weekly',
      'monthly',
      'manual',
    ];
    if (!allowed.includes(interval as StripePayoutInterval)) {
      throw new BadRequestException(
        'STRIPE_CONNECT_PAYOUT_INTERVAL must be one of: daily, weekly, monthly, manual',
      );
    }
    return interval as StripePayoutInterval;
  }

  private getPayoutDelayDays() {
    const raw = this.config
      .get<string>('STRIPE_CONNECT_PAYOUT_DELAY_DAYS')
      ?.trim()
      .toLowerCase();
    if (!raw) return 'minimum';
    if (raw === 'minimum') return raw;

    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > 31) {
      throw new BadRequestException(
        'STRIPE_CONNECT_PAYOUT_DELAY_DAYS must be minimum or a number from 0 to 31',
      );
    }
    return value;
  }

  private getWeeklyPayoutDay(): StripeWeeklyPayoutDay {
    const day = (
      this.config.get<string>('STRIPE_CONNECT_PAYOUT_WEEKLY_DAY') || 'friday'
    )
      .trim()
      .toLowerCase();
    const allowed: StripeWeeklyPayoutDay[] = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
    ];
    if (!allowed.includes(day as StripeWeeklyPayoutDay)) {
      throw new BadRequestException(
        'STRIPE_CONNECT_PAYOUT_WEEKLY_DAY must be one of: monday, tuesday, wednesday, thursday, friday',
      );
    }
    return day as StripeWeeklyPayoutDay;
  }

  private getMonthlyPayoutDay() {
    const raw =
      this.config.get<string>('STRIPE_CONNECT_PAYOUT_MONTHLY_DAY') || '1';
    const day = Number(raw);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new BadRequestException(
        'STRIPE_CONNECT_PAYOUT_MONTHLY_DAY must be a number from 1 to 31',
      );
    }
    return day;
  }

  private isConnectReady(groomer: {
    stripeConnectedAccountId?: string | null;
    stripeOnboardingCompleted?: boolean | null;
    stripeTransfersEnabled?: boolean | null;
    stripePayoutsEnabled?: boolean | null;
  }) {
    return Boolean(
      groomer.stripeConnectedAccountId &&
        groomer.stripeOnboardingCompleted &&
        groomer.stripeTransfersEnabled &&
        groomer.stripePayoutsEnabled,
    );
  }

  private mapConnectStatus(groomer: any) {
    return {
      connectedAccountId: groomer.stripeConnectedAccountId,
      onboardingCompleted: groomer.stripeOnboardingCompleted,
      transfersEnabled: groomer.stripeTransfersEnabled,
      payoutsEnabled: groomer.stripePayoutsEnabled,
      payoutSetupComplete: this.isConnectReady(groomer),
      onboardingStartedAt: groomer.stripeOnboardingStartedAt,
      onboardingCompletedAt: groomer.stripeOnboardingCompletedAt,
      connectCountry: groomer.stripeConnectCountry,
      connectEmail: groomer.stripeConnectEmail,
      availableForBookings: groomer.availableForBookings,
    };
  }

  private resolveConnectUrl(configKey: string, fallbackPath: string) {
    const direct = this.config.get<string>(configKey)?.trim();
    if (direct) {
      return direct;
    }

    const baseUrl =
      this.config.get<string>('PUBLIC_APP_URL')?.trim() ||
      this.config.get<string>('FRONTEND_URL')?.trim();
    if (!baseUrl) {
      throw new BadRequestException(
        `${configKey} is not configured for Stripe Connect onboarding`,
      );
    }

    return new URL(fallbackPath, this.withTrailingSlash(baseUrl)).toString();
  }

  private withTrailingSlash(value: string) {
    return value.endsWith('/') ? value : `${value}/`;
  }

  private getStripeErrorMessage(error: unknown) {
    const stripeError = error as { message?: string };
    return stripeError.message ?? 'Unknown Stripe error';
  }

  private wrapStripeError(action: string, error: unknown) {
    const message = this.getStripeErrorMessage(error);
    this.logger.error(
      `Stripe failed to ${action}: ${message}`,
      error instanceof Error ? error.stack : undefined,
    );
    return new BadGatewayException(`Stripe failed to ${action}: ${message}`);
  }
}
