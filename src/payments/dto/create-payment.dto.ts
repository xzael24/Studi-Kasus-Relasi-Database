import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  readonly orderId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  readonly paymentMethod: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  readonly amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  readonly status?: string;

  @IsOptional()
  @IsDateString()
  readonly paidAt?: string;
}
