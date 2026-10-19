import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
} from '@nestjs/common';
import { BooksService } from './books.service.js';
import { Book } from './entities/book.entity.js';
import { CreateBookDto } from './dto/create-book-dto.js';
import { UpdateBookDto } from './dto/update-book-dto.js';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  // 1. READ ALL BOOKS
  @Get()
  findAll(): Book[] {
    return this.booksService.findAll();
  }

  // 2. READ ONE BOOK (dengan parameter id)
  // Contoh akses: GET /books/1
  @Get(':id')
  findOne(@Param('id') id: string): Book {
    return this.booksService.findOne(+id);
  }

  // 3. CREATE A BOOK
  @Post()
  create(@Body() bookData: CreateBookDto): Book {
    return this.booksService.create(bookData);
  }

  // 4. UPDATE A BOOK
  // Contoh akses: PUT /books/1
  @Put(':id')
  update(@Param('id') id: string, @Body() updateData: UpdateBookDto): Book {
    return this.booksService.update(+id, updateData);
  }

  // 5. DELETE A BOOK
  // Contoh akses: DELETE /books/1
  @Delete(':id')
  remove(@Param('id') id: string): { message: string } {
    return this.booksService.remove(+id);
  }
}