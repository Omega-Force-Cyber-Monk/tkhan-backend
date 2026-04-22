import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import {
  CategoryQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/categories.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}
  @Public() @Get() list(@Query() dto: CategoryQueryDto) {
    return this.categoriesService.list(dto);
  }
  @Public() @Get(':id') findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }
  @ApiBearerAuth() @Roles('ADMIN') @Post() create(
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(dto);
  }
  @ApiBearerAuth() @Roles('ADMIN') @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }
  @ApiBearerAuth() @Roles('ADMIN') @Delete(':id') remove(
    @Param('id') id: string,
  ) {
    return this.categoriesService.remove(id);
  }
}
