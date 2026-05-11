import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
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

export enum IdTypeDto {
  PASSPORT = 'PASSPORT',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
}

export class RegisterBuyerDto {
  @ApiProperty({ example: 'Ava Khan' })
  @IsString()
  @IsNotEmpty()
  fullName: string;
  @ApiProperty({ example: '+15551234567' }) @IsString() phone: string;
  @ApiProperty({ example: 'buyer@example.com' }) @IsEmail() email: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password: string;
  @ApiProperty({ example: 'Austin, TX' }) @IsString() locationText: string;
  @ApiProperty({ example: 'TX' }) @IsString() state: string;
}

export class RegisterGroomerDto extends RegisterBuyerDto {
  @ApiProperty({ example: 5 }) @IsInt() @Min(0) experienceYears: number;
  @ApiProperty({ example: 'Ava Noor Khan' }) @IsString() legalFullName: string;
  @ApiProperty({ example: 'P1234567' }) @IsString() idNumber: string;
  @ApiProperty({ enum: IdTypeDto }) @IsEnum(IdTypeDto) idType: IdTypeDto;
  @ApiProperty({ example: 'Ava Mobile Grooming' })
  @IsString()
  businessName: string;
  @ApiProperty({ example: 'Austin metro' }) @IsString() serviceArea: string;
  @ApiProperty({ example: '120 Market Street, Austin, TX' })
  @IsString()
  businessAddress: string;
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
  @ApiProperty() @IsString() token: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
}
