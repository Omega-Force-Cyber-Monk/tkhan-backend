import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class AddonQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() groomerId?: string;
}
export class CreateAddonDto {
  @ApiProperty() @IsString() serviceId: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsNumber() @Min(0) price: number;
  @ApiProperty() @IsNumber() @Min(1) durationMinutes: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateAddonDto {
  @ApiPropertyOptional() @IsOptional() @IsString() serviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) price?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
