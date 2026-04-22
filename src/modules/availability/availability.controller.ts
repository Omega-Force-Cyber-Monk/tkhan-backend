import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AvailabilityService } from './availability.service';
import {
  AvailabilityQueryDto,
  UpsertAvailabilityDto,
} from './dto/availability.dto';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}
  @Public() @Get() list(@Query() dto: AvailabilityQueryDto) {
    return this.availabilityService.list(dto);
  }
  @ApiBearerAuth() @Roles('GROOMER') @Post() upsert(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertAvailabilityDto,
  ) {
    return this.availabilityService.upsert(user.sub, dto);
  }
  @ApiBearerAuth() @Roles('GROOMER') @Patch(':id/enable') enable(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.availabilityService.toggle(user.sub, id, true);
  }
  @ApiBearerAuth() @Roles('GROOMER') @Patch(':id/disable') disable(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.availabilityService.toggle(user.sub, id, false);
  }
  @ApiBearerAuth() @Roles('GROOMER') @Delete('slots/:slotId') removeSlot(
    @CurrentUser() user: AuthUser,
    @Param('slotId') slotId: string,
  ) {
    return this.availabilityService.removeSlot(user.sub, slotId);
  }
}
