import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const parseTodayFilter = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => {
        if (item === true || item === 'true') return true;
        if (item === false || item === 'false') return false;
        return undefined;
      })
      .filter((item): item is boolean => typeof item === 'boolean');
    if (normalized.length === 0) return undefined;
    if (normalized.includes(true) && normalized.includes(false)) {
      return undefined;
    }
    return normalized[normalized.length - 1];
  }
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

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
  @ApiPropertyOptional({
    description: 'Required only when serviceLocation is At-Home Grooming',
  })
  @IsOptional()
  @IsString()
  addressLine?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
  @ApiPropertyOptional({
    description:
      'Buyer ticked "I have reviewed my booking details and agree to Karoot\'s Terms & Conditions and Cancellation & Refund Policy".',
  })
  @IsOptional()
  @IsBoolean()
  acceptedTerms?: boolean;
  @ApiPropertyOptional({ example: '2026-11' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  termsVersion?: string;
}
export class CancelBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
export const ADMIN_REFUND_TYPES = [
  'POLICY',
  'FULL',
  'PARTIAL',
  'NONE',
] as const;
export class AdminCancelBookingDto {
  @ApiProperty({
    enum: ADMIN_REFUND_TYPES,
    description:
      'POLICY = apply the cancellation policy, FULL = 100% refund, PARTIAL = refund refundAmount, NONE = cancel without refund',
  })
  @IsIn([...ADMIN_REFUND_TYPES])
  refundType: (typeof ADMIN_REFUND_TYPES)[number];
  @ApiPropertyOptional({ description: 'Required for PARTIAL, in CAD' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  refundAmount?: number;
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
  @ApiPropertyOptional({
    description: 'Record a groomer no-show for this booking',
  })
  @IsOptional()
  @IsBoolean()
  recordGroomerNoShow?: boolean;
}
export class AdminRefundBookingDto {
  @ApiProperty({ enum: ['FULL', 'PARTIAL'] })
  @IsIn(['FULL', 'PARTIAL'])
  refundType: 'FULL' | 'PARTIAL';
  @ApiPropertyOptional({ description: 'Required for PARTIAL, in CAD' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  refundAmount?: number;
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
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

  @ApiPropertyOptional({
    type: Boolean,
    example: true,
    description:
      'true = only today, false = not today, omit = all bookings. If both true and false are sent, all bookings are returned.',
  })
  @IsOptional()
  @Transform(({ value }) => parseTodayFilter(value))
  @IsBoolean()
  today?: boolean;
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
