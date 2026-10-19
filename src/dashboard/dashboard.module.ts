import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { EventsModule } from '../events/events.module.js';
import { RegistrationsModule } from '../registrations/registrations.module.js';
import { TicketsModule } from '../tickets/tickets.module.js';

@Module({
  imports: [EventsModule, RegistrationsModule, TicketsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
