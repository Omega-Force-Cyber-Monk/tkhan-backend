import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { BuyerService } from './buyer.service';
import { GroomerSearchDto } from './dto/buyer.dto';
@ApiTags('buyer')
@Controller('buyer')
export class BuyerController {
  constructor(
    private readonly buyerService: BuyerService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}
  @Public() @Get('home') home(@Query('state') state?: string) {
    return this.buyerService.home(undefined, state);
  }
  @Public()
  @ApiBearerAuth()
  @Get('groomers')
  async search(
    @Query() dto: GroomerSearchDto,
    @Req() req: any,
  ) {
    const buyerId = await this.resolveBuyerId(req);
    return this.buyerService.searchGroomers(
      dto,
      buyerId,
    );
  }
  @Public()
  @ApiBearerAuth()
  @Get('groomers/:id')
  async groomerProfile(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.buyerService.groomerProfile(id, await this.resolveBuyerId(req));
  }

  private async resolveBuyerId(req: any) {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) return undefined;
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        role: 'BUYER' | 'GROOMER' | 'ADMIN';
      }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      return payload.role === 'BUYER' ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  }
}
