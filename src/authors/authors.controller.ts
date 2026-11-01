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
import { AuthorsService } from './authors.service.js';
import { Author } from './entities/author.entity.js';
import { CreateAuthorDto } from './dto/create-author.dto.js';
import { UpdateAuthorDto } from './dto/update-author.dto.js';

@ApiTags('Authors')
@Controller('authors')
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Get()
  findAll(): Promise<Author[]> {
    return this.authorsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Author> {
    return this.authorsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAuthorDto): Promise<Author> {
    return this.authorsService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAuthorDto,
  ): Promise<Author> {
    return this.authorsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.authorsService.remove(id);
  }
}
