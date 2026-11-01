import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Publisher } from './entities/publisher.entity.js';
import { CreatePublisherDto } from './dto/create-publisher.dto.js';
import { UpdatePublisherDto } from './dto/update-publisher.dto.js';

@Injectable()
export class PublishersService {
  constructor(
    @InjectRepository(Publisher)
    private readonly publisherRepository: Repository<Publisher>,
  ) {}

  findAll(): Promise<Publisher[]> {
    return this.publisherRepository.find();
  }

  async findOne(id: string): Promise<Publisher> {
    const publisher = await this.publisherRepository.findOneBy({ id });
    if (!publisher) {
      throw new NotFoundException(`Publisher dengan ID ${id} tidak ditemukan`);
    }
    return publisher;
  }

  create(dto: CreatePublisherDto): Promise<Publisher> {
    return this.publisherRepository.save(this.publisherRepository.create(dto));
  }

  async update(id: string, dto: UpdatePublisherDto): Promise<Publisher> {
    const publisher = await this.findOne(id);
    Object.assign(publisher, dto, { id });
    return this.publisherRepository.save(publisher);
  }

  async remove(id: string): Promise<{ message: string }> {
    const publisher = await this.findOne(id);
    await this.publisherRepository.remove(publisher);
    return { message: `Publisher dengan ID ${id} berhasil dihapus` };
  }
}
