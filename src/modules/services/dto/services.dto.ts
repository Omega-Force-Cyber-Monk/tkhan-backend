import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ServiceQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() groomerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
export class CreateServiceDto {
  @ApiProperty() @IsString() categoryId: string;
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsNumber() @Min(1) durationMinutes: number;
  @ApiProperty() @IsNumber() @Min(0) price: number;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  addonIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateServiceDto extends CreateServiceDto {}
