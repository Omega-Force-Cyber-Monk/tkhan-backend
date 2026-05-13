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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  CreateServiceDto,
  ServiceQueryDto,
  UpdateServiceDto,
} from './dto/services.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @ApiBearerAuth()
  @Roles('GROOMER')
  @Get('me')
  listMine(@CurrentUser() user: AuthUser, @Query() dto: ServiceQueryDto) {
    return this.servicesService.listMine(user.sub, dto);
  }

  @ApiBearerAuth()
  @Roles('GROOMER')
  @Get('me/:id/with-addons')
  findMineWithAddons(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.servicesService.findMineWithAddons(user.sub, id);
  }

  @ApiBearerAuth()
  @Roles('GROOMER')
  @Get('me/:id')
  findMine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.servicesService.findMine(user.sub, id);
  }

  @Public() @Get() list(@Query() dto: ServiceQueryDto) {
    return this.servicesService.list(dto);
  }

  @Public()
  @Get(':id/with-addons')
  findWithAddons(@Param('id') id: string) {
    return this.servicesService.findWithAddons(id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @ApiBearerAuth() @Roles('GROOMER') @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateServiceDto,
  ) {
    return this.servicesService.create(user.sub, dto);
  }
  @ApiBearerAuth() @Roles('GROOMER') @Patch(':id') update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(user.sub, id, dto);
  }
  @ApiBearerAuth() @Roles('GROOMER') @Delete(':id') remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.servicesService.remove(user.sub, id);
  }
}
