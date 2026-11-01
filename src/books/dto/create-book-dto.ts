import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  readonly title: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(45)
  readonly isbn: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  readonly publishedYear?: number;

  @IsOptional()
  @IsBoolean()
  readonly isAvailable?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  readonly price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  readonly stock?: number;

  @IsOptional()
  @IsUUID()
  readonly categoryId?: string;

  @IsOptional()
  @IsUUID()
  readonly publisherId?: string;
}
