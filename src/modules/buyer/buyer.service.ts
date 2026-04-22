import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { paginate, paginated } from '../../common/utils/pagination';
import { GroomerSearchDto } from './dto/buyer.dto';
@Injectable()
export class BuyerService {
  constructor(private readonly prisma: PrismaService) {}
  async home(userId?: string, state?: string) {
    const [categories, groomers] = await Promise.all([
      this.prisma.serviceCategory.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      }),
      this.searchGroomers({
        page: 1,
        limit: 12,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        state,
      }),
    ]);
    return { categories, groomers, userId };
  }
  async searchGroomers(dto: GroomerSearchDto) {
    const where: any = {
      approvalStatus: 'APPROVED',
      availableForBookings: true,
      user: {
        isBlocked: false,
        status: 'ACTIVE',
        ...(dto.state && { state: dto.state }),
        ...(dto.search && {
          fullName: { contains: dto.search, mode: 'insensitive' },
        }),
      },
      services: {
        some: {
          active: true,
          ...(dto.categoryId && { categoryId: dto.categoryId }),
          ...(dto.minPrice !== undefined && { price: { gte: dto.minPrice } }),
          ...(dto.maxPrice !== undefined && { price: { lte: dto.maxPrice } }),
        },
      },
    };
    const [items, total] = await Promise.all([
      this.prisma.groomerProfile.findMany({
        where,
        ...paginate(dto.page, dto.limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          services: { where: { active: true }, include: { category: true } },
        },
      }),
      this.prisma.groomerProfile.count({ where }),
    ]);
    const groomers = await Promise.all(
      items.map(async (g) => {
        const rating = await this.prisma.review.aggregate({
          where: { revieweeId: g.userId, targetType: 'GROOMER' },
          _avg: { rating: true },
        });
        const prices = g.services.map((s) => Number(s.price));
        return {
          ...g,
          averageRating: rating._avg.rating ?? 0,
          priceRange: prices.length
            ? { min: Math.min(...prices), max: Math.max(...prices) }
            : null,
        };
      }),
    );
    const filtered =
      dto.minRating !== undefined
        ? groomers.filter((g) => g.averageRating >= dto.minRating!)
        : groomers;
    return paginated(filtered, total, dto.page, dto.limit);
  }
  groomerProfile(id: string) {
    return this.prisma.groomerProfile.findUniqueOrThrow({
      where: { id },
      include: {
        user: true,
        services: {
          include: {
            category: true,
            addonMappings: { include: { addon: true } },
          },
        },
        availability: { include: { slots: true } },
      },
    });
  }
}
