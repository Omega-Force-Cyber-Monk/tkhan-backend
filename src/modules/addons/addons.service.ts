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
    await this.assertServiceOwnedByGroomer(groomer.id, dto.serviceId);
    const { serviceId, ...addonData } = dto;
    return this.prisma.serviceAddon.create({
      data: {
        ...addonData,
        groomerId: groomer.id,
        active: dto.active ?? true,
        serviceMappings: {
          create: { serviceId },
        },
      },
      include: {
        serviceMappings: {
          include: {
            service: { include: { category: true } },
          },
        },
      },
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
    const { serviceId, ...addonData } = dto;
    if (serviceId)
      await this.assertServiceOwnedByGroomer(groomer.id, serviceId);
    return this.prisma.$transaction(async (tx) => {
      if (serviceId) {
        await tx.serviceAddonMapping.deleteMany({ where: { addonId: id } });
        await tx.serviceAddonMapping.create({
          data: { addonId: id, serviceId },
        });
      }
      return tx.serviceAddon.update({
        where: { id },
        data: addonData,
        include: {
          serviceMappings: {
            include: {
              service: { include: { category: true } },
            },
          },
        },
      });
    });
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

  private async assertServiceOwnedByGroomer(
    groomerId: string,
    serviceId: string,
  ) {
    const service = await this.prisma.service.findUniqueOrThrow({
      where: { id: serviceId },
    });
    if (service.groomerId !== groomerId)
      throw new ForbiddenException('Service is owned by another groomer');
  }
}
