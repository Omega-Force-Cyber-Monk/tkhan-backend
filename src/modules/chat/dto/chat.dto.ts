import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
export class StartConversationDto {
  @ApiProperty() @IsString() groomerId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bookingId?: string;
}
export class SendMessageDto {
  @ApiProperty() @IsString() conversationId: string;
  @ApiProperty({ enum: ['TEXT', 'IMAGE', 'FILE'] })
  @IsEnum(['TEXT', 'IMAGE', 'FILE'])
  type: 'TEXT' | 'IMAGE' | 'FILE';
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  attachmentUrl?: string;
}
