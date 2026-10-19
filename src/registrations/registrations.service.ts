import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Registration } from './entities/registration.entity.js';
import { CreateRegistrationDto } from './dto/create-registration.dto.js';
import { EventsService } from '../events/events.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class RegistrationsService {
  private registrations: Registration[] = [];

  constructor(
    @Inject(forwardRef(() => EventsService))
    private readonly eventsService: EventsService,
    private readonly ticketsService: TicketsService,
    private readonly usersService: UsersService,
  ) {}

  register(
    eventId: string,
    dto: CreateRegistrationDto,
    userId: string,
  ): Registration {
    // Check event exists and is published
    const event = this.eventsService.findById(eventId);
    if (event.status !== 'published') {
      throw new BadRequestException('Event is not published');
    }

    // Check event has not started
    if (new Date(event.startDate) <= new Date()) {
      throw new BadRequestException('Event has already started');
    }

    // Check ticket exists and belongs to the event
    const ticket = this.ticketsService.findById(dto.ticketTypeId);
    if (ticket.eventId !== eventId) {
      throw new BadRequestException('Ticket does not belong to this event');
    }

    // Check ticket availability
    if (ticket.sold >= ticket.quota) {
      throw new BadRequestException('Ticket quota is full');
    }

    // Check user not already registered for this event
    const alreadyRegistered = this.registrations.find(
      (r) =>
        r.eventId === eventId &&
        r.userId === userId &&
        r.status !== 'cancelled',
    );
    if (alreadyRegistered) {
      throw new BadRequestException('You are already registered for this event');
    }

    // Increment ticket sold
    this.ticketsService.incrementSold(dto.ticketTypeId);

    const registration: Registration = {
      id: `reg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventId,
      userId,
      ticketId: dto.ticketTypeId,
      status: 'registered',
      registeredAt: new Date(),
    };

    this.registrations.push(registration);
    return registration;
  }

  findById(id: string): Registration {
    const reg = this.registrations.find((r) => r.id === id);
    if (!reg) throw new NotFoundException(`Registration with id "${id}" not found`);
    return reg;
  }

  findByUserId(userId: string): Registration[] {
    return this.registrations.filter((r) => r.userId === userId);
  }

  findByEventId(eventId: string): Registration[] {
    return this.registrations.filter((r) => r.eventId === eventId);
  }

  cancel(id: string, userId: string): void {
    const reg = this.findById(id);
    if (reg.userId !== userId) {
      throw new ForbiddenException('You cannot cancel this registration');
    }
    if (reg.status === 'cancelled') {
      throw new BadRequestException('Registration is already cancelled');
    }

    // Refund ticket quota
    this.ticketsService.decrementSold(reg.ticketId);
    reg.status = 'cancelled';
  }

  checkIn(eventId: string, registrationId: string): Registration {
    const reg = this.findById(registrationId);

    if (reg.eventId !== eventId) {
      throw new BadRequestException('Registration does not belong to this event');
    }

    if (reg.status === 'cancelled') {
      throw new BadRequestException('Registration is cancelled');
    }

    if (reg.status === 'checked_in') {
      throw new BadRequestException('Attendee has already checked in');
    }

    reg.status = 'checked_in';
    reg.checkedInAt = new Date();
    return reg;
  }

  getAttendeesForEvent(
    eventId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
  ) {
    let regs = this.registrations.filter(
      (r) => r.eventId === eventId && r.status !== 'cancelled',
    );

    if (search) {
      const q = search.toLowerCase();
      regs = regs.filter((r) => {
        const user = this.usersService.findById(r.userId);
        return (
          user?.name.toLowerCase().includes(q) ||
          user?.email.toLowerCase().includes(q)
        );
      });
    }

    const total = regs.length;
    const offset = (page - 1) * limit;
    const paged = regs.slice(offset, offset + limit);

    return { registrations: paged, total };
  }

  countByEventId(eventId: string): number {
    return this.registrations.filter(
      (r) => r.eventId === eventId && r.status !== 'cancelled',
    ).length;
  }
}
