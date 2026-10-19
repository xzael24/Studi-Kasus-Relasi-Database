import { Module, forwardRef } from '@nestjs/common';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';
import { EventCategoriesModule } from '../event-categories/event-categories.module.js';
import { TicketsModule } from '../tickets/tickets.module.js';
import { RegistrationsModule } from '../registrations/registrations.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
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
