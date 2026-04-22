import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { PayoutsService } from './payouts.service';
@ApiTags('payouts')
@ApiBearerAuth()
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}
  @Roles('ADMIN') @Get() list() {
    return this.payoutsService.list();
  }
  @Roles('ADMIN') @Post('bookings/:bookingId/release') release(
    @Param('bookingId') bookingId: string,
  ) {
    return this.payoutsService.releaseForBooking(bookingId);
  }
}
