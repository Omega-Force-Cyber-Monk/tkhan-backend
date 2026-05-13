import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { paginate, paginated } from '../../common/utils/pagination';
import {
  CreateServiceDto,
  ServiceQueryDto,
  UpdateServiceDto,
} from './dto/services.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateServiceDto) {
    const groomer = await this.getApprovedGroomer(userId);
    return this.prisma.service.create({
      data: {
        groomerId: groomer.id,
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        price: dto.price,
        active: dto.active ?? true,
      },
      include: { category: true },
    });
  }

  async list(dto: ServiceQueryDto) {
    const where: any = {
      ...(dto.categoryId && { categoryId: dto.categoryId }),
      ...(dto.groomerId && { groomerId: dto.groomerId }),
      ...(dto.search && {
        title: { contains: dto.search, mode: 'insensitive' },
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        ...paginate(dto.page, dto.limit),
        orderBy: { [dto.sortBy]: dto.sortOrder },
        include: {
          category: true,
        },
      }),
      this.prisma.service.count({ where }),
    ]);
    return paginated(items, total, dto.page, dto.limit);
  }

  async listWithAddons(dto: ServiceQueryDto) {
    const where: any = {
      ...(dto.categoryId && { categoryId: dto.categoryId }),
      ...(dto.groomerId && { groomerId: dto.groomerId }),
      ...(dto.search && {
        title: { contains: dto.search, mode: 'insensitive' },
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        ...paginate(dto.page, dto.limit),
        orderBy: { [dto.sortBy]: dto.sortOrder },
        include: {
          category: true,
          addonMappings: {
            include: { addon: true },
          },
        },
      }),
      this.prisma.service.count({ where }),
    ]);
    return paginated(
      items.map(({ addonMappings, ...service }) => ({
        ...service,
        addons: addonMappings.map(({ addon }) => addon),
      })),
      total,
      dto.page,
      dto.limit,
    );
  }

  async listMine(userId: string, dto: ServiceQueryDto) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    return this.list({ ...dto, groomerId: groomer.id });
  }

  async findMine(userId: string, id: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const service = await this.prisma.service.findUniqueOrThrow({
      where: { id },
      include: {
        category: true,
      },
    });
    if (service.groomerId !== groomer.id)
      throw new ForbiddenException('Service is owned by another groomer');
    return service;
  }

  async findMineWithAddons(userId: string, id: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const service = await this.findWithAddons(id);
    if (service.groomerId !== groomer.id)
      throw new ForbiddenException('Service is owned by another groomer');
    return service;
  }

  async findOne(id: string) {
    return this.prisma.service.findUniqueOrThrow({
      where: { id },
      include: { category: true },
    });
  }

  async findWithAddons(id: string) {
    return this.prisma.service.findUniqueOrThrow({
      where: { id },
      include: {
        category: true,
        addonMappings: {
          include: { addon: true },
        },
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateServiceDto) {
    const groomer = await this.getApprovedGroomer(userId);
    const service = await this.prisma.service.findUniqueOrThrow({
      where: { id },
    });
    if (service.groomerId !== groomer.id)
      throw new ForbiddenException('Service is owned by another groomer');
    return this.prisma.service.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        price: dto.price,
        active: dto.active,
      },
      include: {
        category: true,
      },
    });
  }

  async remove(userId: string, id: string) {
    const groomer = await this.getApprovedGroomer(userId);
    const service = await this.prisma.service.findUniqueOrThrow({
      where: { id },
    });
    if (service.groomerId !== groomer.id)
      throw new ForbiddenException('Service is owned by another groomer');
    return this.prisma.service.update({
      where: { id },
      data: { active: false },
    });
  }

  private async getApprovedGroomer(userId: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    if (groomer.approvalStatus !== 'APPROVED')
      throw new ForbiddenException('Groomer approval required');
    return groomer;
  }
}
