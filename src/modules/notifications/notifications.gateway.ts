import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

type NotificationSocket = Socket & {
  data: {
    user?: AuthUser;
  };
};

@Injectable()
@WebSocketGateway({ namespace: 'notifications', cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(socket: NotificationSocket) {
    try {
      const user = await this.authenticateSocket(socket);
      socket.data.user = user;
      socket.join(this.userRoom(user.sub));
      socket.emit('notifications.ready', { userId: user.sub });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Socket authentication failed';
      this.logger.warn(`Notifications socket rejected: ${message}`);
      socket.emit('notifications.error', { message });
      socket.disconnect(true);
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(this.userRoom(userId)).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    for (const userId of new Set(userIds.filter(Boolean))) {
      this.emitToUser(userId, event, payload);
    }
  }

  private async authenticateSocket(socket: NotificationSocket): Promise<AuthUser> {
    const token = this.extractToken(socket);
    if (!token) {
      throw new Error('Missing bearer token');
    }
    return this.jwtService.verifyAsync<AuthUser>(token, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  private extractToken(socket: NotificationSocket) {
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

  private userRoom(userId: string) {
    return 'user:' + userId;
  }
}
