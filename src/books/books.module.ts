import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from './entities/book.entity.js';
import { BookAuthor } from './entities/book-author.entity.js';
import { BooksController } from './books.controller.js';
import { BooksService } from './books.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Book, BookAuthor])],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
