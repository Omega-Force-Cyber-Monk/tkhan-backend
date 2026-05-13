import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { paginate, paginated } from '../../common/utils/pagination';
import {
  AddonQueryDto,
  CreateAddonDto,
  UpdateAddonDto,
} from './dto/addons.dto';

@Injectable()
export class AddonsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(userId: string, dto: CreateAddonDto) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    if (groomer.approvalStatus !== 'APPROVED')
      throw new ForbiddenException('Groomer approval required');
    return this.prisma.serviceAddon.create({
      data: { ...dto, groomerId: groomer.id, active: dto.active ?? true },
    });
  }
  async list(dto: AddonQueryDto) {
    const where: any = { ...(dto.groomerId && { groomerId: dto.groomerId }) };
    const [items, total] = await Promise.all([
      this.prisma.serviceAddon.findMany({
        where,
        ...paginate(dto.page, dto.limit),
        orderBy: { [dto.sortBy]: dto.sortOrder },
      }),
      this.prisma.serviceAddon.count({ where }),
    ]);
    return paginated(items, total, dto.page, dto.limit);
  }

  async listMine(userId: string, dto: AddonQueryDto) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    return this.list({ ...dto, groomerId: groomer.id });
  }

  async findMine(userId: string, id: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const addon = await this.prisma.serviceAddon.findUniqueOrThrow({
      where: { id },
      include: {
        serviceMappings: {
          include: {
            service: {
              include: { category: true },
            },
          },
        },
      },
    });
    if (addon.groomerId !== groomer.id)
      throw new ForbiddenException('Addon is owned by another groomer');
    return addon;
  }

  async update(userId: string, id: string, dto: UpdateAddonDto) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const addon = await this.prisma.serviceAddon.findUniqueOrThrow({
      where: { id },
    });
    if (addon.groomerId !== groomer.id)
      throw new ForbiddenException('Addon is owned by another groomer');
    return this.prisma.serviceAddon.update({ where: { id }, data: dto });
  }
  async remove(userId: string, id: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const addon = await this.prisma.serviceAddon.findUniqueOrThrow({
      where: { id },
    });
    if (addon.groomerId !== groomer.id)
      throw new ForbiddenException('Addon is owned by another groomer');
    return this.prisma.serviceAddon.update({
      where: { id },
      data: { active: false },
    });
  }
}
