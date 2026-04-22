import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AvailabilitySlotDto {
  @ApiProperty({ example: '2026-04-22T09:00:00.000Z' })
  @IsDateString()
  startTime: string;
  @ApiProperty({ example: '2026-04-22T10:00:00.000Z' })
  @IsDateString()
  endTime: string;
}
export class UpsertAvailabilityDto {
  @ApiProperty({ example: '2026-04-22' }) @IsDateString() date: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isAvailable?: boolean;
  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots: AvailabilitySlotDto[];
}
export class AvailabilityQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() groomerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
