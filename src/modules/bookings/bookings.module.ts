import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import {
  AdminBookingCancellationController,
  BookingCancellationController,
} from './booking-cancellation.controller';
import { BookingCancellationService } from './booking-cancellation.service';
@Module({
  imports: [NotificationsModule, PaymentsModule, PayoutsModule],
  // Cancellation controller first so "bookings/cancellation-policy" is not
  // swallowed by "bookings/:id".
  controllers: [
    BookingCancellationController,
    AdminBookingCancellationController,
    BookingsController,
  ],
  providers: [BookingsService, BookingCancellationService],
  exports: [BookingsService, BookingCancellationService],
})
export class BookingsModule {}
