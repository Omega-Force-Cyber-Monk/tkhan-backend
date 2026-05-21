import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateGroomerBankAccountDto {
  @ApiProperty() @IsString() accountHolderName!: string;
  @ApiProperty() @IsString() bankName!: string;
  @ApiProperty() @IsString() accountNumber!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branchName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() routingNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mobileBankingType?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateGroomerBankAccountDto {
  @ApiPropertyOptional() @IsOptional() @IsString() accountHolderName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accountNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branchName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() routingNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mobileBankingType?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class CreateWithdrawalRequestDto {
  @ApiProperty() @IsString() bankAccountId!: string;
  @ApiProperty({ example: 250 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}

export class WithdrawalRequestQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED'],
  })
  @IsOptional()
  @IsEnum(['REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED'])
  status?: 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED' | 'CANCELLED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groomerId?: string;
}

export class AdminApproveWithdrawalRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class AdminRejectWithdrawalRequestDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}

export class AdminMarkWithdrawalPaidDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transferReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
