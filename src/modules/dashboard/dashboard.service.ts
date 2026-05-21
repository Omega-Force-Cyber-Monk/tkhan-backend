import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { sanitizeUser } from '../../common/utils/sanitize-user';
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
        _sum: { platformFee: true },
      }),
      this.prisma.user.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
    ]);
    const bookingTrend = await this.prisma.booking.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const revenueTrend = await this.prisma.payout.groupBy({
      by: ['currency'],
      _sum: { platformFee: true },
    });
    return {
      totalUsers,
      activeGroomers,
      todaysBookings,
      totalPlatformRevenue: revenue._sum.platformFee ?? 0,
      bookingTrend,
      revenueTrend,
      recentUserRegistrations: recentUserRegistrations.map((user) =>
        sanitizeUser(user),
      ),
    };
  }

  async trends(days: number) {
    const bookingTrend = await this.prisma.$queryRaw<
      Array<{ day: string; count: bigint }>
    >(Prisma.sql`
      SELECT
        to_char(days.day, 'YYYY-MM-DD') AS day,
        COUNT(b.id)::bigint AS count
      FROM generate_series(
        date_trunc('day', now()) - (${days - 1} * interval '1 day'),
        date_trunc('day', now()),
        interval '1 day'
      ) AS days(day)
      LEFT JOIN "Booking" b
        ON date_trunc('day', b."createdAt") = days.day
      GROUP BY days.day
      ORDER BY days.day
    `);

    const revenueTrend = await this.prisma.$queryRaw<
      Array<{ day: string; revenue: Prisma.Decimal | null }>
    >(Prisma.sql`
      SELECT
        to_char(days.day, 'YYYY-MM-DD') AS day,
        COALESCE(SUM(p."platformFee"), 0) AS revenue
      FROM generate_series(
        date_trunc('day', now()) - (${days - 1} * interval '1 day'),
        date_trunc('day', now()),
        interval '1 day'
      ) AS days(day)
      LEFT JOIN "Payout" p
        ON date_trunc('day', p."createdAt") = days.day
      GROUP BY days.day
      ORDER BY days.day
    `);

    return {
      days,
      bookingTrend: bookingTrend.map((item) => ({
        day: item.day,
        count: Number(item.count),
      })),
      revenueTrend: revenueTrend.map((item) => ({
        day: item.day,
        revenue: item.revenue ? item.revenue.toString() : '0',
      })),
    };
  }
}
