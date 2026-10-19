import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Ticket } from './entities/ticket.entity.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';

@Injectable()
export class TicketsService {
  private tickets: Ticket[] = [];

  findByEventId(eventId: string): Ticket[] {
    return this.tickets.filter((t) => t.eventId === eventId);
  }

  findById(id: string): Ticket {
    const ticket = this.tickets.find((t) => t.id === id);
    if (!ticket) throw new NotFoundException(`Ticket with id "${id}" not found`);
    return ticket;
  }

  create(eventId: string, dto: CreateTicketDto): Ticket {
    const ticket: Ticket = {
      id: `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventId,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      quota: dto.quota,
      sold: 0,
      createdAt: new Date(),
    };
    this.tickets.push(ticket);
    return ticket;
  }

  incrementSold(ticketId: string): Ticket {
    const ticket = this.findById(ticketId);
    if (ticket.sold >= ticket.quota) {
      throw new BadRequestException('Ticket quota is full');
    }
    ticket.sold += 1;
    return ticket;
  }

  decrementSold(ticketId: string): void {
    const ticket = this.findById(ticketId);
    if (ticket.sold > 0) {
      ticket.sold -= 1;
    }
  }

  getAvailable(ticket: Ticket): number {
    return ticket.quota - ticket.sold;
  }
}
