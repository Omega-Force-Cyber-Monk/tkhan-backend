import { UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';
@WebSocketGateway({ namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway {
  @WebSocketServer() server: Server;
  constructor(private readonly chatService: ChatService) {}
  @SubscribeMessage('conversation.join')
  join(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    socket.join('conversation:' + body.conversationId);
    return { joined: body.conversationId };
  }
  @SubscribeMessage('message.send')
  async send(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: SendMessageDto & { userId: string },
  ) {
    const message = await this.chatService.send(body.userId, body);
    this.server
      .to('conversation:' + body.conversationId)
      .emit('message.created', message);
    return message;
  }
}
