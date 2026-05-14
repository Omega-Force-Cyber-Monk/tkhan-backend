import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

const TIME_OR_ISO_DATE_REGEX =
  /^([01]\d|2[0-3]):[0-5]\d$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export class AvailabilitySlotDto {
  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(TIME_OR_ISO_DATE_REGEX, {
    message: 'startTime must be HH:mm or an ISO UTC date string',
  })
  startTime: string;
  @ApiProperty({ example: '17:00' })
  @IsString()
  @Matches(TIME_OR_ISO_DATE_REGEX, {
    message: 'endTime must be HH:mm or an ISO UTC date string',
  })
  endTime: string;
}
export class UpsertAvailabilityDto {
  @ApiProperty({ example: '2026-04-22' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isAvailable?: boolean;
  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots: AvailabilitySlotDto[];
}
export class UpdateAvailabilitySlotDto extends AvailabilitySlotDto {}
export class AvailabilityQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() groomerId?: string;
  @ApiPropertyOptional({ example: '2026-04-20' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must be in YYYY-MM-DD format',
  })
  from?: string;
  @ApiPropertyOptional({ example: '2026-04-26' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to must be in YYYY-MM-DD format',
  })
  to?: string;
  @ApiPropertyOptional({
    enum: ['BUYER', 'GROOMER'],
    description:
      'BUYER returns only unbooked slots; GROOMER keeps booked slots visible.',
  })
  @IsOptional()
  @IsIn(['BUYER', 'GROOMER'])
  panel?: 'BUYER' | 'GROOMER';
}
