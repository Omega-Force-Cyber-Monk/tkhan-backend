import {
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
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
  @ApiOperation({ summary: 'Admin or groomer: view single payout detail' })
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
  @ApiOperation({ summary: 'Groomer only: view Stripe Connect payout status' })
  @Get('connect/status')
  connectStatus(@CurrentUser() user: AuthUser) {
    return this.payoutsService.connectStatus(user.sub);
  }

  @Roles('GROOMER')
  @ApiOperation({
    summary: 'Groomer only: generate Stripe Connect onboarding link',
  })
  @Post('connect/onboarding-link')
  createOnboardingLink(@CurrentUser() user: AuthUser) {
    return this.payoutsService.createOnboardingLink(user.sub);
  }

  @Roles('GROOMER')
  @ApiOperation({
    summary: 'Groomer only: generate Stripe Express dashboard login link',
  })
  @Post('connect/dashboard-link')
  createDashboardLink(@CurrentUser() user: AuthUser) {
    return this.payoutsService.createDashboardLink(user.sub);
  }
}
