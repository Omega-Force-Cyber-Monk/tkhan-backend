import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
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

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  active?: boolean;
}
export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Full Grooming' })
  @IsOptional()
  @IsString()
  name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiHideProperty()
  @IsOptional()
  @Allow()
  image?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  active?: boolean;
}
