import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { BuyerService } from './buyer.service';
import { GroomerSearchDto } from './dto/buyer.dto';
@ApiTags('buyer')
@Controller('buyer')
export class BuyerController {
  constructor(private readonly buyerService: BuyerService) {}
  @Public() @Get('home') home(@Query('state') state?: string) {
    return this.buyerService.home(undefined, state);
  }
  @Public() @Get('groomers') search(@Query() dto: GroomerSearchDto) {
    return this.buyerService.searchGroomers(dto);
  }
  @Public() @Get('groomers/:id') groomerProfile(@Param('id') id: string) {
    return this.buyerService.groomerProfile(id);
  }
}
