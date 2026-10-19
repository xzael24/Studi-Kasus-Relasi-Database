import { Injectable, NotFoundException } from '@nestjs/common';
import { category } from './entities/categories.entity.js';
import { CreateCategoryDto } from './dto/create-category-dto.js';
import { UpdateCategoryDto } from './dto/update-category-dto.js';

@Injectable()
export class CategoriesService {
    private categories: category[] = [
        {
            id: 1,
            categoryName: 'Novel',
        },
        {
            id: 2,
            categoryName: 'Teknologi',
        },
        {
            id: 3,
            categoryName: 'Sains',
        },
    ];

    // Auto-increment id helper
    private nextId(): number {
        return this.categories.length > 0
            ? Math.max(...this.categories.map((c) => c.id)) + 1
            : 1;
    }

    // 1. GET ALL CATEGORIES
    findAll(): category[] {
        return this.categories;
    }

    // 2. GET ONE CATEGORY BY ID
    findOne(id: number): category {
        const cat = this.categories.find((c) => c.id === id);
        if (!cat) {
            throw new NotFoundException(`Category dengan ID ${id} tidak ditemukan`);
        }
        return cat;
    }

    // 3. CREATE A CATEGORY
    create(categoryData: CreateCategoryDto): category {
        const newCategory: category = {
            id: this.nextId(),
            categoryName: categoryData.categoryName ?? '',
        };
        this.categories.push(newCategory);
        return newCategory;
    }

    // 4. UPDATE A CATEGORY
    update(id: number, updateData: UpdateCategoryDto): category {
        const index = this.categories.findIndex((c) => c.id === id);
        if (index === -1) {
            throw new NotFoundException(`Category dengan ID ${id} tidak ditemukan`);
        }
        this.categories[index] = { ...this.categories[index], ...updateData, id };
        return this.categories[index];
    }

    // 5. DELETE A CATEGORY
    remove(id: number): { message: string } {
        const index = this.categories.findIndex((c) => c.id === id);
        if (index === -1) {
            throw new NotFoundException(`Category dengan ID ${id} tidak ditemukan`);
        }
        this.categories.splice(index, 1);
        return { message: `Category dengan ID ${id} berhasil dihapus` };
    }
}
