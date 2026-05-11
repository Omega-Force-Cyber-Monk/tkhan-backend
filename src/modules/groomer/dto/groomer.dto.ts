import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
export class UpdateGroomerProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  profileImage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shortBio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() about?: string;
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  selfieWithId?: string;
  @ApiPropertyOptional({ type: [String] })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return value;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];
  @ApiPropertyOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsOptional()
  @IsBoolean()
  availableForBookings?: boolean;
}
