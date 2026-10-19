import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'jamal@example.com' })
  @IsNotEmpty({ message: 'Email wajib diisi ya' })
  @IsEmail({}, { message: 'Format email belum sesuai, mohon periksa kembali ya' })
  email: string;

  @ApiProperty({ example: 'password123', minLength: 3, maxLength: 10 })
  @IsNotEmpty({ message: 'Password wajib diisi ya' })
  @IsString({ message: 'Password harus berupa teks ya' })
  @MinLength(3, { message: 'Password minimal terdiri dari 3 karakter ya' })
  @MaxLength(10, { message: 'Password maksimal 10 karakter ya' })
  password: string;
}
