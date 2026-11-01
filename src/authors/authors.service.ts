import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Author } from './entities/author.entity.js';
import { CreateAuthorDto } from './dto/create-author.dto.js';
import { UpdateAuthorDto } from './dto/update-author.dto.js';

@Injectable()
export class AuthorsService {
  constructor(
    @InjectRepository(Author)
    private readonly authorRepository: Repository<Author>,
  ) {}

  findAll(): Promise<Author[]> {
    return this.authorRepository.find();
  }

  async findOne(id: string): Promise<Author> {
    const author = await this.authorRepository.findOneBy({ id });
    if (!author) {
      throw new NotFoundException(`Author dengan ID ${id} tidak ditemukan`);
    }
    return author;
  }

  create(dto: CreateAuthorDto): Promise<Author> {
    return this.authorRepository.save(this.authorRepository.create(dto));
  }

  async update(id: string, dto: UpdateAuthorDto): Promise<Author> {
    const author = await this.findOne(id);
    Object.assign(author, dto, { id });
    return this.authorRepository.save(author);
  }

  async remove(id: string): Promise<{ message: string }> {
    const author = await this.findOne(id);
    await this.authorRepository.remove(author);
    return { message: `Author dengan ID ${id} berhasil dihapus` };
  }
}
