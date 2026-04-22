import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CreatePetDto, UpdatePetDto } from './dto/pets.dto';
import { PetsService } from './pets.service';
@ApiTags('pets')
@ApiBearerAuth()
@Roles('BUYER')
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}
  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreatePetDto) {
    return this.petsService.create(user.sub, dto);
  }
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.petsService.list(user.sub);
  }
  @Patch(':id') update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePetDto,
  ) {
    return this.petsService.update(user.sub, id, dto);
  }
  @Delete(':id') remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.petsService.remove(user.sub, id);
  }
}
