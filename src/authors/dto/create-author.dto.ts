import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAuthorDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  readonly name: string;
}
