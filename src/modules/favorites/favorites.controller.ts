import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';
@ApiTags('favorites')
@ApiBearerAuth()
@Roles('BUYER')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}
  @Post(':groomerId') add(
    @CurrentUser() user: AuthUser,
    @Param('groomerId') groomerId: string,
  ) {
    return this.favoritesService.add(user.sub, groomerId);
  }
  @Delete(':groomerId') remove(
    @CurrentUser() user: AuthUser,
    @Param('groomerId') groomerId: string,
  ) {
    return this.favoritesService.remove(user.sub, groomerId);
  }
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.favoritesService.list(user.sub);
  }
}
