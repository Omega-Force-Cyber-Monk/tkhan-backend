import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import {
  CancellationPolicyConfig,
  hoursUntil,
  loadCancellationPolicy,
  roundMoney,
} from './cancellation-policy';
import {
  AdminCancelBookingDto,
  AdminRefundBookingDto,
  CancelBookingDto,
} from './dto/bookings.dto';

export type CancellationActor = 'BUYER' | 'GROOMER' | 'ADMIN';

export interface CancellationQuote {
  bookingId: string;
  bookingNumber: string;
  actor: CancellationActor;
  status: string;
  canCancel: boolean;
  blockedReason: string | null;
  hoursUntilStart: number | null;
  paidAmount: number;
  refundPercent: number;
  refundAmount: number;
  lateFeeAmount: number;
  isLateCancellation: boolean;
  countsAsNoShow: boolean;
  currentNoShowCount: number | null;
  title: string;
  message: string;
  confirmLabel: string;
  keepLabel: string;
  warning: string | null;
}

const BUYER_CANCELLABLE = [
  'PAYMENT_PENDING',
  'PENDING',
  'REQUESTED',
  'ACCEPTED',
];
const GROOMER_CANCELLABLE = ['ACCEPTED'];
const ADMIN_CANCELLABLE = [
  'PAYMENT_PENDING',
  'PENDING',
  'REQUESTED',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETION_REQUESTED',
];
const PAID_STATUSES = ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'COMPLETED'];
const money = (value: number) => `$${value.toFixed(2)}`;

const bookingWithPolicyData = {
  availabilitySlot: { select: { id: true, startTime: true } },
  payments: { orderBy: { createdAt: 'desc' as const } },
  payouts: true,
  buyer: { select: { id: true, fullName: true } },
  groomer: {
    select: {
      id: true,
      fullName: true,
      groomerProfile: {
        select: { id: true, noShowCount: true, suspendedUntil: true },
      },
    },
  },
};

