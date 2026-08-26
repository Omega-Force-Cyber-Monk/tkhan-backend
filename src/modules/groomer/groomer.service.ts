import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PayoutsService } from '../payouts/payouts.service';
import { UpdateGroomerProfileDto } from './dto/groomer.dto';
@Injectable()
export class GroomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payouts: PayoutsService,
  ) {}
  async updateProfile(userId: string, dto: UpdateGroomerProfileDto) {
    const {
      fullName,
      phone,
      profileImage,
      streetAddress,
      unitSuite,
      city,
      province,
      postalCode,
      ...profile
    } = dto;
    if (profile.availableForBookings === true) {
      await this.assertCanEnableBookings(userId);
    }
    const userUpdateData: any = {};
    if (fullName !== undefined) userUpdateData.fullName = fullName;
    if (phone !== undefined) userUpdateData.phone = phone;
    if (profileImage !== undefined) userUpdateData.profileImage = profileImage;
    if (streetAddress !== undefined) userUpdateData.streetAddress = streetAddress;
    if (unitSuite !== undefined) userUpdateData.unitSuite = unitSuite;
    if (city !== undefined) userUpdateData.city = city;
    if (province !== undefined) userUpdateData.province = province;
    if (postalCode !== undefined) userUpdateData.postalCode = postalCode;

    if (Object.keys(userUpdateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    }
    return this.prisma.groomerProfile.update({
      where: { userId },
      data: profile as any,
      include: { user: true },
    });
  }
  async toggleBookingAvailability(userId: string, availableForBookings: boolean) {
    if (availableForBookings) {
      await this.assertCanEnableBookings(userId);
    }
    return this.prisma.groomerProfile.update({
      where: { userId },
      data: { availableForBookings },
      include: { user: true },
    });
  }
  async dashboard(userId: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const [totalBookings, completedBookings, cancelledBookings, ratingAgg] =
      await Promise.all([
        this.prisma.booking.count({ where: { groomerId: userId } }),
        this.prisma.booking.count({
          where: { groomerId: userId, status: 'COMPLETED' },
        }),
        this.prisma.booking.count({
          where: { groomerId: userId, status: 'CANCELLED' },
        }),
        this.prisma.review.aggregate({
          where: { revieweeId: userId, targetType: 'GROOMER' },
          _avg: { rating: true },
        }),
      ]);
    return {
      groomerId: groomer.id,
      totalBookings,
      completedBookings,
      cancelledBookings,
      averageRating: ratingAgg._avg.rating ?? 0,
      connectStatus: await this.payouts.connectStatus(userId),
    };
  }
  async earnings(userId: string) {
    return this.payouts.summary(userId);
  }

  private async assertCanEnableBookings(userId: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
      include: {
        _count: {
          select: {
            services: { where: { active: true } },
          },
        },
      },
    });
    if (groomer.approvalStatus !== 'APPROVED') {
      throw new BadRequestException('Groomer approval required');
    }
    this.payouts.assertGroomerPayoutSetupComplete(groomer);
    if (groomer._count.services === 0) {
      throw new BadRequestException(
        'Add at least one active service before enabling availability',
      );
    }
    const futureSlotCount = await this.prisma.groomerAvailabilitySlot.count({
      where: {
        isBooked: false,
        startTime: { gt: new Date() },
        availability: {
          groomerId: groomer.id,
          isAvailable: true,
        },
      },
    });
    if (futureSlotCount === 0) {
      throw new BadRequestException(
        'Add at least one future availability slot before enabling availability',
      );
    }
  }
}
