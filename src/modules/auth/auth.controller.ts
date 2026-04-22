import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterBuyerDto,
  RegisterGroomerDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public() @Post('register/buyer') registerBuyer(
    @Body() dto: RegisterBuyerDto,
  ) {
    return this.authService.registerBuyer(dto);
  }
  @Public() @Post('register/groomer') registerGroomer(
    @Body() dto: RegisterGroomerDto,
  ) {
    return this.authService.registerGroomer(dto);
  }
  @Public() @Post('login') login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
  @Public() @Post('refresh') refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }
  @Public() @Post('forgot-password') forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(dto);
  }
  @Public() @Post('reset-password') resetPassword(
    @Body() dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(dto);
  }
  @Public() @Post('verify-email') verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }
  @ApiBearerAuth() @Post('logout') logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.sub);
  }
  @ApiBearerAuth() @Post('change-password') changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, dto);
  }
}
