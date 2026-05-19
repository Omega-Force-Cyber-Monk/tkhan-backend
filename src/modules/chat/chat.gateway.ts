import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';

type ChatSocket = Socket & {
  data: {
    user?: AuthUser;
  };
};

@Injectable()
@WebSocketGateway({ namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(socket: ChatSocket) {
    try {
      const user = await this.authenticateSocket(socket);
      socket.data.user = user;
      socket.join(this.userRoom(user.sub));
      socket.emit('chat.ready', { userId: user.sub });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Socket authentication failed';
      this.logger.warn(`Chat socket rejected: ${message}`);
      socket.emit('chat.error', { message });
      socket.disconnect(true);
    }
  }

  @SubscribeMessage('conversation.join')
  async join(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = this.requireSocketUser(socket);
    await this.chatService.assertParticipant(user.sub, body.conversationId);
    socket.join(this.conversationRoom(body.conversationId));
    return { joined: body.conversationId };
  }

  @SubscribeMessage('conversation.leave')
  async leave(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = this.requireSocketUser(socket);
    await this.chatService.assertParticipant(user.sub, body.conversationId);
    socket.leave(this.conversationRoom(body.conversationId));
    return { left: body.conversationId };
  }

  @SubscribeMessage('message.send')
  async send(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: SendMessageDto,
  ) {
    const user = this.requireSocketUser(socket);
    const payload = await this.chatService.sendWithConversation(user.sub, body);
    this.emitMessageCreated(payload.conversation, payload.message);
    return payload.message;
  }

  @SubscribeMessage('conversation.read')
  async markRead(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = this.requireSocketUser(socket);
    const receipt = await this.chatService.markRead(user.sub, body.conversationId);
    this.emitMessagesRead(receipt);
    return receipt;
  }

  @SubscribeMessage('conversation.typing')
  async typing(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { conversationId: string; isTyping: boolean },
  ) {
    const user = this.requireSocketUser(socket);
    await this.chatService.assertParticipant(user.sub, body.conversationId);
    socket
      .to(this.conversationRoom(body.conversationId))
      .emit('conversation.typing', {
        conversationId: body.conversationId,
        userId: user.sub,
        isTyping: body.isTyping,
      });
    return { ok: true };
  }

  emitConversationCreated(conversation: {
    id: string;
    buyerId: string;
    groomerId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const payload = {
      conversationId: conversation.id,
      buyerId: conversation.buyerId,
      groomerId: conversation.groomerId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
    this.server?.to(this.userRoom(conversation.buyerId)).emit(
      'conversation.created',
      payload,
    );
    this.server?.to(this.userRoom(conversation.groomerId)).emit(
      'conversation.created',
      payload,
    );
  }

  emitMessageCreated(
    conversation: { id: string; buyerId: string; groomerId: string },
    message: {
      id: string;
      conversationId: string;
      senderId: string;
      type: 'TEXT' | 'IMAGE' | 'FILE';
      body: string | null;
      attachmentUrl: string | null;
      readAt: Date | null;
      createdAt: Date;
    },
  ) {
    this.server
      ?.to(this.conversationRoom(conversation.id))
      .emit('message.created', message);
    this.server?.to(this.userRoom(conversation.buyerId)).emit(
      'conversation.updated',
      {
        conversationId: conversation.id,
        message,
      },
    );
    this.server?.to(this.userRoom(conversation.groomerId)).emit(
      'conversation.updated',
      {
        conversationId: conversation.id,
        message,
      },
    );
  }

  emitMessagesRead(receipt: {
    conversationId: string;
    readerId: string;
    messageIds: string[];
    readAt: Date;
  }) {
    this.server
      ?.to(this.conversationRoom(receipt.conversationId))
      .emit('conversation.read', receipt);
  }

  private async authenticateSocket(socket: ChatSocket): Promise<AuthUser> {
    const token = this.extractToken(socket);
    if (!token) {
      throw new Error('Missing bearer token');
    }
    return this.jwtService.verifyAsync<AuthUser>(token, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  private extractToken(socket: ChatSocket) {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.startsWith('Bearer ')
        ? authToken.slice(7)
        : authToken.trim();
    }
    const authorization = socket.handshake.headers.authorization;
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
      return authorization.slice(7);
    }
    const queryToken = socket.handshake.query.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken;
    }
    return undefined;
  }

  private requireSocketUser(socket: ChatSocket) {
    const user = socket.data.user;
    if (!user) {
      throw new Error('Socket user missing');
    }
    return user;
  }

  private conversationRoom(conversationId: string) {
    return 'conversation:' + conversationId;
  }

  private userRoom(userId: string) {
    return 'user:' + userId;
  }
}
