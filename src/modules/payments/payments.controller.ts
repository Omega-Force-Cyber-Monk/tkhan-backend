import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}
  @ApiBearerAuth()
  @Roles('BUYER')
  @Post('bookings/:bookingId/checkout')
  checkout(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
    @Req() req: any,
  ) {
    return this.paymentsService.createCheckoutSession(
      bookingId,
      user.sub,
      this.requestOrigin(req),
    );
  }
  @ApiBearerAuth()
  @Roles('BUYER')
  @Post('bookings/:bookingId/checkout/confirm')
  confirmCheckout(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.paymentsService.confirmBookingCheckout(bookingId, user.sub);
  }
  @Public() @Get('checkout/success') async checkoutSuccess(
    @Query('session_id') sessionId: string,
    @Res() res: any,
  ) {
    const result = await this.paymentsService.confirmCheckoutSession(sessionId);
    return res.redirect(result.redirectUrl);
  }
  @Public() @Post('stripe/webhook') webhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentsService.handleWebhook(req.rawBody, signature);
  }

  private requestOrigin(req: any) {
    const protocol = req.headers['x-forwarded-proto'] ?? req.protocol ?? 'http';
    const host = req.headers['x-forwarded-host'] ?? req.headers.host;
    return `${protocol}://${host}`;
  }
}
