import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { FirebasePushService } from './firebase-push.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, FirebasePushService],
  exports: [NotificationsService, NotificationsGateway, FirebasePushService],
})
export class NotificationsModule {}
