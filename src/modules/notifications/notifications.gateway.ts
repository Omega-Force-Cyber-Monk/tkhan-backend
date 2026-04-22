import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@Injectable()
@WebSocketGateway({ namespace: 'notifications', cors: { origin: '*' } })
export class NotificationsGateway {
  @WebSocketServer() server: Server;
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to('user:' + userId).emit(event, payload);
  }
}
