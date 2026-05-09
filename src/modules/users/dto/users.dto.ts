import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

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
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  profileImage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locationText?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
}

export class BlockUserDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isBlocked?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
