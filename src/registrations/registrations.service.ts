import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from './entities/registration.entity.js';
import { CreateRegistrationDto } from './dto/create-registration.dto.js';
import { EventsService } from '../events/events.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(Registration)
    private readonly registrationRepository: Repository<Registration>,
    @Inject(forwardRef(() => EventsService))
    private readonly eventsService: EventsService,
    private readonly ticketsService: TicketsService,
    private readonly usersService: UsersService,
  ) {}

  async register(
    eventId: string,
    dto: CreateRegistrationDto,
    userId: string,
  ): Promise<Registration> {
    // Check event exists and is published
    const event = await this.eventsService.findById(eventId);
    if (event.status !== 'published') {
      throw new BadRequestException('Event is not published');
    }

    // Check event has not started
    if (new Date(event.startDate) <= new Date()) {
      throw new BadRequestException('Event has already started');
    }

    // Check ticket exists and belongs to the event
    const ticket = await this.ticketsService.findById(dto.ticketTypeId);
    if (ticket.eventId !== eventId) {
      throw new BadRequestException('Ticket does not belong to this event');
    }

    // Check ticket availability
    if (ticket.sold >= ticket.quota) {
      throw new BadRequestException('Ticket quota is full');
    }

    // Check user not already registered for this event
    const alreadyRegistered = await this.registrationRepository
      .createQueryBuilder('registration')
      .where('registration.eventId = :eventId', { eventId })
      .andWhere('registration.userId = :userId', { userId })
      .andWhere('registration.status != :cancelled', {
        cancelled: 'cancelled',
      })
      .getOne();
    if (alreadyRegistered) {
      throw new BadRequestException('You are already registered for this event');
    }

    // Increment ticket sold
    await this.ticketsService.incrementSold(dto.ticketTypeId);

    const registration = this.registrationRepository.create({
      eventId,
      userId,
      ticketId: dto.ticketTypeId,
      status: 'registered',
      registeredAt: new Date(),
    });

    return this.registrationRepository.save(registration);
  }

  async findById(id: string): Promise<Registration> {
    const reg = await this.registrationRepository.findOneBy({ id });
    if (!reg) throw new NotFoundException(`Registration with id "${id}" not found`);
    return reg;
  }

  async findByUserId(userId: string): Promise<Registration[]> {
    return this.registrationRepository.find({ where: { userId } });
  }

  async findByEventId(eventId: string): Promise<Registration[]> {
    return this.registrationRepository.find({ where: { eventId } });
  }

  async cancel(id: string, userId: string): Promise<void> {
    const reg = await this.findById(id);
    if (reg.userId !== userId) {
      throw new ForbiddenException('You cannot cancel this registration');
    }
    if (reg.status === 'cancelled') {
      throw new BadRequestException('Registration is already cancelled');
    }

    // Refund ticket quota
    await this.ticketsService.decrementSold(reg.ticketId);
    reg.status = 'cancelled';
    await this.registrationRepository.save(reg);
  }

  async checkIn(
    eventId: string,
    registrationId: string,
  ): Promise<Registration> {
    const reg = await this.findById(registrationId);

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
    return this.registrationRepository.save(reg);
  }

  async getAttendeesForEvent(
    eventId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
  ) {
    const registrations = await this.registrationRepository
      .createQueryBuilder('registration')
      .where('registration.eventId = :eventId', { eventId })
      .andWhere('registration.status != :cancelled', {
        cancelled: 'cancelled',
      })
      .getMany();

    let results = registrations;

    if (search) {
      const q = search.toLowerCase();
      results = (
        await Promise.all(
          registrations.map(async (r) => {
            const user = await this.usersService.findById(r.userId);
            return user &&
              (user.name.toLowerCase().includes(q) ||
                user.email.toLowerCase().includes(q))
              ? r
              : null;
          }),
        )
      ).filter((r): r is Registration => r !== null);
    }

    const total = results.length;
    const offset = (page - 1) * limit;
    const paged = results.slice(offset, offset + limit);

    return { registrations: paged, total };
  }

  async countByEventId(eventId: string): Promise<number> {
    return this.registrationRepository
      .createQueryBuilder('registration')
      .where('registration.eventId = :eventId', { eventId })
      .andWhere('registration.status != :cancelled', {
        cancelled: 'cancelled',
      })
      .getCount();
  }
}