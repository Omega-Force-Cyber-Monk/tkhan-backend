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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Admin only: list all payouts' })
  @Get()
  list() {
    return this.payoutsService.list();
  }

  @Roles('ADMIN', 'GROOMER')
  @ApiOperation({
    summary:
      'Admin or groomer: view single payout or withdrawal request detail',
  })
  @Get('transactions/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payoutsService.detail(user.sub, user.role, id);
  }

  @Roles('GROOMER')
  @ApiOperation({ summary: 'Groomer only: view own payout summary' })
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.payoutsService.summary(user.sub);
  }

  @Roles('GROOMER')
  @ApiOperation({ summary: 'Groomer only: list own bank accounts' })
  @Get('bank-accounts')
  listBankAccounts(@CurrentUser() user: AuthUser) {
    return this.payoutsService.listBankAccounts(user.sub);
  }

  @Roles('GROOMER')
  @ApiOperation({ summary: 'Groomer only: add a bank account' })
  @Post('bank-accounts')
  createBankAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGroomerBankAccountDto,
  ) {
    return this.payoutsService.createBankAccount(user.sub, dto);
  }

  @Roles('GROOMER')
  @ApiOperation({ summary: 'Groomer only: update own bank account' })
  @Patch('bank-accounts/:id')
  updateBankAccount(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateGroomerBankAccountDto,
  ) {
    return this.payoutsService.updateBankAccount(user.sub, id, dto);
  }

  @Roles('GROOMER')
  @ApiOperation({ summary: 'Groomer only: delete own bank account' })
  @Delete('bank-accounts/:id')
  deleteBankAccount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payoutsService.deleteBankAccount(user.sub, id);
  }

  @Roles('GROOMER')
  @ApiOperation({ summary: 'Groomer only: set default bank account' })
  @Patch('bank-accounts/:id/default')
  setDefaultBankAccount(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.payoutsService.setDefaultBankAccount(user.sub, id);
  }

  @Roles('GROOMER')
  @ApiOperation({ summary: 'Groomer only: list own withdrawal requests' })
  @Get('withdrawal-requests/me')
  myWithdrawalRequests(
    @CurrentUser() user: AuthUser,
    @Query() dto: WithdrawalRequestQueryDto,
  ) {
    return this.payoutsService.listMyWithdrawalRequests(user.sub, dto);
  }

  @Roles('GROOMER')
  @ApiOperation({ summary: 'Groomer only: create withdrawal request' })
  @Post('withdrawal-requests')
  createWithdrawalRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWithdrawalRequestDto,
  ) {
    return this.payoutsService.createWithdrawalRequest(user.sub, dto);
  }

  @Roles('GROOMER')
  @ApiOperation({ summary: 'Groomer only: cancel own withdrawal request' })
  @Patch('withdrawal-requests/:id/cancel')
  cancelWithdrawalRequest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.payoutsService.cancelWithdrawalRequest(user.sub, id);
  }

  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin only: list all withdrawal requests' })
  @Get('withdrawal-requests')
  withdrawalRequests(@Query() dto: WithdrawalRequestQueryDto) {
    return this.payoutsService.listWithdrawalRequests(dto);
  }

  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin only: approve withdrawal request' })
  @Patch('withdrawal-requests/:id/approve')
  approveWithdrawalRequest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminApproveWithdrawalRequestDto,
  ) {
    return this.payoutsService.approveWithdrawalRequest(user.sub, id, dto);
  }

  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin only: reject withdrawal request' })
  @Patch('withdrawal-requests/:id/reject')
  rejectWithdrawalRequest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminRejectWithdrawalRequestDto,
  ) {
    return this.payoutsService.rejectWithdrawalRequest(user.sub, id, dto);
  }

  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin only: mark withdrawal request as paid' })
  @Patch('withdrawal-requests/:id/mark-paid')
  markWithdrawalRequestPaid(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminMarkWithdrawalPaidDto,
  ) {
    return this.payoutsService.markWithdrawalRequestPaid(user.sub, id, dto);
  }
}
