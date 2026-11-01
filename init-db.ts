// Simple database initialization script
import { DataSource } from 'typeorm';

// Get entities from the modules
async function initDatabase() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost', // PostgreSQL exposed to host from Docker
    port: 5432,
    username: 'postgres',
    password: '123',
    database: 'zaim',
    entities: [
      'src/users/entities/user.entity.ts',
      'src/events/entities/event.entity.ts',
      'src/event-categories/entities/event-category.entity.ts',
      'src/registrations/entities/registration.entity.ts',
      'src/tickets/entities/ticket.entity.ts',
      'src/books/entities/book.entity.ts',
      'src/categories/entities/categories.entity.ts',
      'src/members/entities/members.entity.ts',
    ],
    synchronize: true,
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected and tables created successfully!');
    
    // Get all tables from database
    const queryRunner = dataSource.createQueryRunner();
    const tables = await queryRunner.getTables();
    
    console.log('\n📊 Tables in database:');
    tables.forEach(table => {
      console.log(`  - ${table.name} (columns: ${table.columns?.length || 0})`);
    });
    
    if (tables.length === 0) {
      console.log('\n⚠️  No tables found. Database is empty.');
      console.log('💡 You may need to configure TypeORM or check your entity paths');
    }
    
    await dataSource.destroy();
    return true;
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return false;
  }
}

initDatabase();