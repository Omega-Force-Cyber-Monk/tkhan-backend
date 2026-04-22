import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
export class CreateTicketDto {
  @ApiProperty() @IsString() subject: string;
  @ApiProperty() @IsString() message: string;
  @ApiPropertyOptional() @IsOptional() @IsString() relatedBookingId?: string;
}
export class ReplyTicketDto {
  @ApiProperty() @IsString() message: string;
}
