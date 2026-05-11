import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
export class GroomerSearchDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'Ava' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'TX' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'service-uuid' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ example: 'category-uuid' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ type: Number, example: 4 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minRating?: number;

  @ApiPropertyOptional({ type: Number, example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ type: Number, example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}
