import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { GroomerService } from './groomer.service';
import { UpdateGroomerProfileDto } from './dto/groomer.dto';
@ApiTags('groomer')
@ApiBearerAuth()
@Roles('GROOMER')
@Controller('groomer')
export class GroomerController {
  constructor(private readonly groomerService: GroomerService) {}
  @Patch('profile') updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateGroomerProfileDto,
  ) {
    return this.groomerService.updateProfile(user.sub, dto);
  }
  @Get('dashboard') dashboard(@CurrentUser() user: AuthUser) {
    return this.groomerService.dashboard(user.sub);
  }
  @Get('earnings') earnings(@CurrentUser() user: AuthUser) {
    return this.groomerService.earnings(user.sub);
  }
}
