import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}
  @Get() list(@CurrentUser() user: AuthUser, @Query() dto: PaginationDto) {
    return this.notificationsService.list(user.sub, dto);
  }
  @Patch(':id/read') markRead(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markRead(user.sub, id);
  }
  @Patch('read-all') markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.sub);
  }
}
