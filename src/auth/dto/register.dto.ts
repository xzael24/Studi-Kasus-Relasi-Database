import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'Nama wajib diisi ya' })
  @IsString({ message: 'Nama harus berupa teks ya' })
  readonly name: string;

  @IsNotEmpty({ message: 'Email wajib diisi ya' })
  @IsEmail({}, { message: 'Format email belum sesuai, mohon periksa kembali ya' })
  readonly email: string;

  @IsOptional()
  @IsString({ message: 'Nomor telepon harus berupa teks ya' })
  readonly phone?: string;

  @IsNotEmpty({ message: 'Password wajib diisi ya' })
  @IsString({ message: 'Password harus berupa teks ya' })
  @MinLength(3, { message: 'Password minimal terdiri dari 3 karakter ya' })
  @MaxLength(10, { message: 'Password maksimal 10 karakter ya' })
  readonly password: string;
}
