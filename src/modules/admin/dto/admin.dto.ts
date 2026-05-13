import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const ADMIN_USER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'fullName',
  'email',
  'role',
  'status',
] as const;

export class RejectGroomerDto {
  @ApiProperty() @IsString() reason: string;
}
export class AdminNoteDto {
  @ApiPropertyOptional() @IsString() note?: string;
}
export class CreateAdminDto {
  @ApiProperty() @IsString() fullName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() phone: string;
  @ApiProperty() @IsString() password: string;
  @ApiPropertyOptional() @IsString() locationText?: string;
  @ApiPropertyOptional() @IsString() state?: string;
}

export class AdminUserFilterDto extends PaginationDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isBlocked?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional({
    enum: ADMIN_USER_SORT_FIELDS,
    default: 'createdAt',
    example: 'createdAt',
  })
  @IsOptional()
  @IsIn([...ADMIN_USER_SORT_FIELDS])
  sortBy: (typeof ADMIN_USER_SORT_FIELDS)[number] = 'createdAt';
}

export class AdminBlockUserDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isBlocked?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
