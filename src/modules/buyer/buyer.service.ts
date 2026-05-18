import {
  Injectable,
  Logger,
  NotFoundException,
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
  async searchGroomers(dto: GroomerSearchDto, buyerId?: string) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const search = dto.search?.trim();
    const state = dto.state?.trim();
    const sortBy = [
      'createdAt',
      'updatedAt',
      'businessName',
      'experienceYears',
    ].includes(dto.sortBy)
      ? dto.sortBy
      : 'createdAt';
    const sortOrder = dto.sortOrder ?? 'desc';
    const filters: any[] = [];
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
    if (search) {
      filters.push({
        OR: [
          { businessName: { contains: search, mode: 'insensitive' } },
          { serviceArea: { contains: search, mode: 'insensitive' } },
          { businessAddress: { contains: search, mode: 'insensitive' } },
          { shortBio: { contains: search, mode: 'insensitive' } },
          { about: { contains: search, mode: 'insensitive' } },
          { user: { fullName: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { locationText: { contains: search, mode: 'insensitive' } } },
          {
            services: {
              some: {
                active: true,
                OR: [
                  { title: { contains: search, mode: 'insensitive' } },
                  { description: { contains: search, mode: 'insensitive' } },
                  {
                    category: {
                      name: { contains: search, mode: 'insensitive' },
                    },
                  },
                ],
              },
            },
          },
        ],
      });
    }
    if (serviceFilterRequested) {
      filters.push({
        services: {
          some: {
            active: true,
            ...(dto.serviceId && { id: dto.serviceId }),
            ...(dto.categoryId && { categoryId: dto.categoryId }),
            ...priceFilter,
          },
        },
      });
    }
    const where: any = {
      approvalStatus: 'APPROVED',
      user: {
        isBlocked: false,
        status: 'ACTIVE',
        ...(state && {
          OR: [
            { state: { equals: state, mode: 'insensitive' } },
            { locationText: { contains: state, mode: 'insensitive' } },
          ],
        }),
      },
      ...(filters.length && { AND: filters }),
    };
    let items;
    try {
      items = await this.prisma.groomerProfile.findMany({
        where,
        ...paginate(page, limit),
        orderBy: [
          { availableForBookings: 'desc' },
          { [sortBy]: sortOrder },
        ],
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
    const favoriteByGroomerId = new Set<string>();
    try {
      const favoritesPromise: Promise<Array<{ groomerId: string }>> = buyerId
        ? this.prisma.buyerFavoriteGroomer.findMany({
            where: {
              buyerId,
              groomerId: { in: items.map((g) => g.id) },
            },
            select: { groomerId: true },
          })
        : Promise.resolve([]);
      const [ratings, favorites] = await Promise.all([
        this.prisma.review.groupBy({
          by: ['revieweeId'],
          where: {
            revieweeId: { in: items.map((g) => g.userId) },
            targetType: 'GROOMER',
          },
          _avg: { rating: true },
        }),
        favoritesPromise,
      ]);
      ratings.forEach((rating) => {
        ratingByUserId.set(rating.revieweeId, rating._avg.rating ?? 0);
      });
      favorites.forEach((favorite) => {
        favoriteByGroomerId.add(favorite.groomerId);
      });
    } catch (error) {
      this.logger.warn(
        `Could not load groomer ratings/favorites for buyer search. Falling back to defaults. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const groomers = items.map((g) => {
      const prices = g.services.map((s) => Number(s.price));
      return {
        ...g,
        isFavorite: favoriteByGroomerId.has(g.id),
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
  async groomerProfile(id: string, buyerId?: string) {
    const groomer = await this.prisma.groomerProfile.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
        approvalStatus: 'APPROVED',
        user: { isBlocked: false, status: 'ACTIVE' },
      },
      include: {
        user: true,
        services: {
          include: {
            category: true,
            addonMappings: { include: { addon: true } },
          },
        },
        availability: {
          where: { isAvailable: true },
          include: {
            slots: {
              where: { isBooked: false },
              orderBy: { startTime: 'asc' },
            },
          },
          orderBy: { date: 'asc' },
        },
      },
    });
    if (!groomer) {
      throw new NotFoundException('Groomer not found');
    }
    const isFavorite = buyerId
      ? Boolean(
          await this.prisma.buyerFavoriteGroomer.findUnique({
            where: {
              buyerId_groomerId: {
                buyerId,
                groomerId: groomer.id,
              },
            },
            select: { id: true },
          }),
        )
      : false;
    return {
      ...groomer,
      isFavorite,
    };
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
