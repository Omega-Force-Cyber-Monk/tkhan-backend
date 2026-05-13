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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RegisterPushTokenDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('dummy')
  dummy(@CurrentUser() user: AuthUser) {
    return this.notificationsService.dummyList(user.sub);
  }

  @Get() list(@CurrentUser() user: AuthUser, @Query() dto: PaginationDto) {
    return this.notificationsService.list(user.sub, dto);
  }

  @Post('push-tokens')
  registerPushToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notificationsService.registerPushToken(user.sub, dto);
  }

  @Delete('push-tokens')
  unregisterPushToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notificationsService.unregisterPushToken(user.sub, dto.token);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Patch(':id/read') markRead(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markRead(user.sub, id);
  }
}
