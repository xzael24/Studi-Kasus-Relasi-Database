import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BooksService } from './books.service.js';
import { Book } from './entities/book.entity.js';
import { BookAuthor } from './entities/book-author.entity.js';
import { CreateBookDto } from './dto/create-book-dto.js';
import { UpdateBookDto } from './dto/update-book-dto.js';

@ApiTags('Books')
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  findAll(): Promise<Book[]> {
    return this.booksService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Book> {
    return this.booksService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBookDto): Promise<Book> {
    return this.booksService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBookDto): Promise<Book> {
    return this.booksService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.booksService.remove(id);
  }

  @Get(':id/authors')
  findAuthors(@Param('id') id: string): Promise<BookAuthor[]> {
    return this.booksService.findAuthors(id);
  }

  @Post(':id/authors/:authorId')
  addAuthor(
    @Param('id') id: string,
    @Param('authorId') authorId: string,
  ): Promise<BookAuthor> {
    return this.booksService.addAuthor(id, authorId);
  }

  @Delete(':id/authors/:authorId')
  removeAuthor(
    @Param('id') id: string,
    @Param('authorId') authorId: string,
  ): Promise<{ message: string }> {
    return this.booksService.removeAuthor(id, authorId);
  }
}
