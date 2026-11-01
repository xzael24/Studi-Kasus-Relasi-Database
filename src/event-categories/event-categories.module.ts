import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventCategory } from './entities/event-category.entity.js';
import { EventCategoriesController } from './event-categories.controller.js';
import { EventCategoriesService } from './event-categories.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([EventCategory])],
  controllers: [EventCategoriesController],
  providers: [EventCategoriesService],
  exports: [EventCategoriesService],
})
export class EventCategoriesModule {}