@Injectable()
export class BookingCancellationService {
  private readonly logger = new Logger(BookingCancellationService.name);
  private readonly policy: CancellationPolicyConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    this.policy = loadCancellationPolicy(config);
  }

  policySummary() {
    const p = this.policy;
    return {
      buyerFullRefundHours: p.buyerFullRefundHours,
      buyerLateCancelHours: p.buyerLateCancelHours,
      buyerLateRefundPercent: p.buyerLateRefundPercent,
      buyerMidWindowRefundPercent: p.buyerMidWindowRefundPercent,
      groomerNoShowHours: p.groomerNoShowHours,
      noShowSuspendAt: p.noShowSuspendAt,
      noShowBlockAt: p.noShowBlockAt,
      noShowSuspensionDays: p.noShowSuspensionDays,
      noShowWindowDays: p.noShowWindowDays,
    };
  }

  // ---------------------------------------------------------------- quotes

  async preview(userId: string, role: string, bookingId: string) {
    const booking = await this.loadBooking(bookingId);
    const actor = this.resolveActor(booking, userId, role);
    return this.buildQuote(booking, actor);
  }

  private async loadBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: bookingWithPolicyData,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private resolveActor(
    booking: any,
    userId: string,
    role: string,
  ): CancellationActor {
    if (role === 'ADMIN') return 'ADMIN';
    if (role === 'BUYER' && booking.buyerId === userId) return 'BUYER';
    if (role === 'GROOMER' && booking.groomerId === userId) return 'GROOMER';
    throw new ForbiddenException('You cannot cancel this booking');
  }

  private paidAmountOf(booking: any) {
    const payment = booking.payments.find((p: any) =>
      PAID_STATUSES.includes(p.status),
    );
    if (!payment) return { payment: null, refundable: 0 };
    const refundable = roundMoney(
      Number(payment.amount) - Number(payment.refundedAmount ?? 0),
    );
    return { payment, refundable: Math.max(refundable, 0) };
  }

  private buildQuote(
    booking: any,
    actor: CancellationActor,
  ): CancellationQuote {
    const hours = hoursUntil(
      booking.availabilitySlot?.startTime,
      this.policy.businessTimeZone,
    );
    const { refundable } = this.paidAmountOf(booking);
    const base: CancellationQuote = {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      actor,
      status: booking.status,
      canCancel: false,
      blockedReason: null,
      hoursUntilStart: hours,
      paidAmount: refundable,
      refundPercent: 0,
      refundAmount: 0,
      lateFeeAmount: 0,
      isLateCancellation: false,
      countsAsNoShow: false,
      currentNoShowCount: null,
      title: 'Cancel this appointment?',
      message: '',
      confirmLabel: 'Cancel Booking',
      keepLabel: 'Keep Booking',
      warning: null,
    };

    const allowed =
      actor === 'BUYER'
        ? BUYER_CANCELLABLE
        : actor === 'GROOMER'
          ? GROOMER_CANCELLABLE
          : ADMIN_CANCELLABLE;
    if (!allowed.includes(booking.status)) {
      base.blockedReason =
        actor === 'GROOMER' && ['PENDING', 'REQUESTED'].includes(booking.status)
          ? 'Use "Decline" for booking requests you have not accepted yet.'
          : `A booking with status ${booking.status} cannot be cancelled here. Please contact support.`;
      base.message = base.blockedReason;
      return base;
    }

    if (actor === 'BUYER')
      return this.buyerQuote(booking, base, hours, refundable);
    if (actor === 'GROOMER')
      return this.groomerQuote(booking, base, hours, refundable);

    // ADMIN default = policy as if the buyer cancelled.
    const asBuyer = this.buyerQuote(
      booking,
      { ...base },
      hours,
      refundable,
      true,
    );
    return {
      ...asBuyer,
      actor: 'ADMIN',
      canCancel: true,
      blockedReason: null,
      title: 'Cancel booking (admin)',
      confirmLabel: 'Cancel booking',
    };
  }

  private buyerQuote(
    booking: any,
    quote: CancellationQuote,
    hours: number | null,
    paid: number,
    ignoreStartGuard = false,
  ): CancellationQuote {
    const p = this.policy;
    if (!ignoreStartGuard && hours !== null && hours <= 0) {
      quote.blockedReason =
        'This appointment has already started. Please contact support for help.';
      quote.message = quote.blockedReason;
      return quote;
    }
    quote.canCancel = true;

    if (paid <= 0) {
      quote.title = 'Cancel this booking?';
      quote.message =
        booking.status === 'PAYMENT_PENDING'
          ? 'No payment has been taken for this booking yet. It will simply be cancelled.'
          : 'This booking will be cancelled. There is no payment to refund.';
      quote.confirmLabel = 'Cancel Booking';
      quote.refundPercent = 100;
      return quote;
    }

    let percent: number;
    if (['PENDING', 'REQUESTED'].includes(booking.status) || hours === null) {
      percent = 100; // groomer has not accepted yet
    } else if (hours >= p.buyerFullRefundHours) {
      percent = 100;
    } else if (hours < p.buyerLateCancelHours) {
      percent = p.buyerLateRefundPercent;
    } else {
      percent = p.buyerMidWindowRefundPercent;
    }
    percent = Math.min(Math.max(percent, 0), 100);
    const refund = roundMoney((paid * percent) / 100);
    quote.refundPercent = percent;
    quote.refundAmount = refund;
    quote.lateFeeAmount = roundMoney(paid - refund);
    quote.isLateCancellation = percent < 100;

    if (quote.isLateCancellation) {
      quote.title = 'Late Cancellation';
      quote.message = `Your appointment starts in less than ${hours !== null && hours < p.buyerLateCancelHours ? p.buyerLateCancelHours : p.buyerFullRefundHours} hours. Under Karoot's Cancellation & Refund Policy you will receive a ${percent}% refund (${money(refund)}). A ${100 - percent}% late cancellation fee (${money(quote.lateFeeAmount)}) applies.`;
      quote.confirmLabel = `Cancel & Receive ${percent}% Refund`;
    } else {
      quote.title = 'Cancel this appointment?';
      quote.message = ['PENDING', 'REQUESTED'].includes(booking.status)
        ? `Your groomer has not confirmed this booking yet, so you will receive a 100% refund (${money(refund)}).`
        : `You are cancelling ${p.buyerFullRefundHours}+ hours before your appointment, so you will receive a 100% refund (${money(refund)}).`;
      quote.confirmLabel = 'Cancel & Refund';
    }
    quote.warning =
      'Refunds go back to your original payment method and usually appear within 5-10 business days.';
    return quote;
  }

  private groomerQuote(
    booking: any,
    quote: CancellationQuote,
    hours: number | null,
    paid: number,
  ): CancellationQuote {
    const p = this.policy;
    quote.canCancel = true;
    quote.refundPercent = 100;
    quote.refundAmount = paid;
    quote.lateFeeAmount = 0;
    quote.confirmLabel = 'Confirm Cancellation';
    quote.keepLabel = 'Keep Booking';
    quote.currentNoShowCount =
      booking.groomer?.groomerProfile?.noShowCount ?? 0;

    const late = hours === null ? false : hours < p.groomerNoShowHours;
    quote.countsAsNoShow = late;
    quote.isLateCancellation = late;
    if (!late) {
      quote.title = 'Cancel this appointment?';
      quote.message = `You are cancelling ${p.groomerNoShowHours}+ hours before the appointment. This will NOT be counted as a No-Show. The customer will receive a 100% refund (${money(paid)}).`;
      return quote;
    }
    quote.title = 'Late Groomer Cancellation';
    quote.message = `This appointment is less than ${p.groomerNoShowHours} hours away. Cancelling now will be recorded as a Groomer No-Show and the customer will receive a full refund (${money(paid)}).`;
    quote.warning = `Repeated No-Shows lead to a warning, then a ${p.noShowSuspensionDays}-day suspension (at ${p.noShowSuspendAt} No-Shows), and a permanent block (at ${p.noShowBlockAt} No-Shows) within ${p.noShowWindowDays} days. You currently have ${quote.currentNoShowCount} No-Show(s) on record.`;
    return quote;
  }

  // ------------------------------------------------------------- actions

  async cancelByUser(
    userId: string,
    role: string,
    bookingId: string,
    dto: CancelBookingDto,
  ) {
    const booking = await this.loadBooking(bookingId);
    const actor = this.resolveActor(booking, userId, role);
    if (actor === 'ADMIN') {
      throw new BadRequestException(
        'Admins must use the admin cancel endpoint',
      );
    }
    const quote = this.buildQuote(booking, actor);
    if (!quote.canCancel) {
      throw new BadRequestException(quote.blockedReason ?? 'Cannot cancel');
    }
    return this.executeCancellation(booking, {
      actor,
      actorId: userId,
      refundAmount: quote.refundAmount,
      refundPercent: quote.refundPercent,
      isLate: quote.isLateCancellation,
      recordNoShow: quote.countsAsNoShow,
      hoursUntilStart: quote.hoursUntilStart,
      reason:
        dto.reason?.trim() ||
        (actor === 'BUYER' ? 'Cancelled by customer' : 'Cancelled by groomer'),
    });
  }

  async cancelByAdmin(
    adminId: string,
    bookingId: string,
    dto: AdminCancelBookingDto,
  ) {
    const booking = await this.loadBooking(bookingId);
    const quote = this.buildQuote(booking, 'ADMIN');
    if (!quote.canCancel) {
      throw new BadRequestException(quote.blockedReason ?? 'Cannot cancel');
    }
    if (
      booking.payouts?.some((p: any) =>
        ['TRANSFERRED', 'PAID_OUT'].includes(p.status),
      )
    ) {
      throw new BadRequestException(
        'The groomer payout for this booking was already transferred. Reverse the transfer in Stripe before refunding.',
      );
    }
    const paid = quote.paidAmount;
    let refundAmount: number;
    switch (dto.refundType) {
      case 'FULL':
        refundAmount = paid;
        break;
      case 'NONE':
        refundAmount = 0;
        break;
      case 'PARTIAL':
        if (!dto.refundAmount) {
          throw new BadRequestException(
            'refundAmount is required for a partial refund',
          );
        }
        refundAmount = roundMoney(dto.refundAmount);
        break;
      default:
        refundAmount = quote.refundAmount;
    }
    if (refundAmount > paid + 0.001) {
      throw new BadRequestException(
        `Refund amount cannot exceed the refundable balance of ${money(paid)}`,
      );
    }
    const percent = paid > 0 ? Math.round((refundAmount / paid) * 100) : 0;
    const result = await this.executeCancellation(booking, {
      actor: 'ADMIN',
      actorId: adminId,
      refundAmount,
      refundPercent: percent,
      isLate: percent < 100 && paid > 0,
      recordNoShow: Boolean(dto.recordGroomerNoShow),
      hoursUntilStart: quote.hoursUntilStart,
      reason: dto.reason,
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        targetUserId: booking.buyerId,
        action: 'BOOKING_CANCELLED_BY_ADMIN',
        note: dto.reason,
        metadata: {
          bookingId,
          refundType: dto.refundType,
          refundAmount,
          recordGroomerNoShow: Boolean(dto.recordGroomerNoShow),
        },
      },
    });
    return result;
  }

  /** Refund (full or partial) without changing a booking that is already closed or still active. */
  async refundByAdmin(
    adminId: string,
    bookingId: string,
    dto: AdminRefundBookingDto,
  ) {
    const booking = await this.loadBooking(bookingId);
    if (booking.status === 'COMPLETED') {
      throw new BadRequestException(
        'Completed bookings are paid out to the groomer. Refund them from the Stripe dashboard after reversing the payout.',
      );
    }
    if (
      booking.payouts?.some((p: any) =>
        ['TRANSFERRED', 'PAID_OUT'].includes(p.status),
      )
    ) {
      throw new BadRequestException(
        'The groomer payout for this booking was already transferred. Reverse the transfer in Stripe before refunding.',
      );
    }
    const { payment, refundable } = this.paidAmountOf(booking);
    if (!payment || refundable <= 0) {
      throw new BadRequestException(
        'There is no refundable payment on this booking',
      );
    }
    const amount =
      dto.refundType === 'FULL'
        ? refundable
        : roundMoney(dto.refundAmount ?? 0);
    if (amount <= 0 || amount > refundable + 0.001) {
      throw new BadRequestException(
        `Refund amount must be between $0.01 and ${money(refundable)}`,
      );
    }
    const refund = await this.refundPayment(booking, payment, amount, 'admin');
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        refundAmount: roundMoney(Number(booking.refundAmount ?? 0) + amount),
        ...(amount >= refundable - 0.001 &&
          ['CANCELLED', 'REJECTED'].includes(booking.status) && {
            refundedAt: new Date(),
          }),
      },
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        targetUserId: booking.buyerId,
        action: 'BOOKING_REFUNDED_BY_ADMIN',
        note: dto.reason,
        metadata: { bookingId, refundType: dto.refundType, amount },
      },
    });
    await this.notifications.create(
      booking.buyerId,
      'PAYMENT_REFUND',
      'Refund Processed',
      `A refund of ${money(amount)} for booking ${booking.bookingNumber} is on its way.`,
      {
        targetScreen: 'booking_details',
        bookingId,
        refundId: refund?.id ?? null,
      },
    );
    return { bookingId, refundAmount: amount, refundId: refund?.id ?? null };
  }

  private async refundPayment(
    booking: any,
    payment: any,
    amount: number,
    source: string,
  ) {
    const alreadyRefunded = Number(payment.refundedAmount ?? 0);
    const totalRefunded = roundMoney(alreadyRefunded + amount);
    const fully = totalRefunded >= Number(payment.amount) - 0.001;
    const refund =
      payment.stripePaymentIntentId && amount > 0
        ? await this.payments.issueStripeRefund({
            paymentIntentId: payment.stripePaymentIntentId,
            amountInCents: Math.round(amount * 100),
            idempotencyKey: `refund-${booking.id}-${source}-${Math.round(totalRefunded * 100)}`,
            metadata: {
              bookingId: booking.id,
              paymentId: payment.id,
              source,
            },
          })
        : null;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: fully ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundedAmount: totalRefunded,
        stripeRefundId: refund?.id ?? payment.stripeRefundId,
        refundedAt: new Date(),
      },
    });
    return refund;
  }

  private async executeCancellation(
    booking: any,
    opts: {
      actor: CancellationActor;
      actorId: string;
      refundAmount: number;
      refundPercent: number;
      isLate: boolean;
      recordNoShow: boolean;
      hoursUntilStart: number | null;
      reason: string;
    },
  ) {
    const previousStatus = booking.status;
    // 1. Claim the booking atomically so a double tap can't refund twice.
    const claimed = await this.prisma.booking.updateMany({
      where: { id: booking.id, status: previousStatus },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: opts.actor,
        cancelledById: opts.actorId,
        cancellationReason: opts.reason,
      },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException(
        'This booking was updated by someone else. Please refresh and try again.',
      );
    }

    // 2. Money.
    const { payment, refundable } = this.paidAmountOf(booking);
    let refund: any = null;
    const refundAmount = Math.min(opts.refundAmount, refundable);
    try {
      if (payment && refundAmount > 0) {
        refund = await this.refundPayment(
          booking,
          payment,
          refundAmount,
          'cancel',
        );
      }
      if (!payment) {
        // Unpaid booking: make sure the open PaymentIntent can't be charged later.
        for (const open of booking.payments) {
          if (open.stripePaymentIntentId) {
            await this.payments.cancelOpenPaymentIntent(
              open.stripePaymentIntentId,
            );
          }
        }
        await this.prisma.payment.updateMany({
          where: {
            bookingId: booking.id,
            status: { in: ['PAYMENT_PENDING', 'PENDING', 'REQUIRES_ACTION'] },
          },
          data: {
            status: 'FAILED',
            failureReason: 'Booking cancelled before payment',
          },
        });
      }
    } catch (error) {
      // Roll back the claim so the user can retry.
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: previousStatus,
          cancelledAt: null,
          cancelledBy: null,
          cancelledById: null,
          cancellationReason: null,
        },
      });
      throw error;
    }

    const lateFee = payment ? roundMoney(refundable - refundAmount) : 0;
    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        refundPercent: payment ? opts.refundPercent : null,
        refundAmount: payment ? refundAmount : null,
        lateFeeAmount: payment ? lateFee : null,
        isLateCancellation: opts.isLate,
        ...(payment && refundAmount >= refundable - 0.001 && refundAmount > 0
          ? { refundedAt: new Date() }
          : {}),
      },
    });
    if (booking.availabilitySlotId) {
      await this.prisma.groomerAvailabilitySlot.updateMany({
        where: { id: booking.availabilitySlotId },
        data: { isBooked: false },
      });
    }

    // 3. Groomer no-show tracking.
    let noShow: unknown = null;
    if (opts.recordNoShow) {
      noShow = await this.recordNoShow(
        booking,
        opts.hoursUntilStart,
        opts.reason,
      );
    }

    // 4. Notifications (best effort).
    await this.notifyCancellation(
      booking,
      updated,
      opts,
      refundAmount,
      lateFee,
      refund?.id ?? null,
    ).catch((error) =>
      this.logger.warn(
        `Cancellation notifications failed for ${booking.id}: ${error instanceof Error ? error.message : error}`,
      ),
    );

    return {
      booking: updated,
      refundAmount,
      lateFeeAmount: lateFee,
      refundId: refund?.id ?? null,
      noShow,
    };
  }

  // -------------------------------------------------------- no-show logic

  private async recordNoShow(
    booking: any,
    hoursUntilStart: number | null,
    reason: string,
  ) {
    const profile = booking.groomer?.groomerProfile;
    if (!profile) return null;
    const p = this.policy;
    const windowStart = new Date(Date.now() - p.noShowWindowDays * 86400000);

    const existing = await this.prisma.groomerNoShow.findUnique({
      where: { bookingId: booking.id },
    });
    if (existing) return existing;

    const recentCount =
      (await this.prisma.groomerNoShow.count({
        where: {
          groomerProfileId: profile.id,
          createdAt: { gte: windowStart },
        },
      })) + 1;
    const action =
      recentCount >= p.noShowBlockAt
        ? 'BLOCK'
        : recentCount >= p.noShowSuspendAt
          ? 'SUSPENSION'
          : 'WARNING';

    const record = await this.prisma.groomerNoShow.create({
      data: {
        groomerProfileId: profile.id,
        bookingId: booking.id,
        hoursBeforeStart: hoursUntilStart ?? 0,
        reason,
        actionTaken: action,
      },
    });
    const suspendedUntil =
      action === 'SUSPENSION'
        ? new Date(Date.now() + p.noShowSuspensionDays * 86400000)
        : undefined;
    await this.prisma.groomerProfile.update({
      where: { id: profile.id },
      data: {
        noShowCount: { increment: 1 },
        lastNoShowAt: new Date(),
        ...(action !== 'WARNING' && { availableForBookings: false }),
        ...(suspendedUntil && { suspendedUntil }),
      },
    });
    if (action === 'BLOCK') {
      await this.prisma.user.update({
        where: { id: booking.groomerId },
        data: { isBlocked: true },
      });
    }

    const groomerMessage =
      action === 'WARNING'
        ? `A late cancellation on booking ${booking.bookingNumber} was recorded as a No-Show (${recentCount} in the last ${p.noShowWindowDays} days). Further No-Shows lead to suspension.`
        : action === 'SUSPENSION'
          ? `Your account is suspended from new bookings until ${suspendedUntil!.toISOString().slice(0, 10)} after ${recentCount} No-Shows in ${p.noShowWindowDays} days.`
          : `Your account has been blocked after ${recentCount} No-Shows in ${p.noShowWindowDays} days. Please contact support.`;
    await this.notifications
      .create(
        booking.groomerId,
        'ADMIN_ACTION',
        action === 'WARNING'
          ? 'No-Show Warning'
          : action === 'SUSPENSION'
            ? 'Account Suspended'
            : 'Account Blocked',
        groomerMessage,
        {
          targetScreen: 'booking_details',
          bookingId: booking.id,
          noShowAction: action,
        },
      )
      .catch(() => null);
    await this.notifications
      .createForAdmins(
        'ADMIN_ACTION',
        `Groomer No-Show (${action})`,
        `${booking.groomer?.fullName ?? 'A groomer'} cancelled booking ${booking.bookingNumber} late. No-Shows in window: ${recentCount}.`,
        {
          targetScreen: 'booking_details',
          bookingId: booking.id,
          groomerId: booking.groomerId,
          noShowAction: action,
        },
      )
      .catch(() => null);
    return { ...record, recentCount, suspendedUntil: suspendedUntil ?? null };
  }

  async listNoShows() {
    return this.prisma.groomerNoShow.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        booking: {
          select: { id: true, bookingNumber: true, cancelledAt: true },
        },
        groomerProfile: {
          select: {
            id: true,
            noShowCount: true,
            suspendedUntil: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                isBlocked: true,
              },
            },
          },
        },
      },
    });
  }

  async liftGroomerSuspension(
    adminId: string,
    groomerProfileId: string,
    note?: string,
  ) {
    const profile = await this.prisma.groomerProfile.update({
      where: { id: groomerProfileId },
      data: { suspendedUntil: null },
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        targetUserId: profile.userId,
        action: 'GROOMER_SUSPENSION_LIFTED',
        note: note ?? null,
      },
    });
    return profile;
  }

  private async notifyCancellation(
    booking: any,
    updated: any,
    opts: { actor: CancellationActor; reason: string },
    refundAmount: number,
    lateFee: number,
    refundId: string | null,
  ) {
    const data = { targetScreen: 'booking_details', bookingId: booking.id };
    const refundLine =
      refundAmount > 0
        ? ` A refund of ${money(refundAmount)} is on its way${lateFee > 0 ? ` (late cancellation fee ${money(lateFee)})` : ''}.`
        : '';
    const byWhom =
      opts.actor === 'BUYER'
        ? 'the customer'
        : opts.actor === 'GROOMER'
          ? 'your groomer'
          : 'Karoot support';

    if (opts.actor !== 'BUYER') {
      await this.notifications.create(
        booking.buyerId,
        'BOOKING_CANCELLED',
        'Appointment Cancelled',
        `Your appointment ${booking.bookingNumber} was cancelled by ${byWhom}.${refundLine}`,
        data,
      );
    } else if (refundAmount > 0) {
      await this.notifications.create(
        booking.buyerId,
        'PAYMENT_REFUND',
        'Refund Processed',
        `Your booking was cancelled.${refundLine}`,
        { ...data, refundId },
      );
    }
    if (opts.actor !== 'GROOMER' && booking.status !== 'PAYMENT_PENDING') {
      await this.notifications.create(
        booking.groomerId,
        'BOOKING_CANCELLED',
        'Appointment Cancelled',
        `${opts.actor === 'BUYER' ? (booking.buyer?.fullName ?? 'The customer') : 'Karoot support'} cancelled appointment ${booking.bookingNumber}.`,
        data,
      );
    }
    await this.notifications.createForAdmins(
      'BOOKING_CANCELLED',
      'Booking Cancelled',
      `Booking ${booking.bookingNumber} was cancelled by ${opts.actor.toLowerCase()}. Refund: ${money(refundAmount)}. Reason: ${opts.reason}`,
      {
        ...data,
        buyerId: booking.buyerId,
        groomerId: booking.groomerId,
        refundId,
      },
    );
    this.notifications.emitBookingUpdated(
      [booking.buyerId, booking.groomerId],
      {
        bookingId: booking.id,
        status: updated.status,
        updatedAt: updated.updatedAt,
        buyerId: booking.buyerId,
        groomerId: booking.groomerId,
        refundId,
        reason: opts.reason,
      },
    );
  }
}
