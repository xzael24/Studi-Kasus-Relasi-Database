import { Module } from '@nestjs/common';
import { EventAuthController } from './event-auth.controller.js';
import { EventAuthService } from './event-auth.service.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [UsersModule],
  controllers: [EventAuthController],
  providers: [EventAuthService],
})
export class EventAuthModule {}
