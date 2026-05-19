import { Module } from '@nestjs/common';
import { PayoutsModule } from '../payouts/payouts.module';
import { GroomerController } from './groomer.controller';
import { GroomerService } from './groomer.service';
@Module({
  imports: [PayoutsModule],
  controllers: [GroomerController],
  providers: [GroomerService],
  exports: [GroomerService],
})
export class GroomerModule {}
