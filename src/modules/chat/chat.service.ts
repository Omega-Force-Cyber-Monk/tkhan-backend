import { ForbiddenException, Injectable } from '@nestjs/common';
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
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { id: dto.groomerId },
    });
    return this.prisma.chatConversation.upsert({
      where: {
        buyerId_groomerId_bookingId: {
          buyerId: userId,
          groomerId: groomer.userId,
          bookingId: dto.bookingId ?? (null as any),
        },
      },
      create: {
        buyerId: userId,
        groomerId: groomer.userId,
        bookingId: dto.bookingId,
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
  async send(userId: string, dto: SendMessageDto) {
    const conversation = await this.assertParticipant(
      userId,
      dto.conversationId,
    );
    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId: dto.conversationId,
        senderId: userId,
        type: dto.type,
        body: dto.body,
        attachmentUrl: dto.attachmentUrl,
      },
    });
    const recipientId =
      conversation.buyerId === userId
        ? conversation.groomerId
        : conversation.buyerId;
    await this.notifications.create(
      recipientId,
      'NEW_MESSAGE',
      'New message',
      dto.body,
      { conversationId: conversation.id },
    );
    return message;
  }
  async messages(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }
  conversations(userId: string) {
    return this.prisma.chatConversation.findMany({
      where: { OR: [{ buyerId: userId }, { groomerId: userId }] },
      include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    return this.prisma.chatMessage.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
