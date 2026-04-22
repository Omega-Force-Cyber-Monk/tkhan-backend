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
import { AddonsService } from './addons.service';
import {
  AddonQueryDto,
  CreateAddonDto,
  UpdateAddonDto,
} from './dto/addons.dto';

@ApiTags('addons')
@Controller('addons')
export class AddonsController {
  constructor(private readonly addonsService: AddonsService) {}
  @Public() @Get() list(@Query() dto: AddonQueryDto) {
    return this.addonsService.list(dto);
  }
  @ApiBearerAuth() @Roles('GROOMER') @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAddonDto,
  ) {
    return this.addonsService.create(user.sub, dto);
  }
  @ApiBearerAuth() @Roles('GROOMER') @Patch(':id') update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAddonDto,
  ) {
    return this.addonsService.update(user.sub, id, dto);
  }
  @ApiBearerAuth() @Roles('GROOMER') @Delete(':id') remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.addonsService.remove(user.sub, id);
  }
}
