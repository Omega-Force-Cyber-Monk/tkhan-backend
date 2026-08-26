import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { BookingReminderScheduler } from './booking-reminder.scheduler';
import { BuyerGrowthAlertScheduler } from './buyer-growth-alert.scheduler';
import { FirebasePushService } from './firebase-push.service';
import { GroomerAvailabilityAlertScheduler } from './groomer-availability-alert.scheduler';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { ReviewReminderService } from './review-reminder.service';
export * from './notification-templates';
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    FirebasePushService,
    BookingReminderScheduler,
    ReviewReminderService,
    GroomerAvailabilityAlertScheduler,
    BuyerGrowthAlertScheduler,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    FirebasePushService,
    ReviewReminderService,
  ],
})
export class NotificationsModule {}
