import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateOrderItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  readonly quantity?: number;
}
