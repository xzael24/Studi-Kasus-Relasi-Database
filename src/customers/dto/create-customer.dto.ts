import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCustomerDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  readonly name: string;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(150)
  readonly email: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  readonly phone: string;
}
