import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { EventCategory } from './entities/event-category.entity.js';
import { CreateEventCategoryDto } from './dto/create-event-category.dto.js';
import { UpdateEventCategoryDto } from './dto/update-event-category.dto.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class EventCategoriesService {
  private categories: EventCategory[] = [
    { id: 'cat_001', name: 'Technology', slug: 'technology', createdAt: new Date() },
    { id: 'cat_002', name: 'Business', slug: 'business', createdAt: new Date() },
    { id: 'cat_003', name: 'Education', slug: 'education', createdAt: new Date() },
    { id: 'cat_004', name: 'Workshop', slug: 'workshop', createdAt: new Date() },
    { id: 'cat_005', name: 'Conference', slug: 'conference', createdAt: new Date() },
    { id: 'cat_006', name: 'Entertainment', slug: 'entertainment', createdAt: new Date() },
  ];

  findAll(): EventCategory[] {
    return this.categories;
  }

  findById(id: string): EventCategory {
    const cat = this.categories.find((c) => c.id === id);
    if (!cat) throw new NotFoundException(`Category with id "${id}" not found`);
    return cat;
  }

  create(dto: CreateEventCategoryDto): EventCategory {
    const existing = this.categories.find(
      (c) => c.name.toLowerCase() === dto.name.toLowerCase(),
    );
    if (existing) throw new ConflictException(`Category "${dto.name}" already exists`);

    const category: EventCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: dto.name,
      slug: slugify(dto.name),
      createdAt: new Date(),
    };
    this.categories.push(category);
    return category;
  }

  update(id: string, dto: UpdateEventCategoryDto): EventCategory {
    const category = this.findById(id);

    if (dto.name) {
      const existing = this.categories.find(
        (c) => c.name.toLowerCase() === dto.name!.toLowerCase() && c.id !== id,
      );
      if (existing) throw new ConflictException(`Category "${dto.name}" already exists`);
      category.name = dto.name;
      category.slug = slugify(dto.name);
    }

    return category;
  }

  delete(id: string): void {
    const index = this.categories.findIndex((c) => c.id === id);
    if (index === -1) throw new NotFoundException(`Category with id "${id}" not found`);
    this.categories.splice(index, 1);
  }
}
