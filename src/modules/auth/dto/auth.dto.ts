import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

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
  @ApiProperty({ example: 'https://cdn.example.com/id-front.jpg' })
  @IsString()
  idFrontImage: string;
  @ApiProperty({ example: 'https://cdn.example.com/id-back.jpg' })
  @IsString()
  idBackImage: string;
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
