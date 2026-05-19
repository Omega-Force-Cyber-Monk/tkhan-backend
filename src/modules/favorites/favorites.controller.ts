import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';
import { UpdateFavoriteDto } from './dto/favorite.dto';
@ApiTags('favorites')
@ApiBearerAuth()
@Roles('BUYER')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}
  @Patch(':groomerId') update(
    @CurrentUser() user: AuthUser,
    @Param('groomerId') groomerId: string,
    @Body() dto: UpdateFavoriteDto,
  ) {
    return this.favoritesService.update(user.sub, groomerId, dto.isFavorite);
  }
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.favoritesService.list(user.sub);
  }
}
