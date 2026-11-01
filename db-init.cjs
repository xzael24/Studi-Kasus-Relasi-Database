// Simple database initialization using TypeORM
const { DataSource } = require('typeorm');
const path = require('path');

// Alternative approach: Use SQL directly to create tables based on TypeScript entities
const { Pool } = require('pg');

async function initDatabase() {
  const pool = new Pool({
    host: 'localhost', // PostgreSQL exposed to host
    port: 5432,
    user: 'postgres',
    password: '123',
    database: 'zaim',
  });

  try {
    // Test connection
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Check if database exists
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', ['zaim']);
    if (result.rows.length === 0) {
      console.log('Database "zaim" does not exist, creating...');
      await client.query('CREATE DATABASE zaim');
      console.log('Database "zaim" created successfully');
    } else {
      console.log('Database "zaim" already exists');
    }
    
    await client.release();
    
    // Now connect to the database
    const dataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
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
    
    await dataSource.initialize();
    console.log('Database tables created successfully');
    
    // Get all tables
    const queryRunner = dataSource.createQueryRunner();
    const tables = await queryRunner.getTables();
    console.log('Tables created:', tables.map(t => t.name));
    
    await dataSource.destroy();
    
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await pool.end();
  }
}

initDatabase();