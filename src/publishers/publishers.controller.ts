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
import { PublishersService } from './publishers.service.js';
import { Publisher } from './entities/publisher.entity.js';
import { CreatePublisherDto } from './dto/create-publisher.dto.js';
import { UpdatePublisherDto } from './dto/update-publisher.dto.js';

@ApiTags('Publishers')
@Controller('publishers')
export class PublishersController {
  constructor(private readonly publishersService: PublishersService) {}

  @Get()
  findAll(): Promise<Publisher[]> {
    return this.publishersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Publisher> {
    return this.publishersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePublisherDto): Promise<Publisher> {
    return this.publishersService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePublisherDto,
  ): Promise<Publisher> {
    return this.publishersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.publishersService.remove(id);
  }
}
