import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity.js';
import { TicketsService } from './tickets.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket])],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
