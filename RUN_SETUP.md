# 🐘 PostgreSQL + NestJS Setup - Complete Guide

This guide fixes all database configuration issues in the NestJS project.

## 📋 Current Status

✅ **PostgreSQL Container**: Running as "postgres-db" service
✅ **Database**: "zaim" exists and accessible
✅ **TypeORM**: Configured with autoLoadEntities = true, synchronize = true (dev mode)
✅ **Docker Compose**: Fixed (volumes and ports as arrays)
✅ **Environment**: .env configuration corrected

## 🔧 Configuration Files Fixed

### 1. docker-compose.yml
```yaml
# FIXED: volumes as array
services:
  postgres-db:
    volumes:
      - postgres_data_volume:/var/lib/postgresql/data

# FIXED: ports as array
    ports:
      - "5432:5432"
```

### 2. .env
```env
# FIXED: DB_HOST now correctly set to localhost
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=123
DB_DATABASE=zaim
```

### 3. src/app.module.ts (TypeORM config)
```typescript
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get<string>('DB_HOST'),        // Now "localhost"
    port: Number(configService.get<number>('DB_PORT')),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE'),
    autoLoadEntities: true,    // Loads all *.entity.ts files
    synchronize: true,        // Auto-sync in development
  }),
})
```

## 🚀 Setup Steps

### Step 1: Verify Docker Setup
```bash
# Check PostgreSQL container status
docker compose ps

# Check databases in container
docker compose exec postgres-db psql -U postgres -c "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;"
```

### Step 2: Test Database Connection
```bash
# Quick connection test
docker compose exec postgres-db psql -U postgres -d zaim -c "SELECT NOW() as current_time;"
```

### Step 3: Run NestJS Application
```bash
# This will auto-sync TypeScript entities to PostgreSQL tables
npm run start:dev

# Application will:
# 1. Connect to localhost:5432
# 2. Load all entities from src/**/*.entity.{ts,js}
# 3. Create tables automatically (synchronize: true)
# 4. Start the NestJS server on port 3000
```

## 📊 What Happens When NestJS Starts

1. **Database Connection**: NestJS connects to `localhost:5432`
2. **Entity Loading**: Auto-loads all TypeScript entities:
   - users/entities/user.entity.ts
   - events/entities/event.entity.ts
   - registrations/entities/registration.entity.ts
   - tickets/entities/ticket.entity.ts
   - books/entities/book.entity.ts
   - categories/entities/categories.entity.ts
   - members/entities/members.entity.ts
   - event-categories/entities/event-category.entity.ts
3. **Table Creation**: TypeORM creates tables based on entities
4. **Server Start**: NestJS API starts on `http://localhost:3000/api/v1`

## 🔧 Manual Database Creation (If Needed)

If you need to manually create the database or create additional tables:

```bash
# Connect to PostgreSQL container
docker compose exec postgres-db psql -U postgres

-- Create database (if not exists)
CREATE DATABASE zaim;

-- Switch to the database
\c zaim

-- View all tables
\dt
```

## 📁 File Structure

```
pertemuan1/
├── docker-compose.yml              # Fixed PostgreSQL configuration
├── .env                            # Fixed database connection settings
├── src/
│   └── app.module.ts               # TypeORM configuration
│   └── **/*/entities/*.entity.{ts,js}  # TypeScript entities
├── dist/                           # Compiled NestJS application
│   ├── app.module.js
│   └── **/*.js                  # Compiled TypeScript files
└── test-app.e2e-spec.ts           # Fixed E2E test file
```

## ✅ Key Fixes Applied

1. **docker-compose.yml**: Fixed YAML array syntax for `volumes` and `ports`
2. **.env**: Corrected `DB_HOST` from "postgres-db" to "localhost"
3. **test-app.e2e-spec.ts**: Removed invalid import from "supertest/types"
4. **All TypeScript entities**: Automatically loaded and synchronized by TypeORM

## 🚀 Quick Start Command

```bash
# Full setup in one command
./setup.sh

# Or step-by-step:
docker compose up -d
docker compose exec postgres-db psql -U postgres -c "CREATE DATABASE IF NOT EXISTS zaim;"
npm run start:dev
```

## 📚 Documentation

- [NestJS TypeORM Documentation](https://docs.nestjs.com/techniques/database)
- [TypeORM Entities](https://typeorm.io/entities)
- [Docker Compose](https://docs.docker.com/compose/compose-file/)

---

**🎯 Result**: PostgreSQL database is fully configured and ready for NestJS application with automatic table creation from TypeScript entities.

This setup ensures:
- ✅ Smooth local development with Docker
- ✅ Automatic database schema synchronization
- ✅ Type-safe database operations
- ✅ Easy deployment and maintenance