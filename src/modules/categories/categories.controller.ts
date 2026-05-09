import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UploadsService } from '../uploads/uploads.service';
import { CategoriesService } from './categories.service';
import {
  CategoryQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/categories.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly uploads: UploadsService,
  ) {}
  @Public() @Get() list(@Query() dto: CategoryQueryDto) {
    return this.categoriesService.list(dto);
  }
  @Public() @Get(':id') findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }
  @ApiBearerAuth()
  @Roles('ADMIN')
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        active: { type: 'boolean' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() dto: CreateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const imageUrl = await this.uploads.uploadImage(file, 'tkhan/categories');
    if (imageUrl) dto.imageUrl = imageUrl;
    return this.categoriesService.create(dto);
  }
  @ApiBearerAuth()
  @Roles('ADMIN')
  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        active: { type: 'boolean' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const imageUrl = await this.uploads.uploadImage(file, 'tkhan/categories');
    if (imageUrl) dto.imageUrl = imageUrl;
    return this.categoriesService.update(id, dto);
  }
  @ApiBearerAuth() @Roles('ADMIN') @Delete(':id') remove(
    @Param('id') id: string,
  ) {
    return this.categoriesService.remove(id);
  }
}
