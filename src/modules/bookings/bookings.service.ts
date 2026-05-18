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
  locationText: true,
  state: true,
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
      const [pet, groomer, service, slot] = await Promise.all([
        tx.pet.findUniqueOrThrow({ where: { id: dto.petId } }),
        tx.groomerProfile.findUniqueOrThrow({
          where: { id: dto.groomerId },
          include: { user: true },
        }),
        tx.service.findUniqueOrThrow({
          where: { id: dto.serviceId },
          include: { category: true, addonMappings: true },
        }),
        tx.groomerAvailabilitySlot.findUniqueOrThrow({
          where: { id: dto.availabilitySlotId },
          include: { availability: true },
        }),
      ]);
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
      const subtotal =
        Number(service.price) +
        addons.reduce((sum, addon) => sum + Number(addon.price), 0);
      const platformFee = Number((subtotal * 0.1).toFixed(2));
      const groomerEarning = Number((subtotal - platformFee).toFixed(2));
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
          subtotalAmount: subtotal,
          platformFeeAmount: platformFee,
          groomerEarningAmount: groomerEarning,
          totalAmount: subtotal,
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
        },
        include: { services: true, addons: true },
      });
      await tx.groomerAvailabilitySlot.update({
        where: { id: slot.id },
        data: { isBooked: true },
      });
      return booking;
    });
  }

  async listForUser(userId: string, role: string, dto: BookingQueryDto) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const where: any = {
      ...(role === 'BUYER'
        ? { buyerId: userId }
        : role === 'GROOMER'
          ? { groomerId: userId }
          : {}),
      ...(dto.status && { status: dto.status }),
      ...(dto.today && {
        availabilitySlot: {
          availability: {
            date: {
              gte: todayStart,
              lt: tomorrowStart,
            },
          },
        },
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        ...paginate(dto.page, dto.limit),
        orderBy: { [dto.sortBy]: dto.sortOrder },
        include: {
          services: true,
          addons: true,
          pet: true,
          buyer: { select: bookingBuyerSelect },
          groomer: { select: bookingGroomerSelect },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginated(items, total, dto.page, dto.limit);
  }

  async detail(userId: string, role: string, id: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: {
        services: true,
        addons: true,
        pet: true,
        buyer: { select: bookingBuyerSelect },
        groomer: { select: bookingGroomerSelect },
        payments: true,
        payouts: { orderBy: { createdAt: 'desc' } },
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
    return {
      ...booking,
      earnings: {
        subtotalAmount: booking.subtotalAmount,
        platformFeeAmount: booking.platformFeeAmount,
        groomerEarningAmount: booking.groomerEarningAmount,
        totalAmount: booking.totalAmount,
        payoutId: latestPayout?.id ?? null,
        payoutStatus: latestPayout?.status ?? null,
        payoutReleasedAt: latestPayout?.releasedAt ?? null,
      },
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
      { bookingId: id },
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
      { bookingId: id },
    );
    return this.payments.refundBooking(id, dto.reason);
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
      { bookingId: id },
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
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await this.notifications.create(
      updated.groomerId,
      'BOOKING_COMPLETED',
      'Booking completed',
      'The buyer approved completion.',
      { bookingId: id },
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
