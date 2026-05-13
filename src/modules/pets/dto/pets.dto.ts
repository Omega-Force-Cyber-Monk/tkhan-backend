import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
export class CreatePetDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() breed?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) age?: number;

  @ApiPropertyOptional({ type: 'string', readOnly: true })
  @IsOptional()
  @IsString()
  petImage?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() temperament?: string;
  @ApiProperty({ enum: ['DOG', 'CAT', 'RABBIT', 'OTHER'] })
  @IsEnum(['DOG', 'CAT', 'RABBIT', 'OTHER'])
  petType: 'DOG' | 'CAT' | 'RABBIT' | 'OTHER';
  @ApiProperty({ enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE'] })
  @IsEnum(['SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE'])
  petSize: 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE';
}
export class UpdatePetDto extends PartialType(CreatePetDto) {}
