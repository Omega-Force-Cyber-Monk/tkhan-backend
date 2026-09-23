import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  GroomerCertificationDto,
  parseCertificationArray,
  parseStringArray,
} from '../../groomer/dto/groomer.dto';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value;

export enum IdTypeDto {
  PASSPORT = 'PASSPORT',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
}

export class RegisterBuyerDto {
  @ApiProperty({ example: 'Ava Khan' })
  @IsString()
  @IsNotEmpty()
  fullName: string;
  @ApiPropertyOptional({ example: '+15551234567' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  phone?: string;
  @ApiProperty({ example: 'buyer@example.com' }) @IsEmail() email: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password: string;
  @ApiPropertyOptional({ example: '123 Main St' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  streetAddress?: string;
  @ApiPropertyOptional({ example: 'Apt 4B' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  unitSuite?: string;
  @ApiPropertyOptional({ example: 'Toronto' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  city?: string;
  @ApiPropertyOptional({ example: 'Ontario' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  province?: string;
  @ApiPropertyOptional({ example: 'M5V 2T6' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class RegisterGroomerDto extends RegisterBuyerDto {
  @ApiProperty({ example: 5 }) @IsInt() @Min(0) experienceYears: number;
  @ApiProperty({ example: 'Ava Noor Khan' }) @IsString() legalFullName: string;
  @ApiProperty({ example: 'P1234567' }) @IsString() idNumber: string;
  @ApiProperty({ enum: IdTypeDto }) @IsEnum(IdTypeDto) idType: IdTypeDto;
  @ApiPropertyOptional({ example: true })
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  isRegisteredBusiness?: boolean;
  @ApiPropertyOptional({ example: 'Ava Mobile Grooming' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  businessName?: string;
  @ApiProperty({ example: 'Austin metro' }) @IsString() serviceArea: string;
  @ApiPropertyOptional({ example: '120 Market Street, Austin, TX' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  businessAddress?: string;
  @ApiPropertyOptional({ example: true })
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  isGstRegistered?: boolean;
  @ApiPropertyOptional({ example: '123456789RT0001' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  gstHstRegistrationNumber?: string;
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  profileImage?: string;
  @ApiPropertyOptional({ type: [GroomerCertificationDto] })
  @Transform(({ value }) => parseCertificationArray(value))
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroomerCertificationDto)
  certifications?: GroomerCertificationDto[];
  @ApiPropertyOptional({ type: [String], example: ['In-home grooming'] })
  @Transform(({ value }) => parseStringArray(value))
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceModes?: string[];
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  idFrontImage?: string;
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  idBackImage?: string;
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  selfieWithId?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'buyer@example.com' }) @IsEmail() email: string;
  @ApiProperty() @IsString() password: string;
}

export class RefreshTokenDto {
  @ApiProperty() @IsString() refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'buyer@example.com' }) @IsEmail() email: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() token: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) newPassword: string;
}

export class VerifyEmailDto {
  @ApiProperty({ example: '123456' }) @IsString() @IsNotEmpty() otp: string;
  @ApiProperty({ example: 'buyer@example.com' }) @IsEmail() email: string;
}
