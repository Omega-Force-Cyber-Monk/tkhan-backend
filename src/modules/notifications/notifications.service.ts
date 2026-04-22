import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { paginate, paginated } from '../../common/utils/pagination';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}
  async create(
    userId: string,
    type: any,
    title: string,
    body?: string,
    data?: any,
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, data },
    });
    this.gateway.emitToUser(userId, 'notification.created', notification);
    return notification;
  }
  async list(userId: string, dto: PaginationDto) {
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        ...paginate(dto.page, dto.limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginated(items, total, dto.page, dto.limit);
  }
  async markRead(userId: string, id: string) {
    return this.prisma.notification.update({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }
  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
