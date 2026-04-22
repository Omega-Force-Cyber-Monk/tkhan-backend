import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}
  async overview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [
      totalUsers,
      activeGroomers,
      todaysBookings,
      revenue,
      recentUserRegistrations,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.groomerProfile.count({
        where: { approvalStatus: 'APPROVED', availableForBookings: true },
      }),
      this.prisma.booking.count({ where: { createdAt: { gte: today } } }),
      this.prisma.payout.aggregate({
        where: { status: 'PAID' },
        _sum: { platformFee: true },
      }),
      this.prisma.user.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
    ]);
    const bookingTrend = await this.prisma.booking.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const revenueTrend = await this.prisma.payout.groupBy({
      by: ['status'],
      _sum: { platformFee: true },
    });
    return {
      totalUsers,
      activeGroomers,
      todaysBookings,
      totalPlatformRevenue: revenue._sum.platformFee ?? 0,
      bookingTrend,
      revenueTrend,
      recentUserRegistrations,
    };
  }
}
