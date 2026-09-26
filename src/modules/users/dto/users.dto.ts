import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const emptyToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

export class UserFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['BUYER', 'GROOMER', 'ADMIN'] })
  @IsOptional()
  @IsEnum(['BUYER', 'GROOMER', 'ADMIN'])
  role?: 'BUYER' | 'GROOMER' | 'ADMIN';
  @ApiPropertyOptional({
    enum: ['PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'INACTIVE', 'SUSPENDED'],
  })
  @IsOptional()
  @IsEnum(['PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() fullName?: string;
  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  phone?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sharePhoneWithBookingPartners?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() profileImage?: string;
  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  streetAddress?: string | null;
  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  unitSuite?: string | null;
  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  city?: string | null;
  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  province?: string | null;
  @ApiPropertyOptional()
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  postalCode?: string | null;
}

export class BlockUserDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isBlocked?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
