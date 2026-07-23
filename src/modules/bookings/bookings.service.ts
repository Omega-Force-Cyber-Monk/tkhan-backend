import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { paginate, paginated } from '../../common/utils/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import { renderNotificationTemplate } from '../notifications/notification-templates';
import { ReviewReminderService } from '../notifications/review-reminder.service';
import { PaymentsService } from '../payments/payments.service';
import { PayoutsService } from '../payouts/payouts.service';
import {
  BookingDecisionDto,
  BookingQueryDto,
  CompletionRequestDto,
  CreateBookingDto,
  UploadBookingImagesDto,
} from './dto/bookings.dto';

const bookingBuyerSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  profileImage: true,
  streetAddress: true,
  unitSuite: true,
  city: true,
  province: true,
  postalCode: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

const bookingGroomerSelect = {
  ...bookingBuyerSelect,
  groomerProfile: {
    select: {
      id: true,
      businessName: true,
      serviceArea: true,
      businessAddress: true,
      gstHstRegistrationNumber: true,
      experienceYears: true,
      shortBio: true,
      about: true,
      certifications: true,
      serviceModes: true,
      availableForBookings: true,
      approvalStatus: true,
      stripeConnectedAccountId: true,
      stripeOnboardingCompleted: true,
      stripeTransfersEnabled: true,
      stripePayoutsEnabled: true,
    },
  },
};

const bookingAvailabilitySlotInclude = {
  select: {
    id: true,
    startTime: true,
    endTime: true,
    isBooked: true,
    availability: {
      select: {
        id: true,
        date: true,
        isAvailable: true,
      },
    },
  },
};

