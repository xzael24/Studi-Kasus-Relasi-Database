import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';
import { EventCategoriesModule } from '../event-categories/event-categories.module.js';
import { TicketsModule } from '../tickets/tickets.module.js';
import { RegistrationsModule } from '../registrations/registrations.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event]),
    EventCategoriesModule,
    TicketsModule,
    forwardRef(() => RegistrationsModule),
    UsersModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
