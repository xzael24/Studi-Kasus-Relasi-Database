import { Module, forwardRef } from '@nestjs/common';
import { RegistrationsController } from './registrations.controller.js';
import { RegistrationsService } from './registrations.service.js';
import { TicketsModule } from '../tickets/tickets.module.js';
import { UsersModule } from '../users/users.module.js';
import { EventsModule } from '../events/events.module.js';

@Module({
  imports: [
    TicketsModule,
    UsersModule,
    forwardRef(() => EventsModule),
  ],
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
