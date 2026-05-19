import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateFavoriteDto {
  @ApiProperty({
    example: true,
    description: 'Whether the current buyer wants this groomer in favorites.',
  })
  @IsBoolean()
  isFavorite!: boolean;
}
