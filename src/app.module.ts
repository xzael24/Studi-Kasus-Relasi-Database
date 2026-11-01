import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventAuthModule } from './event-auth/event-auth.module.js';
import { UsersModule } from './users/users.module.js';
import { EventCategoriesModule } from './event-categories/event-categories.module.js';
import { EventsModule } from './events/events.module.js';
import { RegistrationsModule } from './registrations/registrations.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { BooksModule } from './books/books.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { PublishersModule } from './publishers/publishers.module.js';
import { AuthorsModule } from './authors/authors.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { ShipmentsModule } from './shipments/shipments.module.js';
import Joi from 'joi';

@Module({
  imports: [
    UsersModule,
    EventAuthModule,
    EventCategoriesModule,
    EventsModule,
    RegistrationsModule,
    TicketsModule,
    DashboardModule,
    BooksModule,
    CategoriesModule,
    CustomersModule,
    PublishersModule,
    AuthorsModule,
    OrdersModule,
    PaymentsModule,
    ShipmentsModule,
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string().default('development').valid('development', 'production', 'staging'),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<number>('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),
  ],
})
export class AppModule {}
