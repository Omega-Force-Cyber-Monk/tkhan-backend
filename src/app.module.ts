import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BuyerModule } from './modules/buyer/buyer.module';
import { GroomerModule } from './modules/groomer/groomer.module';
import { AdminModule } from './modules/admin/admin.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ServicesModule } from './modules/services/services.module';
import { AddonsModule } from './modules/addons/addons.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { PetsModule } from './modules/pets/pets.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    JwtModule.register({ global: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    BuyerModule,
    GroomerModule,
    AdminModule,
    CategoriesModule,
    ServicesModule,
    AddonsModule,
    AvailabilityModule,
    PetsModule,
    FavoritesModule,
    BookingsModule,
    PaymentsModule,
    PayoutsModule,
    ReviewsModule,
    ChatModule,
    NotificationsModule,
    TicketsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
