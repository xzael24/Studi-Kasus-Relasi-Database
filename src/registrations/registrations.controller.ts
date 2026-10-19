import {
  Controller,
  Get,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service.js';
import { EventsService } from '../events/events.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { successResponse } from '../common/helpers/response.helper.js';

@ApiTags('Registrations')
@Controller()
export class RegistrationsController {
  constructor(
    private readonly registrationsService: RegistrationsService,
    @Inject(forwardRef(() => EventsService))
    private readonly eventsService: EventsService,
    private readonly ticketsService: TicketsService,
  ) {}

  // GET /me/registrations
  @Get('me/registrations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my registrations' })
  @ApiResponse({ status: 200, description: 'Registrations retrieved successfully' })
  getMyRegistrations(@CurrentUser() user: AuthenticatedUser) {
    const regs = this.registrationsService.findByUserId(user.id);
    const data = regs.map((r) => {
      const event = this.eventsService.findById(r.eventId);
      const ticket = this.ticketsService.findById(r.ticketId);
      return {
        id: r.id,
        event: {
          id: event.id,
          title: event.title,
          startDate: event.startDate,
        },
        ticket: {
          name: ticket.name,
          price: ticket.price,
        },
        status: r.status,
      };
    });
    return successResponse('Registrations retrieved successfully', data);
  }

  // GET /registrations/:id
  @Get('registrations/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get registration detail' })
  @ApiResponse({ status: 200, description: 'Registration retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  findOne(@Param('id') id: string) {
    const reg = this.registrationsService.findById(id);
    const event = this.eventsService.findById(reg.eventId);
    const ticket = this.ticketsService.findById(reg.ticketId);
    return successResponse('Registration retrieved successfully', {
      id: reg.id,
      status: reg.status,
      event: { id: event.id, title: event.title },
      ticket: { id: ticket.id, name: ticket.name, price: ticket.price },
      registeredAt: reg.registeredAt,
    });
  }

  // DELETE /registrations/:id
  @Delete('registrations/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel registration' })
  @ApiResponse({ status: 200, description: 'Registration cancelled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    this.registrationsService.cancel(id, user.id);
    return successResponse('Registration cancelled successfully');
  }
}
