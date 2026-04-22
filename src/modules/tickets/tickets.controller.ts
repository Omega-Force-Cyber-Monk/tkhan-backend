import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateTicketDto, ReplyTicketDto } from './dto/tickets.dto';
import { TicketsService } from './tickets.service';
@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}
  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user.sub, dto);
  }
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.ticketsService.list(user.sub, user.role);
  }
  @Post(':id/replies') reply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.ticketsService.reply(user.sub, user.role, id, dto);
  }
  @Roles('ADMIN') @Patch(':id/resolve') resolve(@Param('id') id: string) {
    return this.ticketsService.resolve(id);
  }
}
