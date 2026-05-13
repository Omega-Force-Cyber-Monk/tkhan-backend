import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const BOOKING_STATUSES = [
  'PAYMENT_PENDING',
  'PENDING',
  'REQUESTED',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'IN_PROGRESS',
  'COMPLETION_REQUESTED',
  'COMPLETED',
  'REFUNDED',
] as const;

export const BOOKING_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'requestedAt',
  'acceptedAt',
  'completedAt',
  'totalAmount',
  'status',
] as const;

export class CreateBookingDto {
  @ApiProperty() @IsString() groomerId: string;
  @ApiProperty() @IsString() serviceId: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  addonIds?: string[];
  @ApiProperty() @IsString() availabilitySlotId: string;
  @ApiProperty() @IsString() petId: string;
  @ApiProperty() @IsString() serviceLocation: string;
  @ApiProperty() @IsString() addressLine: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
export class BookingQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: BOOKING_SORT_FIELDS,
    default: 'createdAt',
    example: 'createdAt',
  })
  @IsOptional()
  @IsIn([...BOOKING_SORT_FIELDS])
  sortBy: (typeof BOOKING_SORT_FIELDS)[number] = 'createdAt';

  @ApiPropertyOptional({
    enum: BOOKING_STATUSES,
    example: 'COMPLETED',
  })
  @IsOptional()
  @IsIn([...BOOKING_STATUSES])
  status?: (typeof BOOKING_STATUSES)[number];
}
export class BookingDecisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
export class CompletionRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
export class UploadBookingImagesDto {
  beforeImage?: string;
  afterImage?: string;
}
