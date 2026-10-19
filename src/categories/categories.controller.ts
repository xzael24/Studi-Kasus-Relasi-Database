import {
    Controller,
    Get,
    Param,
    Post,
    Body,
    Put,
    Delete,
} from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { category } from './entities/categories.entity.js';
import { CreateCategoryDto } from './dto/create-category-dto.js';
import { UpdateCategoryDto } from './dto/update-category-dto.js';

@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) {}

    // 1. READ ALL CATEGORIES
    @Get()
    findAll(): category[] {
        return this.categoriesService.findAll();
    }

    // 2. READ ONE CATEGORY (dengan parameter id)
    // Contoh akses: GET /categories/1
    @Get(':id')
    findOne(@Param('id') id: string): category {
        return this.categoriesService.findOne(+id);
    }

    // 3. CREATE A CATEGORY
    @Post()
    create(@Body() categoryData: CreateCategoryDto): category {
        return this.categoriesService.create(categoryData);
    }

    // 4. UPDATE A CATEGORY
    // Contoh akses: PUT /categories/1
    @Put(':id')
    update(@Param('id') id: string, @Body() updateData: UpdateCategoryDto): category {
        return this.categoriesService.update(+id, updateData);
    }

    // 5. DELETE A CATEGORY
    // Contoh akses: DELETE /categories/1
    @Delete(':id')
    remove(@Param('id') id: string): { message: string } {
        return this.categoriesService.remove(+id);
    }
}
