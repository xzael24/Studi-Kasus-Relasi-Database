import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import {
  tokenStore,
  AuthenticatedUser,
} from '../common/guards/jwt-auth.guard.js';

function generateToken(): string {
  return (
    Math.random().toString(36).substring(2) +
    Math.random().toString(36).substring(2) +
    Date.now().toString(36)
  );
}

@Injectable()
export class EventAuthService {
  constructor(private readonly usersService: UsersService) {}

  async register(dto: RegisterDto) {
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException('Password and password confirmation do not match');
    }

    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      password: dto.password, // In production: hash with bcrypt
    });

    const token = generateToken();
    const authUser: AuthenticatedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
    };
    tokenStore.set(token, authUser);

    return {
      user: authUser,
      accessToken: token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.password !== dto.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = generateToken();
    const authUser: AuthenticatedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
    };
    tokenStore.set(token, authUser);

    return {
      user: authUser,
      accessToken: token,
    };
  }

  logout(token: string): void {
    tokenStore.delete(token);
  }
}
