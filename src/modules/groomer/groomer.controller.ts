import {
  Body,
  Controller,
  Get,
  Patch,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { UploadsService } from '../uploads/uploads.service';
import { GroomerService } from './groomer.service';
import {
  ToggleBookingAvailabilityDto,
  UpdateGroomerProfileDto,
} from './dto/groomer.dto';
@ApiTags('groomer')
@ApiBearerAuth()
@Roles('GROOMER')
@Controller('groomer')
export class GroomerController {
  constructor(
    private readonly groomerService: GroomerService,
    private readonly uploads: UploadsService,
  ) {}
  @Patch('profile')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        phone: { type: 'string' },
        shortBio: { type: 'string' },
        about: { type: 'string' },
        certifications: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              certificateTitle: { type: 'string' },
              issuingOrganization: { type: 'string' },
            },
          },
        },
        serviceModes: { type: 'array', items: { type: 'string' } },
        availableForBookings: { type: 'boolean' },
        profileImage: { type: 'string', format: 'binary' },
        selfieWithId: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'selfieWithId', maxCount: 1 },
    ]),
  )
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateGroomerProfileDto,
    @UploadedFiles()
    files?: {
      profileImage?: Express.Multer.File[];
      selfieWithId?: Express.Multer.File[];
    },
  ) {
    const profileImage = await this.uploads.uploadImage(
      files?.profileImage?.[0],
      'tkhan/profile-images',
    );
    const selfieWithId = await this.uploads.uploadImage(
      files?.selfieWithId?.[0],
      'tkhan/groomer-verification',
    );
    if (profileImage) dto.profileImage = profileImage;
    if (selfieWithId) dto.selfieWithId = selfieWithId;
    return this.groomerService.updateProfile(user.sub, dto);
  }
  @Patch('booking-availability')
  toggleBookingAvailability(
    @CurrentUser() user: AuthUser,
    @Body() dto: ToggleBookingAvailabilityDto,
  ) {
    return this.groomerService.toggleBookingAvailability(
      user.sub,
      dto.availableForBookings,
    );
  }
  @Get('dashboard') dashboard(@CurrentUser() user: AuthUser) {
    return this.groomerService.dashboard(user.sub);
  }
  @Get('earnings') earnings(@CurrentUser() user: AuthUser) {
    return this.groomerService.earnings(user.sub);
  }
}
