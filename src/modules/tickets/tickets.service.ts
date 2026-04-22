import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTicketDto, ReplyTicketDto } from './dto/tickets.dto';
@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}
  async create(userId: string, dto: CreateTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        requesterId: userId,
        subject: dto.subject,
        relatedBookingId: dto.relatedBookingId,
        messages: {
          create: {
            senderId: userId,
            senderType: 'USER',
            message: dto.message,
          },
        },
      },
      include: { messages: true },
    });
  }
  list(userId: string, role: string) {
    return this.prisma.supportTicket.findMany({
      where: role === 'ADMIN' ? {} : { requesterId: userId },
      include: { messages: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  async reply(
    userId: string,
    role: string,
    ticketId: string,
    dto: ReplyTicketDto,
  ) {
    const ticket = await this.prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    if (role !== 'ADMIN' && ticket.requesterId !== userId)
      throw new ForbiddenException('Ticket access denied');
    const message = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        senderId: userId,
        senderType: role === 'ADMIN' ? 'ADMIN' : 'USER',
        message: dto.message,
      },
    });
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: role === 'ADMIN' ? 'IN_PROGRESS' : ticket.status },
    });
    await this.notifications.create(
      role === 'ADMIN' ? ticket.requesterId : userId,
      'TICKET_REPLY',
      'Ticket reply',
      dto.message,
      { ticketId },
    );
    return message;
  }
  resolve(ticketId: string) {
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }
}
