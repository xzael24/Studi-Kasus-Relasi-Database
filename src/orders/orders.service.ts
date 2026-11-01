import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Book } from '../books/entities/book.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { CreateOrderItemDto } from './dto/create-order-item.dto.js';
import { UpdateOrderItemDto } from './dto/update-order-item.dto.js';

const ORDER_RELATIONS = {
  customer: true,
  items: { book: true },
  payment: true,
  shipment: true,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
  ) {}

  findAll(): Promise<Order[]> {
    return this.orderRepository.find({ relations: ORDER_RELATIONS });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ORDER_RELATIONS,
    });
    if (!order) {
      throw new NotFoundException(`Order dengan ID ${id} tidak ditemukan`);
    }
    return order;
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    const books = await this.bookRepository.findBy({
      id: In(dto.items.map((item) => item.bookId)),
    });
    const items = dto.items.map((item) => this.buildItem(item, books));
    const order = this.orderRepository.create({
      customerId: dto.customerId,
      orderNumber: dto.orderNumber ?? `ORD-${Date.now()}`,
      status: dto.status ?? 'pending',
      totalAmount: round2(items.reduce((sum, item) => sum + item.subtotal, 0)),
      items,
    });
    const saved = await this.orderRepository.save(order);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateOrderDto): Promise<Order> {
    await this.findOne(id);
    await this.orderRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    const order = await this.findOne(id);
    await this.orderRepository.remove(order);
    return { message: `Order dengan ID ${id} berhasil dihapus` };
  }

  async findItems(orderId: string): Promise<OrderItem[]> {
    await this.findOne(orderId);
    return this.orderItemRepository.find({
      where: { orderId },
      relations: { book: true },
    });
  }

  async addItem(orderId: string, dto: CreateOrderItemDto): Promise<OrderItem> {
    await this.findOne(orderId);
    const book = await this.bookRepository.findOneBy({ id: dto.bookId });
    if (!book) {
      throw new NotFoundException(`Buku dengan ID ${dto.bookId} tidak ditemukan`);
    }
    const item = this.orderItemRepository.create({
      orderId,
      bookId: book.id,
      quantity: dto.quantity,
      price: book.price,
      subtotal: round2(book.price * dto.quantity),
    });
    const saved = await this.orderItemRepository.save(item);
    await this.recalculateTotal(orderId);
    return saved;
  }

  async updateItem(
    orderId: string,
    itemId: string,
    dto: UpdateOrderItemDto,
  ): Promise<OrderItem> {
    const item = await this.findItem(orderId, itemId);
    const quantity = dto.quantity ?? item.quantity;
    await this.orderItemRepository.update(itemId, {
      quantity,
      subtotal: round2(item.price * quantity),
    });
    await this.recalculateTotal(orderId);
    return this.findItem(orderId, itemId);
  }

  async removeItem(
    orderId: string,
    itemId: string,
  ): Promise<{ message: string }> {
    await this.findItem(orderId, itemId);
    await this.orderItemRepository.delete(itemId);
    await this.recalculateTotal(orderId);
    return { message: `Order item ${itemId} berhasil dihapus` };
  }

  private async findItem(
    orderId: string,
    itemId: string,
  ): Promise<OrderItem> {
    const item = await this.orderItemRepository.findOneBy({
      id: itemId,
      orderId,
    });
    if (!item) {
      throw new NotFoundException(`Order item ${itemId} tidak ditemukan`);
    }
    return item;
  }

  // total_amount adalah snapshot, jadi harus dihitung ulang tiap detail berubah
  private async recalculateTotal(orderId: string): Promise<void> {
    const items = await this.orderItemRepository.find({ where: { orderId } });
    const total = round2(items.reduce((sum, item) => sum + item.subtotal, 0));
    await this.orderRepository.update(orderId, { totalAmount: total });
  }

  private buildItem(dto: CreateOrderItemDto, books: Book[]) {
    const book = books.find((candidate) => candidate.id === dto.bookId);
    if (!book) {
      throw new NotFoundException(`Buku dengan ID ${dto.bookId} tidak ditemukan`);
    }
    return this.orderItemRepository.create({
      bookId: book.id,
      quantity: dto.quantity,
      price: book.price,
      subtotal: round2(book.price * dto.quantity),
    });
  }
}