const bookingPayoutInclude = {
  orderBy: { createdAt: 'desc' as const },
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
    private readonly payouts: PayoutsService,
    private readonly reviewReminders: ReviewReminderService,
  ) {}

  async create(buyerId: string, dto: CreateBookingDto) {
    return this.prisma.$transaction(async (tx) => {
      const pet = await tx.pet.findUnique({ where: { id: dto.petId } });
      if (!pet) {
        throw new NotFoundException('Selected pet was not found');
      }

      const groomer = await tx.groomerProfile.findUnique({
        where: { id: dto.groomerId },
        include: { user: true },
      });
      if (!groomer) {
        throw new NotFoundException('Selected groomer was not found');
      }

      const service = await tx.service.findUnique({
        where: { id: dto.serviceId },
        include: { category: true, addonMappings: true },
      });
      if (!service) {
        throw new NotFoundException('Selected service was not found');
      }

      const slot = await tx.groomerAvailabilitySlot.findUnique({
        where: { id: dto.availabilitySlotId },
        include: { availability: true },
      });
      if (!slot) {
        throw new NotFoundException('Selected availability slot was not found');
      }

      if (pet.buyerId !== buyerId) {
        throw new ForbiddenException(
          'You can only create a booking with a pet from your own account',
        );
      }
      if (groomer.user.isBlocked) {
        throw new BadRequestException(
          'This groomer account is blocked and cannot receive bookings',
        );
      }
      if (groomer.approvalStatus !== 'APPROVED') {
        throw new BadRequestException(
          'This groomer is still waiting for admin approval',
        );
      }
      if (!groomer.availableForBookings) {
        throw new BadRequestException(
          'This groomer has currently disabled booking availability',
        );
      }
      this.payouts.assertGroomerPayoutSetupComplete(groomer);
      if (service.groomerId !== groomer.id) {
        throw new BadRequestException(
          'Selected service does not belong to this groomer',
        );
      }
      if (!service.active) {
        throw new BadRequestException(
          'Selected service is currently inactive',
        );
      }
      if (slot.availability.groomerId !== groomer.id) {
        throw new BadRequestException(
          'Selected availability slot does not belong to this groomer',
        );
      }
      if (!slot.availability.isAvailable) {
        throw new BadRequestException(
          'Selected availability date is currently unavailable',
        );
      }
      if (slot.isBooked) {
        throw new BadRequestException(
          'Selected availability slot has already been booked',
        );
      }
      const addons = dto.addonIds?.length
        ? await tx.serviceAddon.findMany({
            where: {
              id: { in: dto.addonIds },
              groomerId: groomer.id,
              active: true,
              serviceMappings: { some: { serviceId: service.id } },
            },
          })
        : [];
      if ((dto.addonIds?.length ?? 0) !== addons.length) {
        throw new BadRequestException(
          'One or more selected add-ons are invalid for this service',
        );
      }
      const pricing = await tx.platformSetting.findUnique({
        where: { id: 'platform' },
      });
      const subtotal =
        Number(service.price) +
        addons.reduce((sum, addon) => sum + Number(addon.price), 0);
      const serviceChargePercent = Number(pricing?.serviceChargeAmount ?? 0);
      const serviceCharge = Number(
        ((subtotal * serviceChargePercent) / 100).toFixed(2),
      );
      const platformFee = serviceCharge;
      const groomerEarning = Number(subtotal.toFixed(2));
      const totalAmount = Number((subtotal + serviceCharge).toFixed(2));
      const booking = await tx.booking.create({
        data: {
          bookingNumber: 'BK-' + Date.now(),
          buyerId,
          groomerId: groomer.userId,
          petId: dto.petId,
          availabilitySlotId: slot.id,
          serviceLocation: dto.serviceLocation,
          addressLine: dto.addressLine,
          state: dto.state,
          city: dto.city,
          postalCode: dto.postalCode,
          note: dto.note,
          status: 'PENDING',
          subtotalAmount: subtotal,
          serviceChargeAmount: serviceCharge,
          platformFeeAmount: platformFee,
          groomerEarningAmount: groomerEarning,
          totalAmount,
          services: {
            create: {
              serviceId: service.id,
              serviceTitle: service.title,
              serviceDescription: service.description,
              durationMinutes: service.durationMinutes,
              price: service.price,
              categoryName: service.category.name,
            },
          },
          addons: {
            create: addons.map((addon) => ({
              addonId: addon.id,
              addonTitle: addon.title,
              addonDescription: addon.description,
              durationMinutes: addon.durationMinutes,
              price: addon.price,
            })),
          },
          payments: {
            create: {
              amount: totalAmount,
              status: 'PAYMENT_PENDING',
            },
          },
        },
        include: { services: true, addons: true, payments: true },
      });
      await tx.groomerAvailabilitySlot.update({
        where: { id: slot.id },
        data: { isBooked: true },
      });
      return booking;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });
  }

  async listForUser(userId: string, role: string, dto: BookingQueryDto) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const andConditions: any[] = [];

    if (role === 'BUYER') {
      andConditions.push({ buyerId: userId });
    } else if (role === 'GROOMER') {
      andConditions.push({ groomerId: userId });
    }

    if (dto.status) {
      andConditions.push({ status: dto.status });
    }

    if (dto.today === true) {
      andConditions.push({
        availabilitySlot: {
          startTime: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
      });
    } else if (dto.today === false) {
      andConditions.push({
        OR: [
          { availabilitySlotId: null },
          {
            availabilitySlot: {
              OR: [
                { startTime: { lt: todayStart } },
                { startTime: { gte: tomorrowStart } },
              ],
            },
          },
        ],
      });
    }

    const where: any =
      andConditions.length > 0 ? { AND: andConditions } : {};
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        ...paginate(dto.page, dto.limit),
        orderBy: { [dto.sortBy]: dto.sortOrder },
        include: {
          availabilitySlot: bookingAvailabilitySlotInclude,
          services: true,
          addons: true,
          pet: true,
          buyer: { select: bookingBuyerSelect },
          groomer: { select: bookingGroomerSelect },
          payouts: bookingPayoutInclude,
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginated(
      items.map((booking) => this.withEarnings(booking)),
      total,
      dto.page,
      dto.limit,
    );
  }

  async detail(userId: string, role: string, id: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: {
        availabilitySlot: bookingAvailabilitySlotInclude,
        services: true,
        addons: true,
        pet: true,
        buyer: { select: bookingBuyerSelect },
        groomer: { select: bookingGroomerSelect },
        payments: true,
        payouts: bookingPayoutInclude,
        reviews: true,
      },
    });
    if (
      role !== 'ADMIN' &&
      booking.buyerId !== userId &&
      booking.groomerId !== userId
    )
      throw new ForbiddenException('Booking access denied');
    return this.withEarnings(booking);
  }

  private withEarnings(booking: any) {
    const latestPayout = booking.payouts?.[0] ?? null;
    const scheduledDate = booking.availabilitySlot?.availability?.date ?? null;
    const payoutSummary = this.summarizePayout(latestPayout);
    return {
      ...booking,
      scheduledDate,
      earnings: {
        subtotalAmount: booking.subtotalAmount,
        serviceChargeAmount: booking.serviceChargeAmount,
        platformFeeAmount: booking.platformFeeAmount,
        groomerEarningAmount: booking.groomerEarningAmount,
        totalAmount: booking.totalAmount,
        payoutId: latestPayout?.id ?? null,
        payoutStatus: payoutSummary.status,
        payoutPaidOutAt: payoutSummary.paidOutAt,
        payoutReservedAmount: payoutSummary.reservedAmount,
        payoutPaidAmount: payoutSummary.paidAmount,
        payoutAvailableAmount: payoutSummary.availableAmount,
        payoutTransferredAt: payoutSummary.transferredAt,
        payoutFailureReason: payoutSummary.failureReason,
      },
    };
  }

  private summarizePayout(payout: any) {
    if (!payout) {
      return {
        status: null,
        paidOutAt: null,
        reservedAmount: 0,
        paidAmount: 0,
        availableAmount: 0,
        transferredAt: null,
        failureReason: null,
      };
    }
    const amount = Number(payout.amount);
    const isTransferred = ['TRANSFERRED', 'PAID_OUT'].includes(payout.status);
    const availableAmount = isTransferred ? 0 : amount;
    const paidAmount = isTransferred ? amount : 0;

    return {
      status: payout.status,
      paidOutAt: payout.payoutPaidOutAt ?? null,
      reservedAmount: 0,
      paidAmount,
      availableAmount,
      transferredAt: payout.transferredAt ?? null,
      failureReason: payout.failureReason ?? null,
    };
  }

  async accept(groomerId: string, id: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: {
        groomer: true,
        availabilitySlot: true,
      },
    });
    if (booking.groomerId !== groomerId)
      throw new ForbiddenException('Booking belongs to another groomer');
    if (!['PENDING', 'REQUESTED'].includes(booking.status))
      throw new BadRequestException('Only pending bookings can be accepted');
    await this.payments.syncPaymentStatusForBooking(id).catch(() => null);
    const paidPayment = await this.prisma.payment.findFirst({
      where: {
        bookingId: id,
        status: 'SUCCEEDED',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!paidPayment) {
      throw new BadRequestException(
        'Buyer payment has not been completed yet',
      );
    }
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    const notification = renderNotificationTemplate('BUYER_BOOKING_CONFIRMED', {
      GroomerName: booking.groomer.fullName,
      Date: this.formatNotificationDate(booking.availabilitySlot?.startTime),
      Time: this.formatNotificationTime(booking.availabilitySlot?.startTime),
    });
    await this.notifications.create(
      updated.buyerId,
      'BOOKING_ACCEPTED',
      notification.title,
      notification.body,
      { targetScreen: 'booking_details', bookingId: id },
    );
    this.notifications.emitBookingUpdated(
      [updated.buyerId, updated.groomerId],
      {
        bookingId: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt,
        buyerId: updated.buyerId,
        groomerId: updated.groomerId,
      },
    );
    return updated;
  }

  async reject(groomerId: string, id: string, dto: BookingDecisionDto) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { groomer: true },
    });
    if (booking.groomerId !== groomerId)
      throw new ForbiddenException('Booking belongs to another groomer');
    if (!['PENDING', 'REQUESTED'].includes(booking.status))
      throw new BadRequestException('Only pending bookings can be rejected');
    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: dto.reason,
      },
    });
    if (booking.availabilitySlotId)
      await this.prisma.groomerAvailabilitySlot.update({
        where: { id: booking.availabilitySlotId },
        data: { isBooked: false },
      });
    const buyerNotification = renderNotificationTemplate(
      'BUYER_BOOKING_DECLINED',
      {
        GroomerName: booking.groomer.fullName,
      },
    );
    await this.notifications.create(
      booking.buyerId,
      'BOOKING_REJECTED',
      buyerNotification.title,
      buyerNotification.body,
      { targetScreen: 'booking_details', bookingId: id },
    );
    this.notifications.emitBookingUpdated(
      [booking.buyerId, booking.groomerId],
      {
        bookingId: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt,
        buyerId: updated.buyerId,
        groomerId: updated.groomerId,
        reason: dto.reason,
      },
    );
    const adminNotification = renderNotificationTemplate(
      'ADMIN_BOOKING_REJECTED',
    );
    await this.notifications.createForAdmins(
      'BOOKING_REJECTED',
      adminNotification.title,
      dto.reason ?? adminNotification.body,
      {
        targetScreen: 'booking_details',
        bookingId: id,
        buyerId: booking.buyerId,
        groomerId: booking.groomerId,
      },
    );
    return this.payments.refundBooking(id, dto.reason, 'REJECTED');
  }

  async markInProgress(
    groomerId: string,
    id: string,
    beforeImage?: string,
  ) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { pet: true },
    });
    if (booking.groomerId !== groomerId) {
      throw new ForbiddenException('Booking belongs to another groomer');
    }
    if (booking.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Only accepted bookings can be marked in progress',
      );
    }
    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        inProgressAt: new Date(),
        ...(beforeImage && { beforeImage }),
      },
    });
    const notification = renderNotificationTemplate('BUYER_APPOINTMENT_STARTED', {
      PetName: booking.pet.name,
    });
    await this.notifications.create(
      updated.buyerId,
      'BOOKING_ACCEPTED',
      notification.title,
      notification.body,
      { targetScreen: 'booking_details', bookingId: id },
    );
    this.notifications.emitBookingUpdated(
      [updated.buyerId, updated.groomerId],
      {
        bookingId: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt,
        buyerId: updated.buyerId,
        groomerId: updated.groomerId,
      },
    );
    return updated;
  }

  async requestCompletion(
    groomerId: string,
    id: string,
    dto: CompletionRequestDto,
    afterImage?: string,
  ) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
    });
    if (booking.groomerId !== groomerId)
      throw new ForbiddenException('Booking belongs to another groomer');
    if (!['ACCEPTED', 'IN_PROGRESS'].includes(booking.status))
      throw new BadRequestException(
        'Booking cannot request completion from current status',
      );
    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'COMPLETION_REQUESTED',
        completionRequestedAt: new Date(),
        completionNote: dto.note,
        ...(afterImage && { afterImage }),
      },
    });
    const buyerNotification = renderNotificationTemplate(
      'BUYER_COMPLETION_REQUESTED',
    );
    await this.notifications.create(
      updated.buyerId,
      'COMPLETION_REQUESTED',
      buyerNotification.title,
      buyerNotification.body,
      { targetScreen: 'booking_details', bookingId: id },
    );
    this.notifications.emitBookingUpdated(
      [updated.buyerId, updated.groomerId],
      {
        bookingId: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt,
        buyerId: updated.buyerId,
        groomerId: updated.groomerId,
      },
    );
    const adminNotification = renderNotificationTemplate(
      'ADMIN_COMPLETION_REQUESTED',
    );
    await this.notifications.createForAdmins(
      'COMPLETION_REQUESTED',
      adminNotification.title,
      adminNotification.body,
      {
        targetScreen: 'booking_details',
        bookingId: id,
        buyerId: updated.buyerId,
        groomerId: updated.groomerId,
      },
    );
    return updated;
  }

  async approveCompletion(userId: string, role: string, id: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
    });
    if (role !== 'ADMIN' && booking.buyerId !== userId)
      throw new ForbiddenException('Booking belongs to another buyer');
    if (booking.status !== 'COMPLETION_REQUESTED')
      throw new BadRequestException(
        'Booking is not awaiting completion approval',
      );
    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
      this.prisma.payment.updateMany({
        where: {
          bookingId: id,
          status: 'SUCCEEDED',
        },
        data: { status: 'COMPLETED' },
      }),
    ]);
    const groomerNotification = renderNotificationTemplate(
      'GROOMER_BOOKING_COMPLETED',
    );
    await this.notifications.create(
      updated.groomerId,
      'BOOKING_COMPLETED',
      groomerNotification.title,
      groomerNotification.body,
      { targetScreen: 'booking_details', bookingId: id },
    );
    this.notifications.emitBookingUpdated(
      [updated.buyerId, updated.groomerId],
      {
        bookingId: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt,
        buyerId: updated.buyerId,
        groomerId: updated.groomerId,
        approvedByRole: role,
        approvedById: userId,
      },
    );
    await this.payouts.releaseForBooking(id);
    const adminNotification = renderNotificationTemplate('ADMIN_BOOKING_COMPLETED');
    await this.notifications.createForAdmins(
      'BOOKING_COMPLETED',
      adminNotification.title,
      adminNotification.body,
      {
        targetScreen: 'booking_details',
        bookingId: id,
        buyerId: updated.buyerId,
        groomerId: updated.groomerId,
        approvedByRole: role,
        approvedById: userId,
      },
    );
    await this.reviewReminders.sendReviewRequest(id);
    return updated;
  }

  async uploadImages(
    groomerId: string,
    id: string,
    dto: UploadBookingImagesDto,
  ) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
    });
    if (booking.groomerId !== groomerId)
      throw new ForbiddenException('Booking belongs to another groomer');
    if (booking.status !== 'IN_PROGRESS')
      throw new BadRequestException(
        'Images can only be uploaded when booking is in progress',
      );
    if (!dto.beforeImage && !dto.afterImage)
      throw new BadRequestException('At least one image must be provided');
    const updateData: any = {};
    if (dto.beforeImage) updateData.beforeImage = dto.beforeImage;
    if (dto.afterImage) updateData.afterImage = dto.afterImage;
    return this.prisma.booking.update({
      where: { id },
      data: updateData,
    });
  }

  private formatNotificationDate(value?: Date | null) {
    if (!value) return undefined;
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(value);
  }

  private formatNotificationTime(value?: Date | null) {
    if (!value) return undefined;
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    }).format(value);
  }
}
