import {
  Body,
  Controller,
  Get,
  Patch,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { UploadsService } from '../uploads/uploads.service';
import { GroomerService } from './groomer.service';
import { UpdateGroomerProfileDto } from './dto/groomer.dto';
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
    dto.profileImage =
      (await this.uploads.uploadImage(
        files?.profileImage?.[0],
        'tkhan/profile-images',
      )) ?? dto.profileImage;
    dto.selfieWithId =
      (await this.uploads.uploadImage(
        files?.selfieWithId?.[0],
        'tkhan/groomer-verification',
      )) ?? dto.selfieWithId;
    return this.groomerService.updateProfile(user.sub, dto);
  }
  @Get('dashboard') dashboard(@CurrentUser() user: AuthUser) {
    return this.groomerService.dashboard(user.sub);
  }
  @Get('earnings') earnings(@CurrentUser() user: AuthUser) {
    return this.groomerService.earnings(user.sub);
  }
}
