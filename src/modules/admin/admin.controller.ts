import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { RejectGroomerDto } from './dto/admin.dto';
@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
  @Get('groomers/pending') pendingGroomers() {
    return this.adminService.pendingGroomers();
  }
  @Get('groomers/approval-counts') approvalCounts() {
    return this.adminService.approvalCounts();
  }
  @Patch('groomers/:id/approve') approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.adminService.approveGroomer(user.sub, id);
  }
  @Patch('groomers/:id/reject') reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectGroomerDto,
  ) {
    return this.adminService.rejectGroomer(user.sub, id, dto.reason);
  }
  @Get('payments') payments() {
    return this.adminService.payments();
  }
  @Get('action-logs') actionLogs() {
    return this.adminService.actionLogs();
  }
}
