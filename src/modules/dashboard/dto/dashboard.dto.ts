import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class DashboardTrendsDto {
  @ApiPropertyOptional({
    description: 'Number of days to include, ending today',
    example: 7,
    minimum: 1,
    maximum: 30,
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number = 7;
}
