import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
  forwardRef,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EventsService } from './events.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { EventFilterDto } from './dto/event-filter.dto.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { CreateTicketDto } from '../tickets/dto/create-ticket.dto.js';
import { RegistrationsService } from '../registrations/registrations.service.js';
import { CreateRegistrationDto } from '../registrations/dto/create-registration.dto.js';
import { CheckInDto } from '../registrations/dto/check-in.dto.js';
import { UsersService } from '../users/users.service.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import {
  successResponse,
  paginatedResponse,
} from '../common/helpers/response.helper.js';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly ticketsService: TicketsService,
    @Inject(forwardRef(() => RegistrationsService))
    private readonly registrationsService: RegistrationsService,
    private readonly usersService: UsersService,
  ) {}

  // ─── Events CRUD ─────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get all events with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  async findAll(@Query() filter: EventFilterDto) {
    const { data, total, page, limit } = await this.eventsService.findAll(filter);
    return paginatedResponse('Events retrieved successfully', data, page, limit, total);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event detail by id' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string) {
    const registeredCount = await this.registrationsService.countByEventId(id);
    const data = await this.eventsService.getEventWithDetails(id, registeredCount);
    return successResponse('Event retrieved successfully', data);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const event = await this.eventsService.create(dto, user.id);
    return successResponse('Event created successfully', {
      id: event.id,
      title: event.title,
      slug: event.slug,
      status: event.status,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const event = await this.eventsService.update(id, dto, user.id);
    return successResponse('Event updated successfully', {
      id: event.id,
      title: event.title,
      capacity: event.capacity,
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete event' })
  @ApiResponse({ status: 200, description: 'Event deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.eventsService.delete(id, user.id);
    return successResponse('Event deleted successfully');
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a draft event' })
  @ApiResponse({ status: 200, description: 'Event published successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const event = await this.eventsService.publish(id, user.id);
    return successResponse('Event published successfully', {
      id: event.id,
      status: event.status,
    });
  }

  // ─── Tickets ────────────────────────────────────────────────────────────────

  @Get(':eventId/tickets')
  @ApiOperation({ summary: 'Get tickets for an event' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  async getTickets(@Param('eventId') eventId: string) {
    // Ensure event exists
    await this.eventsService.findById(eventId);
    const tickets = await this.ticketsService.findByEventId(eventId);
    const data = tickets.map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      quota: t.quota,
      sold: t.sold,
      available: t.quota - t.sold,
    }));
    return successResponse('Tickets retrieved successfully', data);
  }

  @Post(':eventId/tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a ticket for an event' })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  async createTicket(
    @Param('eventId') eventId: string,
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Only organizer can add tickets
    const event = await this.eventsService.findById(eventId);
    if (event.organizerId !== user.id) {
      throw new ForbiddenException('You are not the organizer of this event');
    }
    const ticket = await this.ticketsService.create(eventId, dto);
    return successResponse('Ticket created successfully', {
      id: ticket.id,
      name: ticket.name,
      price: ticket.price,
      quota: ticket.quota,
    });
  }

  // ─── Registrations ──────────────────────────────────────────────────────────

  @Post(':eventId/register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register to an event' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  async registerToEvent(
    @Param('eventId') eventId: string,
    @Body() dto: CreateRegistrationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const reg = await this.registrationsService.register(eventId, dto, user.id);
    const event = await this.eventsService.findById(eventId);
    const ticket = await this.ticketsService.findById(reg.ticketId);
    return successResponse('Registration successful', {
      registrationId: reg.id,
      event: { id: event.id, title: event.title },
      ticket: { id: ticket.id, name: ticket.name, price: ticket.price },
      status: reg.status,
      registeredAt: reg.registeredAt,
    });
  }

  // ─── Attendees ──────────────────────────────────────────────────────────────

  @Get(':eventId/attendees')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get attendees for an event' })
  @ApiResponse({ status: 200, description: 'Attendees retrieved successfully' })
  async getAttendees(
    @Param('eventId') eventId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
  ) {
    await this.eventsService.findById(eventId);
    const { registrations, total } = await this.registrationsService.getAttendeesForEvent(
      eventId,
      Number(page),
      Number(limit),
      search,
    );

    const data = await Promise.all(
      registrations.map(async (r) => {
        const user = await this.usersService.findById(r.userId);
        const ticket = await this.ticketsService.findById(r.ticketId);
        return {
          registrationId: r.id,
          user: {
            id: user?.id,
            name: user?.name,
            email: user?.email,
          },
          ticket: { name: ticket.name },
          status: r.status,
          registeredAt: r.registeredAt,
        };
      }),
    );

    return paginatedResponse(
      'Attendees retrieved successfully',
      data,
      Number(page),
      Number(limit),
      total,
    );
  }

  // ─── Check-in ───────────────────────────────────────────────────────────────

  @Post(':eventId/check-in')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check-in an attendee' })
  @ApiResponse({ status: 200, description: 'Check-in successful' })
  @ApiResponse({ status: 400, description: 'Already checked in or invalid registration' })
  async checkIn(
    @Param('eventId') eventId: string,
    @Body() dto: CheckInDto,
  ) {
    const reg = await this.registrationsService.checkIn(eventId, dto.registrationId);
    const user = await this.usersService.findById(reg.userId);
    return successResponse('Check-in successful', {
      registrationId: reg.id,
      attendee: {
        name: user?.name,
        email: user?.email,
      },
      checkedInAt: reg.checkedInAt,
    });
  }
}
