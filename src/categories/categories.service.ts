import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/categories.entity.js';
import { CreateCategoryDto } from './dto/create-category-dto.js';
import { UpdateCategoryDto } from './dto/update-category-dto.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  findAll(): Promise<Category[]> {
    return this.categoryRepository.find();
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOneBy({ id });
    if (!category) {
      throw new NotFoundException(`Category dengan ID ${id} tidak ditemukan`);
    }
    return category;
  }

  create(dto: CreateCategoryDto): Promise<Category> {
    return this.categoryRepository.save(this.categoryRepository.create(dto));
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    Object.assign(category, dto, { id });
    return this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<{ message: string }> {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
    return { message: `Category dengan ID ${id} berhasil dihapus` };
  }
}
