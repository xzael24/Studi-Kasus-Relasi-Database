import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Book } from './book.entity.js';
import { Author } from '../../authors/entities/author.entity.js';

@Entity({ name: 'book_authors' })
export class BookAuthor {
  @PrimaryColumn({ name: 'book_id', type: 'uuid' })
  bookId: string;

  @PrimaryColumn({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => Book, (book) => book.bookAuthors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book: Relation<Book>;

  @ManyToOne(() => Author, (author) => author.bookAuthors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'author_id' })
  author: Relation<Author>;
}
