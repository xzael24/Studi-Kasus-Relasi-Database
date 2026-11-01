import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EventAuthService } from './event-auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { successResponse } from '../common/helpers/response.helper.js';

@ApiTags('Authentication')
@Controller('auth')
export class EventAuthController {
  constructor(private readonly eventAuthService: EventAuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  async register(@Body() dto: RegisterDto) {
    const data = await this.eventAuthService.register(dto);
    return successResponse('Registration successful', data);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    const data = await this.eventAuthService.login(dto);
    return successResponse('Login successful', data);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  logout(@Headers('authorization') authHeader: string) {
    const token = authHeader?.substring(7);
    this.eventAuthService.logout(token);
    return successResponse('Logout successful');
  }
}
