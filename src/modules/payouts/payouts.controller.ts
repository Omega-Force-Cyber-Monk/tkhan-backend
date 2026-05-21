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
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AdminApproveWithdrawalRequestDto,
  AdminMarkWithdrawalPaidDto,
  AdminRejectWithdrawalRequestDto,
  CreateGroomerBankAccountDto,
  CreateWithdrawalRequestDto,
  UpdateGroomerBankAccountDto,
  WithdrawalRequestQueryDto,
} from './dto/payouts.dto';
import { PayoutsService } from './payouts.service';

@ApiTags('payouts')
@ApiBearerAuth()
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Roles('ADMIN')
  @Get()
  list() {
    return this.payoutsService.list();
  }

  @Roles('GROOMER')
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.payoutsService.summary(user.sub);
  }

  @Roles('GROOMER')
  @Get('bank-accounts')
  listBankAccounts(@CurrentUser() user: AuthUser) {
    return this.payoutsService.listBankAccounts(user.sub);
  }

  @Roles('GROOMER')
  @Post('bank-accounts')
  createBankAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGroomerBankAccountDto,
  ) {
    return this.payoutsService.createBankAccount(user.sub, dto);
  }

  @Roles('GROOMER')
  @Patch('bank-accounts/:id')
  updateBankAccount(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateGroomerBankAccountDto,
  ) {
    return this.payoutsService.updateBankAccount(user.sub, id, dto);
  }

  @Roles('GROOMER')
  @Delete('bank-accounts/:id')
  deleteBankAccount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payoutsService.deleteBankAccount(user.sub, id);
  }

  @Roles('GROOMER')
  @Patch('bank-accounts/:id/default')
  setDefaultBankAccount(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.payoutsService.setDefaultBankAccount(user.sub, id);
  }

  @Roles('GROOMER')
  @Get('withdrawal-requests/me')
  myWithdrawalRequests(
    @CurrentUser() user: AuthUser,
    @Query() dto: WithdrawalRequestQueryDto,
  ) {
    return this.payoutsService.listMyWithdrawalRequests(user.sub, dto);
  }

  @Roles('GROOMER')
  @Post('withdrawal-requests')
  createWithdrawalRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWithdrawalRequestDto,
  ) {
    return this.payoutsService.createWithdrawalRequest(user.sub, dto);
  }

  @Roles('GROOMER')
  @Patch('withdrawal-requests/:id/cancel')
  cancelWithdrawalRequest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.payoutsService.cancelWithdrawalRequest(user.sub, id);
  }

  @Roles('ADMIN')
  @Get('withdrawal-requests')
  withdrawalRequests(@Query() dto: WithdrawalRequestQueryDto) {
    return this.payoutsService.listWithdrawalRequests(dto);
  }

  @Roles('ADMIN')
  @Patch('withdrawal-requests/:id/approve')
  approveWithdrawalRequest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminApproveWithdrawalRequestDto,
  ) {
    return this.payoutsService.approveWithdrawalRequest(user.sub, id, dto);
  }

  @Roles('ADMIN')
  @Patch('withdrawal-requests/:id/reject')
  rejectWithdrawalRequest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminRejectWithdrawalRequestDto,
  ) {
    return this.payoutsService.rejectWithdrawalRequest(user.sub, id, dto);
  }

  @Roles('ADMIN')
  @Patch('withdrawal-requests/:id/mark-paid')
  markWithdrawalRequestPaid(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminMarkWithdrawalPaidDto,
  ) {
    return this.payoutsService.markWithdrawalRequestPaid(user.sub, id, dto);
  }
}
