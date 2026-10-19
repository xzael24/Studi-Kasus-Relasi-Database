import { Module } from '@nestjs/common';
import { EventAuthModule } from './event-auth/event-auth.module.js';
import { UsersModule } from './users/users.module.js';
import { EventCategoriesModule } from './event-categories/event-categories.module.js';
import { EventsModule } from './events/events.module.js';
import { RegistrationsModule } from './registrations/registrations.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';

@Module({
  imports: [
    UsersModule,
    EventAuthModule,
    EventCategoriesModule,
    EventsModule,
    RegistrationsModule,
    TicketsModule,
    DashboardModule,
  ],
})
export class AppModule {}
