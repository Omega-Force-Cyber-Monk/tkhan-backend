import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { UploadsService } from '../uploads/uploads.service';
import { CreatePetDto, UpdatePetDto } from './dto/pets.dto';
import { PetsService } from './pets.service';

const petFormSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    breed: { type: 'string' },
    age: { type: 'number' },
    temperament: { type: 'string' },
    petType: { type: 'string', enum: ['DOG', 'CAT', 'RABBIT', 'OTHER'] },
    petSize: {
      type: 'string',
      enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE'],
    },
    petImage: { type: 'string', format: 'binary' },
  },
};

@ApiTags('pets')
@ApiBearerAuth()
@Roles('BUYER')
@Controller('pets')
export class PetsController {
  constructor(
    private readonly petsService: PetsService,
    private readonly uploads: UploadsService,
  ) {}
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: petFormSchema })
  @UseInterceptors(FileInterceptor('petImage'))
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePetDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const petImage = await this.uploads.uploadImage(file, 'tkhan/pet-images');
    if (petImage) dto.petImage = petImage;
    return this.petsService.create(user.sub, dto);
  }
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.petsService.list(user.sub);
  }
  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: petFormSchema })
  @UseInterceptors(FileInterceptor('petImage'))
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePetDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const petImage = await this.uploads.uploadImage(file, 'tkhan/pet-images');
    if (petImage) dto.petImage = petImage;
    return this.petsService.update(user.sub, id, dto);
  }
  @Delete(':id') remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.petsService.remove(user.sub, id);
  }
}
