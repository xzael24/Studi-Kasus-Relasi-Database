import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  price: number;

  @Column()
  quota: number;

  @Column({ default: 0 })
  sold: number;

  @CreateDateColumn()
  createdAt: Date;
}