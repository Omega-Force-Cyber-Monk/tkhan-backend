import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePetDto, UpdatePetDto } from './dto/pets.dto';
@Injectable()
export class PetsService {
  constructor(private readonly prisma: PrismaService) {}
  create(buyerId: string, dto: CreatePetDto) {
    return this.prisma.pet.create({ data: { ...dto, buyerId } });
  }
  list(buyerId: string) {
    return this.prisma.pet.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
    });
  }
  async update(buyerId: string, id: string, dto: UpdatePetDto) {
    await this.assertOwner(buyerId, id);
    return this.prisma.pet.update({ where: { id }, data: dto });
  }
  async remove(buyerId: string, id: string) {
    await this.assertOwner(buyerId, id);
    return this.prisma.pet.delete({ where: { id } });
  }
  private async assertOwner(buyerId: string, id: string) {
    const pet = await this.prisma.pet.findUniqueOrThrow({ where: { id } });
    if (pet.buyerId !== buyerId)
      throw new ForbiddenException('Pet is owned by another buyer');
  }
}
