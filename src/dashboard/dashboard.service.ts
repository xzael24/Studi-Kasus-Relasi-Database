import { Injectable } from '@nestjs/common';
import { EventsService } from '../events/events.service.js';
import { RegistrationsService } from '../registrations/registrations.service.js';
import { TicketsService } from '../tickets/tickets.service.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly eventsService: EventsService,
    private readonly registrationsService: RegistrationsService,
    private readonly ticketsService: TicketsService,
  ) {}

  async getOverview() {
    const allEventsData = await this.eventsService.findAll({ page: 1, limit: 1000 });
    const allEvents = allEventsData.data as { id: string; status: string }[];

    const totalEvents = allEvents.length;
    const publishedEvents = allEvents.filter((e) => e.status === 'published').length;
    const draftEvents = allEvents.filter((e) => e.status === 'draft').length;

    // Count all registrations
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalRegistrations = 0;
    let thisMonthRegistrations = 0;
    let totalTicketsSold = 0;
    let totalTicketsAvailable = 0;
    let totalRevenue = 0;
    let thisMonthRevenue = 0;

    for (const event of allEvents) {
      const regs = await this.registrationsService.findByEventId(event.id);
      const activeRegs = regs.filter((r) => r.status !== 'cancelled');
      totalRegistrations += activeRegs.length;

      const monthRegs = activeRegs.filter(
        (r) => new Date(r.registeredAt) >= firstDayOfMonth,
      );
      thisMonthRegistrations += monthRegs.length;

      // Tickets for this event
      const tickets = await this.ticketsService.findByEventId(event.id);
      for (const ticket of tickets) {
        totalTicketsSold += ticket.sold;
        totalTicketsAvailable += ticket.quota - ticket.sold;
        totalRevenue += ticket.sold * ticket.price;

        // Revenue this month
        const monthTicketRegs = regs.filter(
          (r) =>
            r.ticketId === ticket.id &&
            r.status !== 'cancelled' &&
            new Date(r.registeredAt) >= firstDayOfMonth,
        );
        thisMonthRevenue += monthTicketRegs.length * ticket.price;
      }
    }

    return {
      events: {
        total: totalEvents,
        published: publishedEvents,
        draft: draftEvents,
      },
      registrations: {
        total: totalRegistrations,
        thisMonth: thisMonthRegistrations,
      },
      tickets: {
        sold: totalTicketsSold,
        available: totalTicketsAvailable,
      },
      revenue: {
        total: totalRevenue,
        thisMonth: thisMonthRevenue,
      },
    };
  }
}
