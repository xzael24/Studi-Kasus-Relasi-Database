import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity.js';
import { OrderItem } from './order-item.entity.js';
import { Payment } from '../../payments/entities/payment.entity.js';
import { Shipment } from '../../shipments/entities/shipment.entity.js';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.orders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Relation<Customer>;

  @Column({ name: 'order_number', type: 'varchar', length: 50, unique: true })
  orderNumber: string;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: OrderStatus;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalAmount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, {
    cascade: ['insert'],
  })
  items: Relation<OrderItem[]>;

  @OneToOne(() => Payment, (payment) => payment.order)
  payment: Relation<Payment | null>;

  @OneToOne(() => Shipment, (shipment) => shipment.order)
  shipment: Relation<Shipment | null>;
}
