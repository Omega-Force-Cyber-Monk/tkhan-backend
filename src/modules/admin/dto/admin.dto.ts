import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail } from 'class-validator';
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
