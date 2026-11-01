import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  async findByEventId(eventId: string): Promise<Ticket[]> {
    return this.ticketRepository.find({ where: { eventId } });
  }

  async findById(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOneBy({ id });
    if (!ticket) throw new NotFoundException(`Ticket with id "${id}" not found`);
    return ticket;
  }

  async create(eventId: string, dto: CreateTicketDto): Promise<Ticket> {
    const ticket = this.ticketRepository.create({
      eventId,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      quota: dto.quota,
      sold: 0,
    });

    return this.ticketRepository.save(ticket);
  }

  async incrementSold(ticketId: string): Promise<Ticket> {
    const ticket = await this.findById(ticketId);
    if (ticket.sold >= ticket.quota) {
      throw new BadRequestException('Ticket quota is full');
    }
    ticket.sold += 1;
    return this.ticketRepository.save(ticket);
  }

  async decrementSold(ticketId: string): Promise<void> {
    const ticket = await this.findById(ticketId);
    if (ticket.sold > 0) {
      ticket.sold -= 1;
      await this.ticketRepository.save(ticket);
    }
  }

  getAvailable(ticket: Ticket): number {
    return ticket.quota - ticket.sold;
  }
}