import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
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
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
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
