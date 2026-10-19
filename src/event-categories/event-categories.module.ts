import { Module } from '@nestjs/common';
import { EventCategoriesController } from './event-categories.controller.js';
import { EventCategoriesService } from './event-categories.service.js';

@Module({
  controllers: [EventCategoriesController],
  providers: [EventCategoriesService],
  exports: [EventCategoriesService],
})
export class EventCategoriesModule {}
