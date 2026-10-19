import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EventLocationDto {
  @ApiProperty({ example: 'Jakarta Convention Center' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'Jl. Gatot Subroto' })
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  address: string;

  @ApiProperty({ example: 'Jakarta' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;
}

export class CreateEventDto {
  @ApiProperty({ example: 'NestJS Workshop', minLength: 3, maxLength: 150 })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @ApiProperty({ example: 'Learn NestJS from beginner to advanced', minLength: 10 })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({ example: 'cat_001' })
  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({ type: EventLocationDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => EventLocationDto)
  location: EventLocationDto;

  @ApiProperty({ example: '2026-11-10T09:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-11-10T17:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 100, minimum: 1 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  capacity: number;
}
