import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { UploadsService } from '../uploads/uploads.service';
import {
  BookingDecisionDto,
  BookingQueryDto,
  CompletionRequestDto,
  CreateBookingDto,
  UploadBookingImagesDto,
} from './dto/bookings.dto';
import { BookingsService } from './bookings.service';
@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly uploads: UploadsService,
  ) {}
  @Roles('BUYER') @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.create(user.sub, dto);
  }
  @Get() list(@CurrentUser() user: AuthUser, @Query() dto: BookingQueryDto) {
    return this.bookingsService.listForUser(user.sub, user.role, dto);
  }
  @Get(':id') detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookingsService.detail(user.sub, user.role, id);
  }
  @Roles('GROOMER') @Patch(':id/accept') accept(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.bookingsService.accept(user.sub, id);
  }
  @Roles('GROOMER') @Patch(':id/reject') reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: BookingDecisionDto,
  ) {
    return this.bookingsService.reject(user.sub, id, dto);
  }
  @Roles('GROOMER') @Patch(':id/request-completion') requestCompletion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompletionRequestDto,
  ) {
    return this.bookingsService.requestCompletion(user.sub, id, dto);
  }
  @Roles('BUYER') @Patch(':id/approve-completion') approveCompletion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.bookingsService.approveCompletion(user.sub, id);
  }
  @Roles('GROOMER')
  @Patch(':id/images')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        beforeImage: { type: 'string', format: 'binary' },
        afterImage: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'beforeImage', maxCount: 1 },
      { name: 'afterImage', maxCount: 1 },
    ]),
  )
  async uploadImages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UploadBookingImagesDto,
    @UploadedFiles()
    files?: {
      beforeImage?: Express.Multer.File[];
      afterImage?: Express.Multer.File[];
    },
  ) {
    dto.beforeImage = await this.uploads.uploadImage(
      files?.beforeImage?.[0],
      'tkhan/bookings',
    );
    dto.afterImage = await this.uploads.uploadImage(
      files?.afterImage?.[0],
      'tkhan/bookings',
    );
    return this.bookingsService.uploadImages(user.sub, id, dto);
  }
}
