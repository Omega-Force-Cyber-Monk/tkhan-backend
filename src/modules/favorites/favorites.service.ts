import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}
  add(buyerId: string, groomerId: string) {
    return this.prisma.buyerFavoriteGroomer.upsert({
      where: { buyerId_groomerId: { buyerId, groomerId } },
      create: { buyerId, groomerId },
      update: {},
    });
  }
  remove(buyerId: string, groomerId: string) {
    return this.prisma.buyerFavoriteGroomer.delete({
      where: { buyerId_groomerId: { buyerId, groomerId } },
    });
  }
  list(buyerId: string) {
    return this.prisma.buyerFavoriteGroomer.findMany({
      where: { buyerId },
      include: { groomer: { include: { user: true, services: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
