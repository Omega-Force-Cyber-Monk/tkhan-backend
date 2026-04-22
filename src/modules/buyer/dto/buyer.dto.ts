import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
export class GroomerSearchDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) minRating?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) minPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) maxPrice?: number;
}
