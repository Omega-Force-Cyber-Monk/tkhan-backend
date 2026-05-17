import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { paginate, paginated } from '../../common/utils/pagination';
import {
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
