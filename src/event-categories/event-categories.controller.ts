import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EventCategoriesService } from './event-categories.service.js';
import { CreateEventCategoryDto } from './dto/create-event-category.dto.js';
import { UpdateEventCategoryDto } from './dto/update-event-category.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { successResponse } from '../common/helpers/response.helper.js';

@ApiTags('Event Categories')
@Controller('event-categories')
export class EventCategoriesController {
  constructor(private readonly service: EventCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all event categories' })
  @ApiResponse({ status: 200, description: 'Event categories retrieved successfully' })
  findAll() {
    const data = this.service.findAll();
    return successResponse('Event categories retrieved successfully', data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event category by id' })
  @ApiResponse({ status: 200, description: 'Event category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findOne(@Param('id') id: string) {
    const data = this.service.findById(id);
    return successResponse('Event category retrieved successfully', data);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new event category' })
  @ApiResponse({ status: 201, description: 'Event category created successfully' })
  @ApiResponse({ status: 409, description: 'Category name already exists' })
  create(@Body() dto: CreateEventCategoryDto) {
    const data = this.service.create(dto);
    return successResponse('Event category created successfully', data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event category' })
  @ApiResponse({ status: 200, description: 'Event category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  update(@Param('id') id: string, @Body() dto: UpdateEventCategoryDto) {
    const data = this.service.update(id, dto);
    return successResponse('Event category updated successfully', data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete event category' })
  @ApiResponse({ status: 200, description: 'Event category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  delete(@Param('id') id: string) {
    this.service.delete(id);
    return successResponse('Event category deleted successfully');
  }
}
