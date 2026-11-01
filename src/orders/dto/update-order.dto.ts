import { IsIn, IsOptional } from 'class-validator';
import { ORDER_STATUSES } from '../entities/order.entity.js';
import type { OrderStatus } from '../entities/order.entity.js';

export class UpdateOrderDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  readonly status?: OrderStatus;
}
