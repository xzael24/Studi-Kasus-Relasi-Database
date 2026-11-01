import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCustomerAddressDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  readonly recipientName: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  readonly phone: string;

  @IsNotEmpty()
  @IsString()
  readonly address: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  readonly city: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(10)
  readonly postalCode: string;
}
