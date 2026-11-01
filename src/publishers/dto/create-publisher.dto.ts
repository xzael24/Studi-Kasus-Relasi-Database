import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePublisherDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  readonly name: string;
}
