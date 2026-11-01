import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Author } from './entities/author.entity.js';
import { AuthorsController } from './authors.controller.js';
import { AuthorsService } from './authors.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Author])],
  controllers: [AuthorsController],
  providers: [AuthorsService],
  exports: [AuthorsService],
})
export class AuthorsModule {}
