// Script to create database and tables using TypeORM
import { DataSource } from 'typeorm';
import { join } from 'path';

const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '123',
  database: 'zaim',
  entities: [
    join(__dirname, 'src', 'users', 'entities', '*.entity.{js,ts}'),
    join(__dirname, 'src', 'events', 'entities', '*.entity.{js,ts}'),
    join(__dirname, 'src', 'event-categories', 'entities', '*.entity.{js,ts}'),
    join(__dirname, 'src', 'registrations', 'entities', '*.entity.{js,ts}'),
    join(__dirname, 'src', 'tickets', 'entities', '*.entity.{js,ts}'),
    join(__dirname, 'src', 'books', 'entities', '*.entity.{js,ts}'),
    join(__dirname, 'src', 'categories', 'entities', '*.entity.{js,ts}'),
    join(__dirname, 'src', 'members', 'entities', '*.entity.{js,ts}'),
  ],
  synchronize: true,
  logging: true,
});

async function main() {
  try {
    await dataSource.initialize();
    console.log('Database connected successfully!');
    
    // Get all tables from database
    const queryRunner = dataSource.createQueryRunner();
    const tables = await queryRunner.getTables();
    
    console.log('Tables in database:', tables.map(t => t.name));
    
    await dataSource.destroy();
  } catch (error) {
    console.error('Error during database initialization:', error);
  }
}

main();