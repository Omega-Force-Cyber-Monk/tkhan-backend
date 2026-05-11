import { ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class GroomerCertificationDto {
  @ApiPropertyOptional({ example: 'Pet First Aid' })
  @IsOptional()
  @IsString()
  certificateTitle?: string;

  @ApiPropertyOptional({ example: 'American Red Cross' })
  @IsOptional()
  @IsString()
  issuingOrganization?: string;
}

export const parseStringArray = (value: unknown) => {
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
};

export const parseCertificationArray = (value: unknown) => {
  const normalizeCertification = (item: unknown) => {
    if (typeof item === 'string') {
      return plainToInstance(GroomerCertificationDto, {
        certificateTitle: item,
      });
    }
    if (!item || typeof item !== 'object') return item;
    const record = item as Record<string, unknown>;
    return plainToInstance(GroomerCertificationDto, {
      certificateTitle:
        record.certificateTitle ??
        record['certificate title'] ??
        record.title ??
        '',
      issuingOrganization:
        record.issuingOrganization ??
        record['issuing organization'] ??
        record.organization ??
        '',
    });
  };

  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    return value.map(normalizeCertification);
  }
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [normalizeCertification(parsed)];
    return parsed.map(normalizeCertification);
  } catch {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map(normalizeCertification);
  }
};

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
  @ApiPropertyOptional({
    type: [GroomerCertificationDto],
    example: [
      {
        certificateTitle: 'Pet First Aid',
        issuingOrganization: 'American Red Cross',
      },
    ],
  })
  @Transform(({ value }) => parseCertificationArray(value))
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroomerCertificationDto)
  certifications?: GroomerCertificationDto[];

  @ApiPropertyOptional({
    type: [String],
    example: ['In-home grooming', 'Mobile grooming'],
  })
  @Transform(({ value }) => parseStringArray(value))
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceModes?: string[];

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
