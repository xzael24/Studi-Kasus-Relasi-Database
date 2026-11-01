import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type RegistrationStatus = 'registered' | 'cancelled' | 'checked_in';

@Entity()
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventId: string;

  @Column()
  userId: string;

  @Column()
  ticketId: string;

  @Column()
  status: RegistrationStatus;

  @CreateDateColumn()
  registeredAt: Date;

  @Column({ nullable: true })
  checkedInAt?: Date;
}