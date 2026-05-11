import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateGroomerProfileDto } from './dto/groomer.dto';
@Injectable()
export class GroomerService {
  constructor(private readonly prisma: PrismaService) {}
  async updateProfile(userId: string, dto: UpdateGroomerProfileDto) {
    const { fullName, phone, profileImage, ...profile } = dto;
    await this.prisma.user.update({
      where: { id: userId },
      data: { fullName, phone, profileImage },
    });
    return this.prisma.groomerProfile.update({
      where: { userId },
      data: profile as any,
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
    };
  }
  async earnings(userId: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [recentTransactions, week, month, payoutHistory] = await Promise.all([
      this.prisma.payout.findMany({
        where: { groomerId: groomer.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.payout.aggregate({
        where: {
          groomerId: groomer.id,
          status: 'PAID',
          createdAt: { gte: weekStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.payout.aggregate({
        where: {
          groomerId: groomer.id,
          status: 'PAID',
          createdAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.payout.findMany({
        where: { groomerId: groomer.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      recentTransactions,
      thisWeekIncome: week._sum.amount ?? 0,
      thisMonthIncome: month._sum.amount ?? 0,
      payoutHistory,
    };
  }
}
