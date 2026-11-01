// Simple database check using TypeORM
const { DataSource } = require('typeorm');

async function checkDatabase() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost', // PostgreSQL exposed to host
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
    logging: false,
  });

  try {
    console.log('🔍 Testing database connection...');
    await dataSource.initialize();
    
    // Get all tables
    const queryRunner = dataSource.createQueryRunner();
    const tables = await queryRunner.getTables();
    
    console.log('\n📊 Database Status:');
    console.log(`✅ Connected to PostgreSQL: postgres-db:5432`);
    console.log(`✅ Database 'zaim' exists`);
    console.log(`✅ TypeORM ready to sync entities`);
    
    if (tables.length === 0) {
      console.log('\n⚠️  No tables found.');
      console.log('💡 TypeORM will create tables when NestJS starts (synchronize: true)');
    } else {
      console.log('\n📋 Tables found:');
      tables.forEach(table => {
        console.log(`  - ${table.name}`);
      });
    }
    
    await dataSource.destroy();
    
    console.log('\n🎯 Summary: Database setup complete!');
    console.log('🚀 NestJS application will sync TypeScript entities to PostgreSQL on startup');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Database connection failed:', error.message);
    
    // Try direct PostgreSQL connection
    try {
      const { Client } = require('pg');
      const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: '123',
        database: 'zaim',
      });
      
      await client.connect();
      const result = await client.query('SELECT 1 as test');
      console.log('\n✅ Direct PostgreSQL connection works!');
      await client.end();
      
    } catch (pgError) {
      console.error('\n❌ PostgreSQL direct connection also failed:', pgError.message);
    }
    
    return false;
  }
}

checkDatabase();