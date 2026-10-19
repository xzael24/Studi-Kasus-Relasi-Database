import { Injectable, NotFoundException } from '@nestjs/common';
import { Book } from './entities/book.entity.js';
import { CreateBookDto } from './dto/create-book-dto.js';
import { UpdateBookDto } from './dto/update-book-dto.js';

@Injectable()
export class BooksService {
    private books: Book[] = [
        {
            id: 1,
            title: 'Clean Code',
            author: 'Robert C. Martin',
            isbn: '978-0132350884',
            publishedYear: 2008,
            isAvailable: true,
        },
        {
            id: 2,
            title: 'The Pragmatic Programmer',
            author: 'Andrew Hunt',
            isbn: '978-0135957059',
            publishedYear: 2019,
            isAvailable: true,
        },
    ];

    // Auto-increment id helper
    private nextId(): number {
        return this.books.length > 0
            ? Math.max(...this.books.map((b) => b.id)) + 1
            : 1;
    }

    // 1. GET ALL BOOKS
    findAll(): Book[] {
        return this.books;
    }

    // 2. GET ONE BOOK BY ID
    findOne(id: number): Book {
        const book = this.books.find((b) => b.id === id);
        if (!book) {
            throw new NotFoundException(`Buku dengan ID ${id} tidak ditemukan`);
        }
        return book;
    }

    // 3. CREATE A BOOK
    create(bookData: CreateBookDto): Book {
        const newBook: Book = {
            id: this.nextId(),
            title: bookData.title ?? '',
            author: bookData.author ?? '',
            isbn: bookData.isbn ?? '',
            publishedYear: bookData.publishedYear ?? new Date().getFullYear(),
            isAvailable: bookData.isAvailable ?? true,
        };
        this.books.push(newBook);
        return newBook;
    }

    // 4. UPDATE A BOOK
    update(id: number, updateData: UpdateBookDto): Book {
        const index = this.books.findIndex((b) => b.id === id);
        if (index === -1) {
            throw new NotFoundException(`Buku dengan ID ${id} tidak ditemukan`);
        }
        this.books[index] = { ...this.books[index], ...updateData, id };
        return this.books[index];
    }

    // 5. DELETE A BOOK
    remove(id: number): { message: string } {
        const index = this.books.findIndex((b) => b.id === id);
        if (index === -1) {
            throw new NotFoundException(`Buku dengan ID ${id} tidak ditemukan`);
        }
        this.books.splice(index, 1);
        return { message: `Buku dengan ID ${id} berhasil dihapus` };
    }
}
