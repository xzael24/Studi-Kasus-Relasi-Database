import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Category } from '../../categories/entities/categories.entity.js';
import { Publisher } from '../../publishers/entities/publisher.entity.js';
import { BookAuthor } from './book-author.entity.js';
import { OrderItem } from '../../orders/entities/order-item.entity.js';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';

@Entity({ name: 'books' })
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  title: string;

  @Column({ type: 'varchar', length: 45, unique: true })
  isbn: string;

  @Column({ type: 'int', default: 0 })
  publishedYear: number;

  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  price: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, (category) => category.books, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: Relation<Category | null>;

  @Column({ name: 'publisher_id', type: 'uuid', nullable: true })
  publisherId: string | null;

  @ManyToOne(() => Publisher, (publisher) => publisher.books, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'publisher_id' })
  publisher: Relation<Publisher | null>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => BookAuthor, (bookAuthor) => bookAuthor.book)
  bookAuthors: Relation<BookAuthor[]>;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.book)
  orderItems: Relation<OrderItem[]>;
}
