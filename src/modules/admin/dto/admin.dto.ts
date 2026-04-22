import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';
export class RejectGroomerDto {
  @ApiProperty() @IsString() reason: string;
}
export class AdminNoteDto {
  @ApiPropertyOptional() @IsString() note?: string;
}
