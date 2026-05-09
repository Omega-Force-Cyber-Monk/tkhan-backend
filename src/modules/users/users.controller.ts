import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UploadsService } from '../uploads/uploads.service';
import { BlockUserDto, UpdateProfileDto, UserFilterDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploads: UploadsService,
  ) {}
  @Get('me') me(@CurrentUser() user: AuthUser) {
    return this.usersService.me(user.sub);
  }
  @Patch('me')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('profileImage'))
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    dto.profileImage =
      (await this.uploads.uploadImage(file, 'tkhan/profile-images')) ??
      dto.profileImage;
    return this.usersService.updateMe(user.sub, dto);
  }

  @Patch('me/profile-image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('profileImage'))
  async updateProfileImage(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const profileImage = await this.uploads.uploadImage(
      file,
      'tkhan/profile-images',
    );
    return this.usersService.updateMe(user.sub, { profileImage });
  }
  @Roles('ADMIN') @Get() list(@Query() dto: UserFilterDto) {
    return this.usersService.list(dto);
  }
  @Roles('ADMIN') @Get(':id') findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
  @Roles('ADMIN') @Patch(':id/block') block(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: BlockUserDto,
  ) {
    return this.usersService.block(admin.sub, id, dto);
  }
}
