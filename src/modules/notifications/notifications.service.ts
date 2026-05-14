import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { paginate, paginated } from '../../common/utils/pagination';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RegisterPushTokenDto } from './dto/notifications.dto';
import { FirebasePushService } from './firebase-push.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly firebasePush: FirebasePushService,
  ) {}

  dummyList(userId: string) {
    const now = new Date();
    return paginated(
      [
        {
          id: 'dummy-notification-1',
          userId,
          type: 'BOOKING_ACCEPTED',
          title: 'Booking accepted',
          body: 'Your grooming booking has been accepted.',
          data: { bookingId: 'dummy-booking-id', bookingNumber: 'BK-DEMO-001' },
          readAt: null,
          createdAt: now,
        },
        {
          id: 'dummy-notification-2',
          userId,
          type: 'NEW_MESSAGE',
          title: 'New message',
          body: 'You have a new message about your booking.',
          data: { conversationId: 'dummy-conversation-id' },
          readAt: now,
          createdAt: new Date(now.getTime() - 60 * 60 * 1000),
        },
      ],
      2,
      1,
      20,
    );
  }

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
    await this.sendPush(userId, title, body, {
      notificationId: notification.id,
      type,
      ...data,
    });
    return notification;
  }

  async registerPushToken(userId: string, dto: RegisterPushTokenDto) {
    return this.prisma.pushDeviceToken.upsert({
      where: { token: dto.token },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
      },
      update: {
        userId,
        platform: dto.platform,
      },
    });
  }

  async unregisterPushToken(userId: string, token: string) {
    return this.prisma.pushDeviceToken.deleteMany({
      where: { userId, token },
    });
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
    if (total === 0) return this.dummyList(userId);
    return paginated(items, total, dto.page, dto.limit);
  }
  async markRead(userId: string, id: string) {
    const readAt = new Date();
    if (id.startsWith('dummy-notification-')) {
      const dummy = this.dummyList(userId).items.find(
        (notification) => notification.id === id,
      );
      return {
        ...(dummy ?? {
          id,
          userId,
          type: 'ADMIN_ACTION',
          title: 'Notification',
          body: null,
          data: null,
          createdAt: readAt,
        }),
        readAt,
      };
    }

    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt },
    });
    if (result.count === 0) {
      return {
        id,
        userId,
        readAt,
        updated: false,
      };
    }

    return this.prisma.notification.findUniqueOrThrow({ where: { id } });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private async sendPush(
    userId: string,
    title: string,
    body?: string,
    data?: Record<string, any>,
  ) {
    const devices = await this.prisma.pushDeviceToken.findMany({
      where: { userId },
      select: { token: true },
    });
    const tokens = devices.map((device) => device.token);
    const result = await this.firebasePush.sendToTokens(
      tokens,
      { title, body },
      data,
    );
    return {
      enabled: this.firebasePush.enabled,
      ...result,
    };
  }
}
