import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BlockUserDto, UpdateProfileDto, UserFilterDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Get('me') me(@CurrentUser() user: AuthUser) {
    return this.usersService.me(user.sub);
  }
  @Patch('me') updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(user.sub, dto);
  }
  @Roles('ADMIN') @Get() list(@Query() dto: UserFilterDto) {
    return this.usersService.list(dto);
  }
  @Roles('ADMIN') @Get(':id') findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
  @Roles('ADMIN') @Patch(':id/block') block(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: BlockUserDto,
  ) {
    return this.usersService.block(admin.sub, id, dto);
  }
}
