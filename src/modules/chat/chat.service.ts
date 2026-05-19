import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendMessageDto, StartConversationDto } from './dto/chat.dto';
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}
  async start(userId: string, dto: StartConversationDto) {
    if (userId === dto.userId) {
      throw new BadRequestException('Cannot start a conversation with yourself');
    }

    const [currentUser, targetUser] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, role: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: dto.userId },
        select: { id: true, role: true },
      }),
    ]);

    const roles = [currentUser.role, targetUser.role];
    if (!(roles.includes('BUYER') && roles.includes('GROOMER'))) {
      throw new BadRequestException(
        'Direct chat is only allowed between buyer and groomer',
      );
    }

    const buyerId = currentUser.role === 'BUYER' ? currentUser.id : targetUser.id;
    const groomerId =
      currentUser.role === 'GROOMER' ? currentUser.id : targetUser.id;

    return this.prisma.chatConversation.upsert({
      where: {
        buyerId_groomerId: {
          buyerId,
          groomerId,
        },
      },
      create: {
        buyerId,
        groomerId,
        bookingId: null,
      },
      update: {},
    });
  }
  async assertParticipant(userId: string, conversationId: string) {
    const conversation = await this.prisma.chatConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    if (conversation.buyerId !== userId && conversation.groomerId !== userId)
      throw new ForbiddenException('Conversation access denied');
    return conversation;
  }

  async sendWithConversation(userId: string, dto: SendMessageDto) {
    const conversation = await this.assertParticipant(
      userId,
      dto.conversationId,
    );
    const body = dto.body?.trim();
    if (dto.type === 'TEXT' && !body) {
      throw new BadRequestException('Message body is required');
    }
    if ((dto.type === 'IMAGE' || dto.type === 'FILE') && !dto.attachmentUrl) {
      throw new BadRequestException('Attachment file is required');
    }
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId: dto.conversationId,
          senderId: userId,
          type: dto.type,
          body,
          attachmentUrl: dto.attachmentUrl,
        },
      });
      await tx.chatConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
      return created;
    });
    const recipientId =
      conversation.buyerId === userId
        ? conversation.groomerId
        : conversation.buyerId;
    const notificationBody =
      body ??
      (dto.type === 'IMAGE' ? 'Sent an image' : 'Sent an attachment');
    await this.notifications.create(
      recipientId,
      'NEW_MESSAGE',
      'New message',
      notificationBody,
      { conversationId: conversation.id },
    );
    return { conversation, message, recipientId };
  }

  async send(userId: string, dto: SendMessageDto) {
    const { message } = await this.sendWithConversation(userId, dto);
    return message;
  }
  async messages(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }
  async conversations(userId: string) {
    const conversations = await this.prisma.chatConversation.findMany({
      where: { OR: [{ buyerId: userId }, { groomerId: userId }] },
      include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    });

    const latestConversationByPartner = new Map<string, (typeof conversations)[number]>();
    for (const conversation of conversations) {
      const partnerId =
        conversation.buyerId === userId
          ? conversation.groomerId
          : conversation.buyerId;
      if (!latestConversationByPartner.has(partnerId)) {
        latestConversationByPartner.set(partnerId, conversation);
      }
    }

    const items = Array.from(latestConversationByPartner.values());
    const partnerIds = items.map((conversation) =>
      conversation.buyerId === userId
        ? conversation.groomerId
        : conversation.buyerId,
    );
    const [partners, unreadMessages] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: partnerIds } },
        select: {
          id: true,
          fullName: true,
          profileImage: true,
          role: true,
          locationText: true,
          state: true,
          groomerProfile: {
            select: {
              id: true,
              businessName: true,
            },
          },
        },
      }),
      this.prisma.chatMessage.findMany({
        where: {
          conversationId: { in: items.map((conversation) => conversation.id) },
          senderId: { not: userId },
          readAt: null,
        },
        select: {
          id: true,
          conversationId: true,
        },
      }),
    ]);

    const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
    const unreadCountByConversationId = new Map<string, number>();
    for (const message of unreadMessages) {
      unreadCountByConversationId.set(
        message.conversationId,
        (unreadCountByConversationId.get(message.conversationId) ?? 0) + 1,
      );
    }

    return {
      totalChats: items.length,
      items: items.map((conversation) => {
        const partnerId =
          conversation.buyerId === userId
            ? conversation.groomerId
            : conversation.buyerId;
        const partner = partnerById.get(partnerId);
        return {
          id: conversation.id,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          unreadCount:
            unreadCountByConversationId.get(conversation.id) ?? 0,
          partner: partner
            ? {
                userId: partner.id,
                role: partner.role,
                fullName: partner.fullName,
                profileImage: partner.profileImage,
                locationText: partner.locationText,
                state: partner.state,
                groomerProfileId: partner.groomerProfile?.id ?? null,
                businessName: partner.groomerProfile?.businessName ?? null,
              }
            : null,
          lastMessage: conversation.messages[0] ?? null,
        };
      }),
    };
  }
  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    const unreadMessages = await this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
      select: { id: true },
    });
    const readAt = new Date();
    if (unreadMessages.length > 0) {
      await this.prisma.chatMessage.updateMany({
        where: { id: { in: unreadMessages.map((message) => message.id) } },
        data: { readAt },
      });
    }
    return {
      conversationId,
      readerId: userId,
      messageIds: unreadMessages.map((message) => message.id),
      readAt,
    };
  }
}
