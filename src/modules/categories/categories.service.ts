import { Injectable } from '@nestjs/common';
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
    return this.prisma.serviceCategory.create({ data: dto });
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
    return this.prisma.serviceCategory.update({ where: { id }, data: dto });
  }
  async remove(id: string) {
    return this.prisma.serviceCategory.update({
      where: { id },
      data: { active: false },
    });
  }
}
