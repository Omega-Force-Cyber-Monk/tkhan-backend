import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Allow, IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CategoryQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
export class CreateCategoryDto {
  @ApiProperty({ example: 'Full Grooming' }) @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiHideProperty()
  @IsOptional()
  @Allow()
  image?: unknown;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateCategoryDto extends CreateCategoryDto {}
