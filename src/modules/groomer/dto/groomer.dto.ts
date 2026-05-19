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

const cleanText = (value: unknown) =>
  String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const extractJsonObjects = (value: string) => {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(value.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
};

export const parseCertificationArray = (value: unknown) => {
  const normalizeCertification = (item: unknown) => {
    if (typeof item === 'string') {
      const parsed = tryParseJson(item.trim());
      if (parsed !== undefined) return normalizeCertification(parsed);

      return plainToInstance(GroomerCertificationDto, {
        certificateTitle: cleanText(item),
      });
    }
    if (!item || typeof item !== 'object') return item;
    const record = item as Record<string, unknown>;
    return plainToInstance(GroomerCertificationDto, {
      certificateTitle: cleanText(
        record.certificateTitle ??
          record['certificate title'] ??
          record.title ??
          '',
      ),
      issuingOrganization: cleanText(
        record.issuingOrganization ??
          record['issuing organization'] ??
          record.organization ??
          '',
      ),
    });
  };

  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item !== 'string') return [normalizeCertification(item)];
      const extracted = extractJsonObjects(item);
      return extracted.length
        ? extracted.map((object) => normalizeCertification(object))
        : [normalizeCertification(item)];
    });
  }
  if (typeof value !== 'string') return value;
  const parsed = tryParseJson(value);
  if (parsed !== undefined) {
    if (!Array.isArray(parsed)) return [normalizeCertification(parsed)];
    return parsed.map(normalizeCertification);
  }

  const extracted = extractJsonObjects(value);
  if (extracted.length) {
    return extracted.map((object) => normalizeCertification(object));
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeCertification);
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

export class ToggleBookingAvailabilityDto {
  @ApiPropertyOptional({ example: true })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  availableForBookings: boolean;
}
