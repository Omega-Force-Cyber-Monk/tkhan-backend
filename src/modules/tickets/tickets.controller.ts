import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  CreateTicketDto,
  ReplyTicketDto,
  ReportIssueDto,
} from './dto/tickets.dto';
import { TicketsService } from './tickets.service';
@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}
  @Get('report-options') reportOptions() {
    return this.ticketsService.reportOptions();
  }
  @Post('report') report(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReportIssueDto,
  ) {
    return this.ticketsService.reportIssue(user.sub, dto);
  }
  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user.sub, dto);
  }
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.ticketsService.list(user.sub, user.role);
  }
  @Get(':id') detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ticketsService.detail(user.sub, user.role, id);
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
