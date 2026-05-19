import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { BuyerService } from './buyer.service';
import { GroomerSearchDto } from './dto/buyer.dto';
@ApiTags('buyer')
@Controller('buyer')
export class BuyerController {
  constructor(private readonly buyerService: BuyerService) {}
  @Public() @Get('home') home(
    @CurrentUser() user: AuthUser | undefined,
    @Query('state') state?: string,
  ) {
    return this.buyerService.home(user?.sub, state);
  }
  @Public() @Get('groomers') search(
    @CurrentUser() user: AuthUser | undefined,
    @Query() dto: GroomerSearchDto,
  ) {
    return this.buyerService.searchGroomers(dto, user?.sub);
  }
  @Public() @Get('groomers/:id') groomerProfile(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
  ) {
    return this.buyerService.groomerProfile(id, user?.sub);
  }
}
