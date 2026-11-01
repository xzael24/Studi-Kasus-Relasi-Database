import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
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
  constructor(
    @InjectRepository(EventCategory)
    private readonly categoryRepository: Repository<EventCategory>,
  ) {}

  async findAll(): Promise<EventCategory[]> {
    return this.categoryRepository.find();
  }

  async findById(id: string): Promise<EventCategory> {
    const category = await this.categoryRepository.findOneBy({ id });
    if (!category) throw new NotFoundException(`Category with id "${id}" not found`);
    return category;
  }

  async create(dto: CreateEventCategoryDto): Promise<EventCategory> {
    const existing = await this.categoryRepository.findOneBy({
      name: ILike(dto.name),
    });
    if (existing) throw new ConflictException(`Category "${dto.name}" already exists`);

    const category = this.categoryRepository.create({
      name: dto.name,
      slug: slugify(dto.name),
    });

    return this.categoryRepository.save(category);
  }

  async update(id: string, dto: UpdateEventCategoryDto): Promise<EventCategory> {
    const category = await this.findById(id);

    if (dto.name) {
      const existing = await this.categoryRepository
        .createQueryBuilder('category')
        .where('LOWER(category.name) = :name', {
          name: dto.name.toLowerCase(),
        })
        .andWhere('category.id != :id', { id })
        .getOne();
      if (existing) throw new ConflictException(`Category "${dto.name}" already exists`);
      category.name = dto.name;
      category.slug = slugify(dto.name);
    }

    return this.categoryRepository.save(category);
  }

  async delete(id: string): Promise<void> {
    const category = await this.findById(id);
    await this.categoryRepository.remove(category);
  }
}