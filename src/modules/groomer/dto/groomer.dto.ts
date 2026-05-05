import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
export class UpdateGroomerProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() profileImage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shortBio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() about?: string;
  @ApiPropertyOptional({
    example: 'https://cdn.example.com/selfie-with-id.jpg',
    description:
      'Selfie with ID image - the user should be visible with their ID in the frame',
  })
  @IsOptional()
  @IsString()
  selfieWithId?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  certifications?: string[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  availableForBookings?: boolean;
}
