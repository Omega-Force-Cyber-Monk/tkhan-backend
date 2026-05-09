import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UploadsService } from '../uploads/uploads.service';
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
  constructor(
    private readonly authService: AuthService,
    private readonly uploads: UploadsService,
  ) {}

  @Public() @Post('register/buyer') registerBuyer(
    @Body() dto: RegisterBuyerDto,
  ) {
    return this.authService.registerBuyer(dto);
  }
  @Public()
  @Post('register/groomer')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'fullName',
        'phone',
        'email',
        'password',
        'locationText',
        'state',
        'experienceYears',
        'legalFullName',
        'idNumber',
        'idType',
        'businessName',
        'serviceArea',
        'businessAddress',
        'idFrontImage',
        'idBackImage',
      ],
      properties: {
        fullName: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
        locationText: { type: 'string' },
        state: { type: 'string' },
        experienceYears: { type: 'number' },
        legalFullName: { type: 'string' },
        idNumber: { type: 'string' },
        idType: { type: 'string', enum: ['PASSPORT', 'DRIVING_LICENSE'] },
        businessName: { type: 'string' },
        serviceArea: { type: 'string' },
        businessAddress: { type: 'string' },
        idFrontImage: { type: 'string', format: 'binary' },
        idBackImage: { type: 'string', format: 'binary' },
        selfieWithId: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'idFrontImage', maxCount: 1 },
      { name: 'idBackImage', maxCount: 1 },
      { name: 'selfieWithId', maxCount: 1 },
    ]),
  )
  async registerGroomer(
    @Body() dto: RegisterGroomerDto,
    @UploadedFiles()
    files?: {
      idFrontImage?: Express.Multer.File[];
      idBackImage?: Express.Multer.File[];
      selfieWithId?: Express.Multer.File[];
    },
  ) {
    dto.idFrontImage = await this.uploads.uploadImage(
      files?.idFrontImage?.[0],
      'tkhan/groomer-verification',
    );
    dto.idBackImage = await this.uploads.uploadImage(
      files?.idBackImage?.[0],
      'tkhan/groomer-verification',
    );
    dto.selfieWithId = await this.uploads.uploadImage(
      files?.selfieWithId?.[0],
      'tkhan/groomer-verification',
    );
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
