import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { paginate, paginated } from '../../common/utils/pagination';
import {
  CategoryGroomerQueryDto,
  CategoryQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/categories.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}
  async create(dto: CreateCategoryDto) {
    const data = this.cleanCategoryData(dto);
    if (!data.name) throw new BadRequestException('Category name is required');
    return this.prisma.serviceCategory.create({
      data: data as CreateCategoryDto,
    });
  }
  async list(dto: CategoryQueryDto) {
    const where: any = {
      ...(dto.search && {
        name: { contains: dto.search, mode: 'insensitive' },
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.serviceCategory.findMany({
        where,
        ...paginate(dto.page, dto.limit),
        orderBy: { [dto.sortBy]: dto.sortOrder },
      }),
      this.prisma.serviceCategory.count({ where }),
    ]);
    return paginated(items, total, dto.page, dto.limit);
  }
  async findOne(id: string) {
    return this.prisma.serviceCategory.findUniqueOrThrow({ where: { id } });
  }
  async groomers(categoryId: string, dto: CategoryGroomerQueryDto) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Category not found');

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
    const filters: any[] = [
      {
        services: {
          some: {
            categoryId,
            active: true,
            ...(dto.minPrice !== undefined || dto.maxPrice !== undefined
              ? {
                  price: {
                    ...(dto.minPrice !== undefined && { gte: dto.minPrice }),
                    ...(dto.maxPrice !== undefined && { lte: dto.maxPrice }),
                  },
                }
              : {}),
          },
        },
      },
    ];

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
                categoryId,
                active: true,
                OR: [
                  { title: { contains: search, mode: 'insensitive' } },
                  { description: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      });
    }

    const where: any = {
      approvalStatus: 'APPROVED',
      availableForBookings: true,
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
      AND: filters,
    };

    const [items, total] = await Promise.all([
      this.prisma.groomerProfile.findMany({
        where,
        ...paginate(page, limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: true,
          services: {
            where: { categoryId, active: true },
            include: { category: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.groomerProfile.count({ where }),
    ]);

    const ratings = items.length
      ? await this.prisma.review.groupBy({
          by: ['revieweeId'],
          where: {
            revieweeId: { in: items.map((groomer) => groomer.userId) },
            targetType: 'GROOMER',
          },
          _avg: { rating: true },
        })
      : [];
    const ratingByUserId = new Map(
      ratings.map((rating) => [rating.revieweeId, rating._avg.rating ?? 0]),
    );
    const groomers = items.map((groomer) => {
      const prices = groomer.services.map((service) => Number(service.price));
      return {
        ...groomer,
        averageRating: ratingByUserId.get(groomer.userId) ?? 0,
        priceRange: prices.length
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : null,
      };
    });
    const filtered =
      dto.minRating !== undefined
        ? groomers.filter((groomer) => groomer.averageRating >= dto.minRating!)
        : groomers;

    return paginated(
      filtered,
      dto.minRating !== undefined ? filtered.length : total,
      page,
      limit,
    );
  }
  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Category not found');

    const data = this.cleanCategoryData(dto);
    if (data.name) {
      const duplicate = await this.prisma.serviceCategory.findFirst({
        where: {
          id: { not: id },
          name: { equals: data.name, mode: 'insensitive' },
        },
      });
      if (duplicate)
        throw new BadRequestException('Category name already exists');
    }

    return this.prisma.serviceCategory.update({ where: { id }, data });
  }
  async remove(id: string) {
    return this.prisma.serviceCategory.update({
      where: { id },
      data: { active: false },
    });
  }

  private cleanCategoryData(dto: CreateCategoryDto | UpdateCategoryDto) {
    const data: any = {};
    const name = dto.name?.trim();
    const description = dto.description?.trim();
    const imageUrl = dto.imageUrl?.trim();

    if (name) data.name = name;
    if (description !== undefined) data.description = description || null;
    if (imageUrl) data.imageUrl = imageUrl;
    if (dto.active !== undefined) {
      data.active =
        typeof dto.active === 'string' ? dto.active === 'true' : dto.active;
    }

    return data;
  }
}
