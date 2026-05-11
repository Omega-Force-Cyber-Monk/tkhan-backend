import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { paginate, paginated } from '../../common/utils/pagination';
import { GroomerSearchDto } from './dto/buyer.dto';
@Injectable()
export class BuyerService {
  private readonly logger = new Logger(BuyerService.name);

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
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const sortBy = [
      'createdAt',
      'updatedAt',
      'businessName',
      'experienceYears',
    ].includes(dto.sortBy)
      ? dto.sortBy
      : 'createdAt';
    const sortOrder = dto.sortOrder ?? 'desc';
    const serviceFilterRequested =
      dto.serviceId !== undefined ||
      dto.categoryId !== undefined ||
      dto.minPrice !== undefined ||
      dto.maxPrice !== undefined;
    const priceFilter =
      dto.minPrice !== undefined || dto.maxPrice !== undefined
        ? {
            price: {
              ...(dto.minPrice !== undefined && { gte: dto.minPrice }),
              ...(dto.maxPrice !== undefined && { lte: dto.maxPrice }),
            },
          }
        : {};
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
      ...(serviceFilterRequested && {
        services: {
          some: {
            active: true,
            ...(dto.serviceId && { id: dto.serviceId }),
            ...(dto.categoryId && { categoryId: dto.categoryId }),
            ...priceFilter,
          },
        },
      }),
    };
    let items;
    try {
      items = await this.prisma.groomerProfile.findMany({
        where,
        ...paginate(page, limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: true,
          services: { where: { active: true }, include: { category: true } },
        },
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }

    let total = items.length;
    try {
      total = await this.prisma.groomerProfile.count({ where });
    } catch (error) {
      this.logger.warn(
        `Could not count groomers for buyer search. Falling back to current page count. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const ratingByUserId = new Map<string, number>();
    try {
      const ratings = await this.prisma.review.groupBy({
        by: ['revieweeId'],
        where: {
          revieweeId: { in: items.map((g) => g.userId) },
          targetType: 'GROOMER',
        },
        _avg: { rating: true },
      });
      ratings.forEach((rating) => {
        ratingByUserId.set(rating.revieweeId, rating._avg.rating ?? 0);
      });
    } catch (error) {
      this.logger.warn(
        `Could not load groomer ratings for buyer search. Falling back to zero ratings. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const groomers = items.map((g) => {
      const prices = g.services.map((s) => Number(s.price));
      return {
        ...g,
        averageRating: ratingByUserId.get(g.userId) ?? 0,
        priceRange: prices.length
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : null,
      };
    });
    const filtered =
      dto.minRating !== undefined
        ? groomers.filter((g) => g.averageRating >= dto.minRating!)
        : groomers;
    return paginated(
      filtered,
      dto.minRating !== undefined ? filtered.length : total,
      page,
      limit,
    );
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

  private handleDatabaseError(error: unknown): never {
    const dbError = error as { code?: string; message?: string };
    const connectionErrorCodes = new Set([
      'EAI_AGAIN',
      'ECONNREFUSED',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
    ]);

    if (dbError.code && connectionErrorCodes.has(dbError.code)) {
      this.logger.error(
        `Database connection failed while searching groomers. code=${dbError.code}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        `Database connection failed (${dbError.code}). Check DATABASE_URL and database network access.`,
      );
    }

    throw error;
  }
}
