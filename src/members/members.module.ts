import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from './entities/members.entity.js';
import { MembersController } from './members.controller.js';
import { MembersService } from './members.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Member])],
  controllers: [MembersController],
  providers: [MembersService]
})
export class MembersModule {}
