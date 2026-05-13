import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import {
  AdminBlockUserDto,
  AdminUserFilterDto,
  CreateAdminDto,
  RejectGroomerDto,
} from './dto/admin.dto';
@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  users(@Query() dto: AdminUserFilterDto) {
    return this.adminService.users(dto);
  }

  @Get('users/:id')
  userDetail(@Param('id') id: string) {
    return this.adminService.userDetail(id);
  }

  @Patch('users/:id/block')
  blockUser(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminBlockUserDto,
  ) {
    return this.adminService.blockUser(admin.sub, id, dto);
  }

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
  @Post('create') createAdmin(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAdminDto,
  ) {
    return this.adminService.createAdmin(user.sub, dto);
  }
}
