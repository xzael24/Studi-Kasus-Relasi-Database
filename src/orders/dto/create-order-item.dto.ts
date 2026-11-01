import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';

export class CreateOrderItemDto {
  @IsNotEmpty()
  @IsUUID()
  readonly bookId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  readonly quantity: number;
}
