import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateShipmentDto {
  @IsUUID()
  readonly orderId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  readonly courier: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly trackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  readonly status?: string;

  @IsOptional()
  @IsDateString()
  readonly shippedAt?: string;

  @IsOptional()
  @IsDateString()
  readonly deliveredAt?: string;
}
