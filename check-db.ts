// Simple script to check database and create tables
import { DataSource } from 'typeorm';
import { join } from 'path';

async function checkAndCreateDatabase() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: '123',
    database: 'zaim',
    entities: [
      join(__dirname, 'src', 'users', 'entities', '*.entity.{ts}'),
      join(__dirname, 'src', 'events', 'entities', '*.entity.{ts}'),
      join(__dirname, 'src', 'event-categories', 'entities', '*.entity.{ts}'),
      join(__dirname, 'src', 'registrations', 'entities', '*.entity.{ts}'),
      join(__dirname, 'src', 'tickets', 'entities', '*.entity.{ts}'),
      join(__dirname, 'src', 'books', 'entities', '*.entity.{ts}'),
      join(__dirname, 'src', 'categories', 'entities', '*.entity.{ts}'),
      join(__dirname, 'src', 'members', 'entities', '*.entity.{ts}'),
    ],
    synchronize: true,
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected successfully!');
    
    // Get all tables from database
    const queryRunner = dataSource.createQueryRunner();
    const tables = await queryRunner.getTables();
    
    console.log('📊 Tables in database:');
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
      if (table.columns && table.columns.length > 0) {
        console.log(`    Columns: ${table.columns.map(col => col.name).join(', ')}`);
      }
    });
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found. Database is empty.');
    }
    
    await dataSource.destroy();
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

checkAndCreateDatabase();