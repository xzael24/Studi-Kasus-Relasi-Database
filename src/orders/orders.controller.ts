import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { Order } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { CreateOrderItemDto } from './dto/create-order-item.dto.js';
import { UpdateOrderItemDto } from './dto/update-order-item.dto.js';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(): Promise<Order[]> {
    return this.ordersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Order> {
    return this.ordersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.ordersService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ): Promise<Order> {
    return this.ordersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.ordersService.remove(id);
  }

  @Get(':id/items')
  findItems(@Param('id') id: string): Promise<OrderItem[]> {
    return this.ordersService.findItems(id);
  }

  @Post(':id/items')
  addItem(
    @Param('id') id: string,
    @Body() dto: CreateOrderItemDto,
  ): Promise<OrderItem> {
    return this.ordersService.addItem(id, dto);
  }

  @Put(':id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateOrderItemDto,
  ): Promise<OrderItem> {
    return this.ordersService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<{ message: string }> {
    return this.ordersService.removeItem(id, itemId);
  }
}
