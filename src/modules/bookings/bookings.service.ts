import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { paginate, paginated } from '../../common/utils/pagination';
import { NotificationsService } from '../notifications/notifications.service';
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
      experienceYears: true,
      shortBio: true,
      about: true,
      certifications: true,
      serviceModes: true,
      availableForBookings: true,
      approvalStatus: true,
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
  include: {
    withdrawalItems: {
      include: {
        withdrawalRequest: {
          select: {
            status: true,
            paidAt: true,
          },
        },
      },
    },
  },
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
    private readonly payouts: PayoutsService,
  ) {}

  async create(buyerId: string, dto: CreateBookingDto) {
    return this.prisma.$transaction(async (tx) => {
      const pet = await tx.pet.findUniqueOrThrow({ where: { id: dto.petId } });
      const groomer = await tx.groomerProfile.findUniqueOrThrow({
        where: { id: dto.groomerId },
        include: { user: true },
      });
      const service = await tx.service.findUniqueOrThrow({
        where: { id: dto.serviceId },
        include: { category: true, addonMappings: true },
      });
      const slot = await tx.groomerAvailabilitySlot.findUniqueOrThrow({
        where: { id: dto.availabilitySlotId },
        include: { availability: true },
      });
      if (pet.buyerId !== buyerId)
        throw new ForbiddenException('Pet belongs to another buyer');
      if (
        groomer.approvalStatus !== 'APPROVED' ||
        !groomer.availableForBookings ||
        groomer.user.isBlocked
      )
        throw new BadRequestException('Groomer is not available for bookings');
      if (service.groomerId !== groomer.id || !service.active)
        throw new BadRequestException('Invalid service for groomer');
      if (
        slot.isBooked ||
        !slot.availability.isAvailable ||
        slot.availability.groomerId !== groomer.id
      )
        throw new BadRequestException('Selected slot is not available');
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
      if ((dto.addonIds?.length ?? 0) !== addons.length)
        throw new BadRequestException('One or more add-ons are invalid');
      const pricing = await tx.platformSetting.findUnique({
        where: { id: 'platform' },
      });
      const subtotal =
        Number(service.price) +
        addons.reduce((sum, addon) => sum + Number(addon.price), 0);
      const serviceCharge = Number(pricing?.serviceChargeAmount ?? 0);
      const platformFee = Number((subtotal * 0.1).toFixed(2));
      const groomerEarning = Number((subtotal - platformFee).toFixed(2));
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
      };
    }

    const paidItems = payout.withdrawalItems.filter(
      (item: any) => item.withdrawalRequest.status === 'PAID',
    );
    const reservedItems = payout.withdrawalItems.filter((item: any) =>
      ['REQUESTED', 'APPROVED'].includes(item.withdrawalRequest.status),
    );
    const paidAmount = paidItems.reduce(
      (sum: number, item: any) => sum + Number(item.allocatedAmount),
      0,
    );
    const reservedAmount = reservedItems.reduce(
      (sum: number, item: any) => sum + Number(item.allocatedAmount),
      0,
    );
    const availableAmount = Number(
      (Number(payout.amount) - paidAmount - reservedAmount).toFixed(2),
    );
    const latestPaidAt = paidItems
      .map((item: any) => item.withdrawalRequest.paidAt)
      .filter(Boolean)
      .sort(
        (a: Date, b: Date) =>
          new Date(a).getTime() - new Date(b).getTime(),
      )
      .at(-1);

    let status = 'PENDING';
    if (availableAmount <= 0 && paidAmount >= Number(payout.amount)) {
      status = 'PAID';
    } else if (reservedAmount > 0 || paidAmount > 0) {
      status = 'PROCESSING';
    }

    return {
      status,
      paidOutAt: latestPaidAt ?? null,
      reservedAmount,
      paidAmount,
      availableAmount,
    };
  }

  async accept(groomerId: string, id: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
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
    await this.notifications.create(
      updated.buyerId,
      'BOOKING_ACCEPTED',
      'Booking accepted',
      'Your groomer accepted the booking.',
      { targetScreen: 'booking_details', bookingId: id },
    );
    return updated;
  }

  async reject(groomerId: string, id: string, dto: BookingDecisionDto) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
    });
    if (booking.groomerId !== groomerId)
      throw new ForbiddenException('Booking belongs to another groomer');
    if (!['PENDING', 'REQUESTED'].includes(booking.status))
      throw new BadRequestException('Only pending bookings can be rejected');
    await this.prisma.booking.update({
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
    await this.notifications.create(
      booking.buyerId,
      'BOOKING_REJECTED',
      'Booking rejected',
      dto.reason,
      { targetScreen: 'booking_details', bookingId: id },
    );
    return this.payments.refundBooking(id, dto.reason, 'REJECTED');
  }

  async markInProgress(groomerId: string, id: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
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
      data: { status: 'IN_PROGRESS', inProgressAt: new Date() },
    });
    await this.notifications.create(
      updated.buyerId,
      'BOOKING_ACCEPTED',
      'Service in progress',
      'Your groomer has started working on the booking.',
      { targetScreen: 'booking_details', bookingId: id },
    );
    return updated;
  }

  async requestCompletion(
    groomerId: string,
    id: string,
    dto: CompletionRequestDto,
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
      },
    });
    await this.notifications.create(
      updated.buyerId,
      'COMPLETION_REQUESTED',
      'Completion requested',
      'Please approve completion if the service is done.',
      { targetScreen: 'booking_details', bookingId: id },
    );
    return updated;
  }

  async approveCompletion(buyerId: string, id: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
    });
    if (booking.buyerId !== buyerId)
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
    await this.notifications.create(
      updated.groomerId,
      'BOOKING_COMPLETED',
      'Booking completed',
      'The buyer approved completion.',
      { targetScreen: 'booking_details', bookingId: id },
    );
    await this.payouts.releaseForBooking(id);
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
}
