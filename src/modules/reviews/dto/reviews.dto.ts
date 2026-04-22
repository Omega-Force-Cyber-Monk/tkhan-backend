import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
export class CreateReviewDto {
  @ApiProperty() @IsString() bookingId: string;
  @ApiProperty({ enum: ['GROOMER', 'BUYER'] })
  @IsEnum(['GROOMER', 'BUYER'])
  targetType: 'GROOMER' | 'BUYER';
  @ApiProperty() @IsInt() @Min(1) @Max(5) rating: number;
  @ApiPropertyOptional() @IsOptional() @IsString() feedback?: string;
}
