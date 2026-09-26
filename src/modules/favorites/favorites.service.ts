import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { sanitizePublicGroomer } from '../../common/utils/privacy';
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async update(buyerId: string, groomerId: string, isFavorite: boolean) {
    if (isFavorite) {
      const favorite = await this.prisma.buyerFavoriteGroomer.upsert({
        where: { buyerId_groomerId: { buyerId, groomerId } },
        create: { buyerId, groomerId },
        update: {},
      });

      return {
        ...favorite,
        isFavorite: true,
      };
    }

    await this.prisma.buyerFavoriteGroomer.deleteMany({
      where: { buyerId, groomerId },
    });

    return {
      buyerId,
      groomerId,
      isFavorite: false,
    };
  }

  async list(buyerId: string) {
    const favorites = await this.prisma.buyerFavoriteGroomer.findMany({
      where: { buyerId },
      include: { groomer: { include: { user: true, services: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return favorites.map((favorite) => ({
      ...favorite,
      groomer: sanitizePublicGroomer(favorite.groomer),
    }));
  }
}
