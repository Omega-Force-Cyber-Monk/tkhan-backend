import { Module } from '@nestjs/common';
import { GroomerController } from './groomer.controller';
import { GroomerService } from './groomer.service';
@Module({
  controllers: [GroomerController],
  providers: [GroomerService],
  exports: [GroomerService],
})
export class GroomerModule {}
