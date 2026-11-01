import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './entities/book.entity.js';
import { BookAuthor } from './entities/book-author.entity.js';
import { CreateBookDto } from './dto/create-book-dto.js';
import { UpdateBookDto } from './dto/update-book-dto.js';

const BOOK_RELATIONS = {
  category: true,
  publisher: true,
  bookAuthors: { author: true },
};

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
    @InjectRepository(BookAuthor)
    private readonly bookAuthorRepository: Repository<BookAuthor>,
  ) {}

  findAll(): Promise<Book[]> {
    return this.bookRepository.find({ relations: BOOK_RELATIONS });
  }

  async findOne(id: string): Promise<Book> {
    const book = await this.bookRepository.findOne({
      where: { id },
      relations: BOOK_RELATIONS,
    });
    if (!book) {
      throw new NotFoundException(`Buku dengan ID ${id} tidak ditemukan`);
    }
    return book;
  }

  create(dto: CreateBookDto): Promise<Book> {
    return this.bookRepository.save(this.bookRepository.create(dto));
  }

  async update(id: string, dto: UpdateBookDto): Promise<Book> {
    await this.findOne(id);
    await this.bookRepository.update(id, dto);
    return this.findOne(id);
  }

  // soft delete: baris tetap ada, deleted_at diisi
  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id);
    await this.bookRepository.softDelete(id);
    return { message: `Buku dengan ID ${id} berhasil dihapus` };
  }

  async findAuthors(bookId: string): Promise<BookAuthor[]> {
    await this.findOne(bookId);
    return this.bookAuthorRepository.find({
      where: { bookId },
      relations: { author: true },
    });
  }

  async addAuthor(bookId: string, authorId: string): Promise<BookAuthor> {
    await this.findOne(bookId);
    const existing = await this.bookAuthorRepository.findOneBy({
      bookId,
      authorId,
    });
    if (existing) return existing;
    return this.bookAuthorRepository.save(
      this.bookAuthorRepository.create({ bookId, authorId }),
    );
  }

  async removeAuthor(
    bookId: string,
    authorId: string,
  ): Promise<{ message: string }> {
    const result = await this.bookAuthorRepository.delete({ bookId, authorId });
    if (!result.affected) {
      throw new NotFoundException(
        `Relasi buku ${bookId} dengan author ${authorId} tidak ditemukan`,
      );
    }
    return { message: `Author ${authorId} dihapus dari buku ${bookId}` };
  }
}
