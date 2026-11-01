import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ORDER_STATUSES } from '../entities/order.entity.js';
import type { OrderStatus } from '../entities/order.entity.js';
import { CreateOrderItemDto } from './create-order-item.dto.js';

export class CreateOrderDto {
  @IsUUID()
  readonly customerId: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  readonly orderNumber?: string;

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  readonly status?: OrderStatus;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  readonly items: CreateOrderItemDto[];
}
