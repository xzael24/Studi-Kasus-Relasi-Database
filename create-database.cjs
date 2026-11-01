// Script to create database and tables using TypeORM
const { DataSource } = require('typeorm');
const path = require('path');

const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost', // Connect to exposed PostgreSQL port
  port: 5432,
  username: 'postgres',
  password: '123',
  database: 'zaim',
  entities: [
    path.join(__dirname, 'src', 'users', 'entities', '*.entity.{js,ts}'),
    path.join(__dirname, 'src', 'events', 'entities', '*.entity.{js,ts}'),
    path.join(__dirname, 'src', 'event-categories', 'entities', '*.entity.{js,ts}'),
    path.join(__dirname, 'src', 'registrations', 'entities', '*.entity.{js,ts}'),
    path.join(__dirname, 'src', 'tickets', 'entities', '*.entity.{js,ts}'),
    path.join(__dirname, 'src', 'books', 'entities', '*.entity.{js,ts}'),
    path.join(__dirname, 'src', 'categories', 'entities', '*.entity.{js,ts}'),
    path.join(__dirname, 'src', 'members', 'entities', '*.entity.{js,ts}'),
  ],
  synchronize: true,
  logging: true,
});

dataSource
  .initialize()
  .then(async () => {
    console.log('Database connected successfully!');
    
    // Get all tables from database
    const queryRunner = dataSource.createQueryRunner();
    const tables = await queryRunner.getTables();
    
    console.log('Tables in database:', tables.map(t => t.name));
    
    await dataSource.destroy();
  })
  .catch((error) => {
    console.error('Error during database initialization:', error);
  });