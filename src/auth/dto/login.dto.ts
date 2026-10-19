import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Email wajib diisi ya' })
  @IsEmail({}, { message: 'Format email belum sesuai, mohon periksa kembali ya' })
  readonly email: string;

  @IsNotEmpty({ message: 'Password wajib diisi ya' })
  @IsString({ message: 'Password harus berupa teks ya' })
  @MinLength(3, { message: 'Password minimal terdiri dari 3 karakter ya' })
  @MaxLength(10, { message: 'Password maksimal 10 karakter ya' })
  readonly password: string;
}
