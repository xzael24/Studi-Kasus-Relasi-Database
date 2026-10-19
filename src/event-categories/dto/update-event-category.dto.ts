import { PartialType } from '@nestjs/swagger';
import { CreateEventCategoryDto } from './create-event-category.dto.js';

export class UpdateEventCategoryDto extends PartialType(CreateEventCategoryDto) {}
