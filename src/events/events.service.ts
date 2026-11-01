import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { EventFilterDto } from './dto/event-filter.dto.js';
import { EventCategoriesService } from '../event-categories/event-categories.service.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly categoriesService: EventCategoriesService,
  ) {}

  async findAll(filter: EventFilterDto) {
    const qb = this.eventRepository.createQueryBuilder('event');

    if (filter.search) {
      const q = `%${filter.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(event.title) LIKE :q OR LOWER(event.description) LIKE :q)',
        { q },
      );
    }

    if (filter.status) {
      qb.andWhere('event.status = :status', { status: filter.status });
    }

    if (filter.startDate) {
      qb.andWhere('event.startDate >= :startDate', {
        startDate: filter.startDate,
      });
    }
    if (filter.endDate) {
      qb.andWhere('event.endDate <= :endDate', {
        endDate: filter.endDate,
      });
    }

    const [events, total] = await qb.getManyAndCount();

    // Load all categories once to avoid N+1 lookups
    const allCategories = await this.categoriesService.findAll();
    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

    let results = events;

    if (filter.category) {
      const slug = filter.category.toLowerCase();
      results = results.filter((e) => {
        const cat = categoryMap.get(e.categoryId);
        if (!cat) return false;
        return cat.slug === slug || cat.name.toLowerCase() === slug;
      });
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const offset = (page - 1) * limit;
    const paged = results.slice(offset, offset + limit);

    const data = paged.map((e) => {
      const cat = categoryMap.get(e.categoryId);
      const category = cat ? { id: cat.id, name: cat.name } : undefined;
      return {
        id: e.id,
        title: e.title,
        slug: e.slug,
        description: e.description,
        location: e.location.city,
        startDate: e.startDate,
        endDate: e.endDate,
        status: e.status,
        category,
      };
    });

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Event> {
    const event = await this.eventRepository.findOneBy({ id });
    if (!event) throw new NotFoundException(`Event with id "${id}" not found`);
    return event;
  }

  async create(dto: CreateEventDto, organizerId: string): Promise<Event> {
    // Business validation: endDate > startDate
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }

    // Validate category exists
    await this.categoriesService.findById(dto.categoryId);

    const event = this.eventRepository.create({
      title: dto.title,
      slug: slugify(dto.title),
      description: dto.description,
      categoryId: dto.categoryId,
      location: dto.location,
      startDate: dto.startDate,
      endDate: dto.endDate,
      capacity: dto.capacity,
      status: 'draft',
      organizerId,
    });

    return this.eventRepository.save(event);
  }

  async update(id: string, dto: UpdateEventDto, userId: string): Promise<Event> {
    const event = await this.findById(id);

    if (event.organizerId !== userId) {
      throw new ForbiddenException('You are not the organizer of this event');
    }

    if (dto.title) {
      event.title = dto.title;
      event.slug = slugify(dto.title);
    }
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.categoryId) {
      await this.categoriesService.findById(dto.categoryId);
      event.categoryId = dto.categoryId;
    }
    if (dto.location) event.location = dto.location;
    if (dto.startDate !== undefined) event.startDate = dto.startDate;
    if (dto.endDate !== undefined) event.endDate = dto.endDate;
    if (dto.capacity !== undefined) event.capacity = dto.capacity;

    // Business validation: endDate > startDate
    if (new Date(event.endDate) <= new Date(event.startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }

    return this.eventRepository.save(event);
  }

  async delete(id: string, userId: string): Promise<void> {
    const event = await this.findById(id);
    if (event.organizerId !== userId) {
      throw new ForbiddenException('You are not the organizer of this event');
    }
    await this.eventRepository.remove(event);
  }

  async publish(id: string, userId: string): Promise<Event> {
    const event = await this.findById(id);
    if (event.organizerId !== userId) {
      throw new ForbiddenException('You are not the organizer of this event');
    }
    if (event.status === 'published') {
      throw new BadRequestException('Event is already published');
    }
    event.status = 'published';
    return this.eventRepository.save(event);
  }

  async getEventWithDetails(
    id: string,
    registrationsCount: number,
  ) {
    const event = await this.findById(id);
    let category: { id: string; name: string } | undefined;
    try {
      const cat = await this.categoriesService.findById(event.categoryId);
      category = { id: cat.id, name: cat.name };
    } catch {
      // ok
    }

    return {
      id: event.id,
      title: event.title,
      slug: event.slug,
      description: event.description,
      location: event.location,
      startDate: event.startDate,
      endDate: event.endDate,
      capacity: event.capacity,
      registered: registrationsCount,
      available: event.capacity - registrationsCount,
      status: event.status,
      category,
      organizer: { id: event.organizerId },
    };
  }
}