import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const REPORT_ISSUE_PROBLEMS = [
  'Groomer is late',
  'Pet owner is anxious',
  'Groomer is stuck in traffic',
  'Appointment needs to be rescheduled',
  'Service quality issue',
  'Other',
] as const;

export class CreateTicketDto {
  @ApiProperty() @IsString() subject: string;
  @ApiProperty() @IsString() message: string;
  @ApiPropertyOptional() @IsOptional() @IsString() relatedBookingId?: string;
}
export class ReportIssueDto {
  @ApiProperty({ enum: REPORT_ISSUE_PROBLEMS })
  @IsString()
  @IsIn([...REPORT_ISSUE_PROBLEMS])
  problem: (typeof REPORT_ISSUE_PROBLEMS)[number];

  @ApiProperty({ example: 'Please describe the issue in detail...' })
  @IsString()
  @MinLength(1)
  details: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relatedBookingId?: string;
}
export class ReplyTicketDto {
  @ApiProperty() @IsString() message: string;
}
