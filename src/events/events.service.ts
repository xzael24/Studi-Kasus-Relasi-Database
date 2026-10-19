import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
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
  private events: Event[] = [];

  constructor(private readonly categoriesService: EventCategoriesService) {}

  findAll(filter: EventFilterDto) {
    let results = [...this.events];

    // Filter by search (title or description)
    if (filter.search) {
      const q = filter.search.toLowerCase();
      results = results.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q),
      );
    }

    // Filter by category slug
    if (filter.category) {
      const slug = filter.category.toLowerCase();
      results = results.filter((e) => {
        try {
          const cat = this.categoriesService.findById(e.categoryId);
          return cat.slug === slug || cat.name.toLowerCase() === slug;
        } catch {
          return false;
        }
      });
    }

    // Filter by status
    if (filter.status) {
      results = results.filter((e) => e.status === filter.status);
    }

    // Filter by date range
    if (filter.startDate) {
      results = results.filter(
        (e) => new Date(e.startDate) >= new Date(filter.startDate!),
      );
    }
    if (filter.endDate) {
      results = results.filter(
        (e) => new Date(e.endDate) <= new Date(filter.endDate!),
      );
    }

    const total = results.length;
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const offset = (page - 1) * limit;
    const paged = results.slice(offset, offset + limit);

    const data = paged.map((e) => {
      let category: { id: string; name: string } | undefined;
      try {
        const cat = this.categoriesService.findById(e.categoryId);
        category = { id: cat.id, name: cat.name };
      } catch {
        // category might have been deleted
      }
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

  findById(id: string): Event {
    const event = this.events.find((e) => e.id === id);
    if (!event) throw new NotFoundException(`Event with id "${id}" not found`);
    return event;
  }

  create(dto: CreateEventDto, organizerId: string): Event {
    // Business validation: endDate > startDate
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }

    // Validate category exists
    this.categoriesService.findById(dto.categoryId);

    const event: Event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
      createdAt: new Date(),
    };

    this.events.push(event);
    return event;
  }

  update(id: string, dto: UpdateEventDto, userId: string): Event {
    const event = this.findById(id);

    if (event.organizerId !== userId) {
      throw new ForbiddenException('You are not the organizer of this event');
    }

    if (dto.title) {
      event.title = dto.title;
      event.slug = slugify(dto.title);
    }
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.categoryId) {
      this.categoriesService.findById(dto.categoryId);
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

    return event;
  }

  delete(id: string, userId: string): void {
    const event = this.findById(id);
    if (event.organizerId !== userId) {
      throw new ForbiddenException('You are not the organizer of this event');
    }
    const index = this.events.findIndex((e) => e.id === id);
    this.events.splice(index, 1);
  }

  publish(id: string, userId: string): Event {
    const event = this.findById(id);
    if (event.organizerId !== userId) {
      throw new ForbiddenException('You are not the organizer of this event');
    }
    if (event.status === 'published') {
      throw new BadRequestException('Event is already published');
    }
    event.status = 'published';
    return event;
  }

  getEventWithDetails(
    id: string,
    registrationsCount: number,
  ) {
    const event = this.findById(id);
    let category: { id: string; name: string } | undefined;
    try {
      const cat = this.categoriesService.findById(event.categoryId);
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
