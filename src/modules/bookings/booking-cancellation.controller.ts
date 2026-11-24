import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BookingCancellationService } from './booking-cancellation.service';
import {
  AdminCancelBookingDto,
  AdminRefundBookingDto,
  CancelBookingDto,
} from './dto/bookings.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingCancellationController {
  constructor(private readonly cancellations: BookingCancellationService) {}

  @Public()
  @Get('cancellation-policy')
  @ApiOperation({ summary: 'Current cancellation & refund policy numbers' })
  policy() {
    return this.cancellations.policySummary();
  }

  @Roles('BUYER', 'GROOMER', 'ADMIN')
  @Get(':id/cancellation-preview')
  @ApiOperation({
    summary:
      'What will happen if the current user cancels now (refund %, late fee, no-show) - used for the confirmation popup',
  })
  preview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cancellations.preview(user.sub, user.role, id);
  }

  @Roles('BUYER', 'GROOMER')
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking as the buyer or the groomer' })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.cancellations.cancelByUser(user.sub, user.role, id, dto);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminBookingCancellationController {
  constructor(private readonly cancellations: BookingCancellationService) {}

  @Post('bookings/:id/cancel')
  @ApiOperation({
    summary: 'Admin: cancel a booking with policy/full/partial/no refund',
  })
  cancel(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminCancelBookingDto,
  ) {
    return this.cancellations.cancelByAdmin(admin.sub, id, dto);
  }

  @Post('bookings/:id/refund')
  @ApiOperation({
    summary: 'Admin: refund (full or partial) without cancelling',
  })
  refund(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminRefundBookingDto,
  ) {
    return this.cancellations.refundByAdmin(admin.sub, id, dto);
  }

  @Get('groomer-no-shows')
  noShows() {
    return this.cancellations.listNoShows();
  }

  @Patch('groomers/:groomerProfileId/lift-suspension')
  liftSuspension(
    @CurrentUser() admin: AuthUser,
    @Param('groomerProfileId') groomerProfileId: string,
    @Body() body: { note?: string },
  ) {
    return this.cancellations.liftGroomerSuspension(
      admin.sub,
      groomerProfileId,
      body?.note,
    );
  }
}
