import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Order } from './order.entity.js';
import { Book } from '../../books/entities/book.entity.js';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';

@Entity({ name: 'order_items' })
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Relation<Order>;

  @Column({ name: 'book_id', type: 'uuid' })
  bookId: string;

  @ManyToOne(() => Book, (book) => book.orderItems)
  @JoinColumn({ name: 'book_id' })
  book: Relation<Book>;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  price: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  subtotal: number;
}
