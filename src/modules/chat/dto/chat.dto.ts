import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
export class StartConversationDto {
  @ApiProperty({
    description: 'Target user id. Direct chat is created between buyer and groomer.',
  })
  @IsString()
  userId: string;
}
export class SendMessageDto {
  @ApiProperty() @IsString() conversationId: string;
  @ApiProperty({ enum: ['TEXT', 'IMAGE', 'FILE'] })
  @IsEnum(['TEXT', 'IMAGE', 'FILE'])
  type: 'TEXT' | 'IMAGE' | 'FILE';
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiHideProperty()
  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}
