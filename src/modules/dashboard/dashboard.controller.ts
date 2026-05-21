import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardTrendsDto } from './dto/dashboard.dto';
import { DashboardService } from './dashboard.service';
@ApiTags('dashboard')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
  @Get('overview') overview() {
    return this.dashboardService.overview();
  }

  @Get('trends')
  trends(@Query() query: DashboardTrendsDto) {
    return this.dashboardService.trends(query.days ?? 7);
  }
}
