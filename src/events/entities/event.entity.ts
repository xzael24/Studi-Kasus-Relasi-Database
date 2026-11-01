import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type EventStatus = 'draft' | 'published' | 'cancelled';

export interface EventLocation {
  name: string;
  address: string;
  city: string;
}

@Entity()
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  slug: string;

  @Column()
  description: string;

  @Column()
  categoryId: string;

  @Column({ type: 'json' })
  location: EventLocation;

  @Column()
  startDate: string;

  @Column()
  endDate: string;

  @Column()
  capacity: number;

  @Column()
  status: EventStatus;

  @Column()
  organizerId: string;

  @CreateDateColumn()
  createdAt: Date;
}