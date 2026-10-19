# Event Management API Specification

Dokumen ini merupakan spesifikasi API untuk project **Event Management System** yang dibangun menggunakan **NestJS**.

Dokumen ini dapat digunakan sebagai acuan antara backend, frontend, mobile application, maupun sebagai materi pembelajaran.

---

## 1. Gambaran Project

### Nama Project

**Event Management API**

### Teknologi

- Node.js
- NestJS
- REST API
- JSON
- JWT Authentication
- Swagger / OpenAPI
- Class Validator

### Base URL

```text
/api/v1
```

Contoh:

```text
http://localhost:3000/api/v1
```

---

# 2. Konsep API

API menggunakan format JSON.

## Success Response

Contoh response ketika request berhasil:

```json
{
  "success": true,
  "message": "Event retrieved successfully",
  "data": {}
}
```

## Error Response

Contoh response ketika terjadi error:

```json
{
  "success": false,
  "message": "Event not found",
  "error": "Not Found",
  "statusCode": 404
}
```

---

# 3. HTTP Status Code

| Status Code | Keterangan                         |
| ----------- | ---------------------------------- |
| `200`     | Request berhasil                   |
| `201`     | Data berhasil dibuat               |
| `204`     | Berhasil tanpa response body       |
| `400`     | Request tidak valid                |
| `401`     | Belum login atau token tidak valid |
| `403`     | Tidak memiliki permission          |
| `404`     | Data tidak ditemukan               |
| `409`     | Terjadi conflict                   |
| `422`     | Validation error                   |
| `500`     | Internal server error              |

---

# 4. Authentication

Authentication menggunakan **Bearer Token**.

Setiap endpoint yang membutuhkan authentication harus mengirimkan header:

```http
Authorization: Bearer {accessToken}
```

Contoh:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

# 5. Authentication API

## 5.1 Register

Mendaftarkan user baru.

### Endpoint

```http
POST /api/v1/auth/register
```

### Request Body

```json
{
  "name": "Jamal Apriadi",
  "email": "jamal@example.com",
  "password": "password123",
  "passwordConfirmation": "password123"
}
```

### Response

**HTTP 201 Created**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "usr_01HXYZ123",
      "name": "Jamal Apriadi",
      "email": "jamal@example.com"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## 5.2 Login

Login user ke dalam aplikasi.

### Endpoint

```http
POST /api/v1/auth/login
```

### Request Body

```json
{
  "email": "jamal@example.com",
  "password": "password123"
}
```

### Response

**HTTP 200 OK**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "usr_01HXYZ123",
      "name": "Jamal Apriadi",
      "email": "jamal@example.com"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## 5.3 Logout

Logout user.

### Endpoint

```http
POST /api/v1/auth/logout
```

### Headers

```http
Authorization: Bearer {accessToken}
```

### Response

```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

# 6. Event API

Event merupakan data utama dalam Event Management System.

Sebuah event memiliki informasi seperti:

- Judul
- Deskripsi
- Kategori
- Lokasi
- Tanggal mulai
- Tanggal selesai
- Kapasitas
- Status
- Organizer

---

## 6.1 Get Events

Mengambil daftar event.

### Endpoint

```http
GET /api/v1/events
```

### Query Parameters

| Parameter     | Type    | Required | Keterangan      |
| ------------- | ------- | -------- | --------------- |
| `page`      | integer | No       | Nomor halaman   |
| `limit`     | integer | No       | Jumlah data     |
| `search`    | string  | No       | Pencarian event |
| `category`  | string  | No       | Filter kategori |
| `status`    | string  | No       | Filter status   |
| `startDate` | date    | No       | Tanggal mulai   |
| `endDate`   | date    | No       | Tanggal selesai |

### Contoh Request

```http
GET /api/v1/events?page=1&limit=10&search=nestjs
```

### Response

```json
{
  "success": true,
  "message": "Events retrieved successfully",
  "data": [
    {
      "id": "evt_001",
      "title": "NestJS Workshop",
      "slug": "nestjs-workshop",
      "description": "Learn NestJS from beginner to advanced",
      "location": "Jakarta",
      "startDate": "2026-11-10T09:00:00Z",
      "endDate": "2026-11-10T17:00:00Z",
      "status": "published",
      "category": {
        "id": "cat_001",
        "name": "Technology"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

---

# 7. Get Event Detail

Mengambil detail satu event.

### Endpoint

```http
GET /api/v1/events/:id
```

### Contoh Request

```http
GET /api/v1/events/evt_001
```

### Response

```json
{
  "success": true,
  "message": "Event retrieved successfully",
  "data": {
    "id": "evt_001",
    "title": "NestJS Workshop",
    "slug": "nestjs-workshop",
    "description": "Learn NestJS from beginner to advanced",
    "location": {
      "name": "Jakarta Convention Center",
      "address": "Jl. Gatot Subroto",
      "city": "Jakarta"
    },
    "startDate": "2026-11-10T09:00:00Z",
    "endDate": "2026-11-10T17:00:00Z",
    "capacity": 100,
    "registered": 65,
    "available": 35,
    "status": "published",
    "category": {
      "id": "cat_001",
      "name": "Technology"
    },
    "organizer": {
      "id": "usr_001",
      "name": "Jamal Apriadi"
    }
  }
}
```

---

# 8. Create Event

Membuat event baru.

### Endpoint

```http
POST /api/v1/events
```

### Authorization

```http
Authorization: Bearer {accessToken}
```

### Request Body

```json
{
  "title": "NestJS Workshop",
  "description": "Learn NestJS from beginner to advanced",
  "categoryId": "cat_001",
  "location": {
    "name": "Jakarta Convention Center",
    "address": "Jl. Gatot Subroto",
    "city": "Jakarta"
  },
  "startDate": "2026-11-10T09:00:00Z",
  "endDate": "2026-11-10T17:00:00Z",
  "capacity": 100
}
```

### Response

**HTTP 201 Created**

```json
{
  "success": true,
  "message": "Event created successfully",
  "data": {
    "id": "evt_001",
    "title": "NestJS Workshop",
    "slug": "nestjs-workshop",
    "status": "draft"
  }
}
```

---

# 9. Update Event

Mengubah data event.

### Endpoint

```http
PATCH /api/v1/events/:id
```

### Authorization

```http
Authorization: Bearer {accessToken}
```

### Request Body

```json
{
  "title": "NestJS Advanced Workshop",
  "capacity": 150
}
```

### Response

```json
{
  "success": true,
  "message": "Event updated successfully",
  "data": {
    "id": "evt_001",
    "title": "NestJS Advanced Workshop",
    "capacity": 150
  }
}
```

> `PATCH` digunakan karena hanya field yang ingin diubah yang perlu dikirimkan.

---

# 10. Delete Event

Menghapus event.

### Endpoint

```http
DELETE /api/v1/events/:id
```

### Authorization

```http
Authorization: Bearer {accessToken}
```

### Response

```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

---

# 11. Publish Event

Mempublikasikan event yang sebelumnya masih berstatus draft.

### Endpoint

```http
POST /api/v1/events/:id/publish
```

### Authorization

```http
Authorization: Bearer {accessToken}
```

### Response

```json
{
  "success": true,
  "message": "Event published successfully",
  "data": {
    "id": "evt_001",
    "status": "published"
  }
}
```

---

# 12. Event Category API

Kategori digunakan untuk mengelompokkan event.

Contoh:

- Technology
- Business
- Education
- Workshop
- Conference
- Entertainment

---

## 12.1 Get Categories

```http
GET /api/v1/event-categories
```

### Response

```json
{
  "success": true,
  "message": "Event categories retrieved successfully",
  "data": [
    {
      "id": "cat_001",
      "name": "Technology",
      "slug": "technology"
    },
    {
      "id": "cat_002",
      "name": "Business",
      "slug": "business"
    }
  ]
}
```

---

## 12.2 Create Category

```http
POST /api/v1/event-categories
```

### Request Body

```json
{
  "name": "Technology"
}
```

### Response

```json
{
  "success": true,
  "message": "Event category created successfully",
  "data": {
    "id": "cat_001",
    "name": "Technology",
    "slug": "technology"
  }
}
```

---

## 12.3 Update Category

```http
PATCH /api/v1/event-categories/:id
```

### Request Body

```json
{
  "name": "Technology & Programming"
}
```

---

## 12.4 Delete Category

```http
DELETE /api/v1/event-categories/:id
```

---

# 13. Ticket API

Satu event dapat memiliki beberapa jenis tiket.

Contoh:

```text
Early Bird
Regular
VIP
```

---

## 13.1 Get Event Tickets

### Endpoint

```http
GET /api/v1/events/:eventId/tickets
```

### Response

```json
{
  "success": true,
  "message": "Tickets retrieved successfully",
  "data": [
    {
      "id": "ticket_001",
      "name": "Early Bird",
      "price": 100000,
      "quota": 50,
      "sold": 35,
      "available": 15
    },
    {
      "id": "ticket_002",
      "name": "Regular",
      "price": 150000,
      "quota": 100,
      "sold": 20,
      "available": 80
    },
    {
      "id": "ticket_003",
      "name": "VIP",
      "price": 300000,
      "quota": 20,
      "sold": 5,
      "available": 15
    }
  ]
}
```

---

## 13.2 Create Ticket

### Endpoint

```http
POST /api/v1/events/:eventId/tickets
```

### Request Body

```json
{
  "name": "VIP",
  "description": "VIP access",
  "price": 300000,
  "quota": 20
}
```

### Response

```json
{
  "success": true,
  "message": "Ticket created successfully",
  "data": {
    "id": "ticket_003",
    "name": "VIP",
    "price": 300000,
    "quota": 20
  }
}
```

---

# 14. Event Registration

User dapat mendaftarkan dirinya ke event.

### Endpoint

```http
POST /api/v1/events/:eventId/register
```

### Authorization

```http
Authorization: Bearer {accessToken}
```

### Request Body

```json
{
  "ticketTypeId": "ticket_001"
}
```

### Response

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "registrationId": "reg_001",
    "event": {
      "id": "evt_001",
      "title": "NestJS Workshop"
    },
    "ticket": {
      "id": "ticket_001",
      "name": "Regular",
      "price": 150000
    },
    "status": "registered",
    "registeredAt": "2026-10-05T02:30:00Z"
  }
}
```

---

# 15. My Registrations

Mengambil daftar event yang diikuti oleh user yang sedang login.

### Endpoint

```http
GET /api/v1/me/registrations
```

### Authorization

```http
Authorization: Bearer {accessToken}
```

### Response

```json
{
  "success": true,
  "message": "Registrations retrieved successfully",
  "data": [
    {
      "id": "reg_001",
      "event": {
        "id": "evt_001",
        "title": "NestJS Workshop",
        "startDate": "2026-11-10T09:00:00Z"
      },
      "ticket": {
        "name": "Regular",
        "price": 150000
      },
      "status": "registered"
    }
  ]
}
```

---

# 16. Registration Detail

Mengambil detail pendaftaran.

### Endpoint

```http
GET /api/v1/registrations/:id
```

### Response

```json
{
  "success": true,
  "message": "Registration retrieved successfully",
  "data": {
    "id": "reg_001",
    "status": "registered",
    "event": {
      "id": "evt_001",
      "title": "NestJS Workshop"
    },
    "ticket": {
      "id": "ticket_001",
      "name": "Regular",
      "price": 150000
    },
    "registeredAt": "2026-10-05T02:30:00Z"
  }
}
```

---

# 17. Cancel Registration

Membatalkan pendaftaran event.

### Endpoint

```http
DELETE /api/v1/registrations/:id
```

### Authorization

```http
Authorization: Bearer {accessToken}
```

### Response

```json
{
  "success": true,
  "message": "Registration cancelled successfully"
}
```

---

# 18. Attendee API

Organizer dapat melihat peserta yang terdaftar pada event.

## Get Attendees

### Endpoint

```http
GET /api/v1/events/:eventId/attendees
```

### Query Parameters

```text
?page=1
&limit=20
&search=jamal
```

### Response

```json
{
  "success": true,
  "message": "Attendees retrieved successfully",
  "data": [
    {
      "registrationId": "reg_001",
      "user": {
        "id": "usr_001",
        "name": "Jamal Apriadi",
        "email": "jamal@example.com"
      },
      "ticket": {
        "name": "VIP"
      },
      "status": "registered",
      "registeredAt": "2026-10-05T02:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

# 19. Event Check-in

Ketika peserta datang ke event, organizer dapat melakukan check-in.

Check-in dapat dikembangkan menggunakan:

- Registration ID
- QR Code
- Ticket Code

## Check-in

### Endpoint

```http
POST /api/v1/events/:eventId/check-in
```

### Authorization

```http
Authorization: Bearer {accessToken}
```

### Request Body

```json
{
  "registrationId": "reg_001"
}
```

### Response

```json
{
  "success": true,
  "message": "Check-in successful",
  "data": {
    "registrationId": "reg_001",
    "attendee": {
      "name": "Jamal Apriadi",
      "email": "jamal@example.com"
    },
    "checkedInAt": "2026-11-10T08:45:00Z"
  }
}
```

---

## Jika Peserta Sudah Check-in

```json
{
  "success": false,
  "message": "Attendee has already checked in",
  "error": "BAD_REQUEST",
  "statusCode": 400
}
```

---

# 20. Dashboard API

Dashboard digunakan oleh organizer untuk melihat ringkasan event.

## Dashboard Overview

### Endpoint

```http
GET /api/v1/dashboard/overview
```

### Authorization

```http
Authorization: Bearer {accessToken}
```

### Response

```json
{
  "success": true,
  "message": "Dashboard overview retrieved successfully",
  "data": {
    "events": {
      "total": 12,
      "published": 8,
      "draft": 4
    },
    "registrations": {
      "total": 1250,
      "thisMonth": 245
    },
    "tickets": {
      "sold": 1100,
      "available": 350
    },
    "revenue": {
      "total": 125000000,
      "thisMonth": 25000000
    }
  }
}
```

---

# 21. Validation Error

Project NestJS dapat menggunakan `ValidationPipe` untuk melakukan validasi request.

Contoh ketika user membuat event tanpa `title`:

```json
{
  "success": false,
  "message": [
    "title should not be empty",
    "title must be a string"
  ],
  "error": "Unprocessable Entity",
  "statusCode": 422
}
```

Contoh konfigurasi:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
  }),
);
```

---

# 22. DTO Example

Contoh DTO untuk membuat event:

```typescript
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsUUID()
  categoryId: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
```

---

# 23. API Endpoint Summary

Berikut seluruh endpoint utama yang terdapat pada project.

## Authentication

| Method   | Endpoint           | Authentication |
| -------- | ------------------ | -------------- |
| `POST` | `/auth/register` | No             |
| `POST` | `/auth/login`    | No             |
| `POST` | `/auth/logout`   | Yes            |

## Events

| Method     | Endpoint                       | Authentication |
| ---------- | ------------------------------ | -------------- |
| `GET`    | `/events`                    | No             |
| `POST`   | `/events`                    | Yes            |
| `GET`    | `/events/:id`                | No             |
| `PATCH`  | `/events/:id`                | Yes            |
| `DELETE` | `/events/:id`                | Yes            |
| `POST`   | `/events/:id/publish`        | Yes            |
| `GET`    | `/events/:eventId/tickets`   | No             |
| `POST`   | `/events/:eventId/tickets`   | Yes            |
| `GET`    | `/events/:eventId/attendees` | Yes            |
| `POST`   | `/events/:eventId/register`  | Yes            |
| `POST`   | `/events/:eventId/check-in`  | Yes            |

## Event Categories

| Method     | Endpoint                  | Authentication |
| ---------- | ------------------------- | -------------- |
| `GET`    | `/event-categories`     | No             |
| `POST`   | `/event-categories`     | Yes            |
| `GET`    | `/event-categories/:id` | No             |
| `PATCH`  | `/event-categories/:id` | Yes            |
| `DELETE` | `/event-categories/:id` | Yes            |

## Registrations

| Method     | Endpoint               | Authentication |
| ---------- | ---------------------- | -------------- |
| `GET`    | `/me/registrations`  | Yes            |
| `GET`    | `/registrations/:id` | Yes            |
| `DELETE` | `/registrations/:id` | Yes            |

## Dashboard

| Method  | Endpoint                | Authentication |
| ------- | ----------------------- | -------------- |
| `GET` | `/dashboard/overview` | Yes            |

---

# 24. Struktur Module NestJS

API di atas dapat diimplementasikan dengan struktur module seperti berikut:

```text
src/
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   ├── dto/
│   └── guards/
│
├── users/
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.module.ts
│   └── entities/
│
├── events/
│   ├── events.controller.ts
│   ├── events.service.ts
│   ├── events.module.ts
│   ├── dto/
│   └── entities/
│
├── event-categories/
│   ├── event-categories.controller.ts
│   ├── event-categories.service.ts
│   ├── event-categories.module.ts
│   └── dto/
│
├── tickets/
│   ├── tickets.controller.ts
│   ├── tickets.service.ts
│   ├── tickets.module.ts
│   └── entities/
│
├── registrations/
│   ├── registrations.controller.ts
│   ├── registrations.service.ts
│   ├── registrations.module.ts
│   └── entities/
│
├── dashboard/
│   ├── dashboard.controller.ts
│   ├── dashboard.service.ts
│   └── dashboard.module.ts
│
├── common/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   ├── decorators/
│   └── pipes/
│
├── app.module.ts
└── main.ts
```

---

# 25. Swagger / OpenAPI

Karena project menggunakan NestJS, dokumentasi API sebaiknya diintegrasikan dengan Swagger.

Install:

```bash
npm install @nestjs/swagger
```

Kemudian konfigurasi di `main.ts`:

```typescript
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Event Management API')
  .setDescription('REST API for Event Management System')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);

SwaggerModule.setup('docs', app, document);
```

Swagger dapat diakses melalui:

```text
http://localhost:3000/docs
```

---

# 26. Swagger pada Controller

Contoh controller:

```typescript
import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  @Get()
  @ApiOperation({
    summary: 'Get all events',
  })
  @ApiResponse({
    status: 200,
    description: 'Events retrieved successfully',
  })
  findAll() {
    return {};
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new event',
  })
  @ApiResponse({
    status: 201,
    description: 'Event created successfully',
  })
  create(@Body() dto: CreateEventDto) {
    return {};
  }
}
```

---

# 27. Rekomendasi Tahapan Pengerjaan

Project Event Management dapat dikerjakan secara bertahap.

## Phase 1 — Basic CRUD

Pelajari:

- Module
- Controller
- Service
- DTO
- CRUD
- Database
- Entity

Fitur:

```text
User
Event
Event Category
```

---

## Phase 2 — Authentication

Pelajari:

- JWT
- Authentication
- Guards
- Password hashing
- Authorization header

Fitur:

```text
Register
Login
Logout
Protected Route
```

---

## Phase 3 — Event Registration

Pelajari:

- Relationship
- Database transaction
- Validation

Fitur:

```text
Ticket
Registration
My Registration
Cancel Registration
```

---

## Phase 4 — Role & Permission

Pelajari:

- Roles Guard
- Custom Decorator
- Authorization

Contoh role:

```text
admin
organizer
attendee
```

Contoh permission:

```text
admin
    └── mengelola semua event

organizer
    └── mengelola event miliknya

attendee
    └── melihat dan mendaftar event
```

---

## Phase 5 — Check-in

Pelajari:

- QR Code
- Registration validation
- Check-in flow

Fitur:

```text
Generate Ticket
Generate QR Code
Scan QR Code
Check-in
Prevent Double Check-in
```

---

## Phase 6 — Dashboard

Pelajari:

- Aggregation query
- Reporting
- Pagination
- Filtering

Dashboard menampilkan:

```text
Total Event
Published Event
Draft Event
Total Registration
Ticket Sold
Ticket Available
Revenue
```

---

## Phase 7 — Production Ready

Pelajari:

- Exception Filter
- Interceptor
- Logging
- Swagger
- Rate Limiting
- Caching
- Unit Testing
- E2E Testing
- Environment Configuration

---

# 28. Final API Architecture

Secara keseluruhan, API memiliki struktur:

```text
/api/v1
│
├── auth
│   ├── POST   /register
│   ├── POST   /login
│   └── POST   /logout
│
├── users
│   ├── GET    /me
│   └── PATCH  /me
│
├── events
│   ├── GET    /
│   ├── POST   /
│   ├── GET    /:id
│   ├── PATCH  /:id
│   ├── DELETE /:id
│   ├── POST   /:id/publish
│   ├── GET    /:eventId/tickets
│   ├── POST   /:eventId/tickets
│   ├── GET    /:eventId/attendees
│   ├── POST   /:eventId/register
│   └── POST   /:eventId/check-in
│
├── event-categories
│   ├── GET    /
│   ├── POST   /
│   ├── GET    /:id
│   ├── PATCH  /:id
│   └── DELETE /:id
│
├── registrations
│   ├── GET    /:id
│   └── DELETE /:id
│
├── me
│   └── GET    /registrations
│
└── dashboard
    └── GET    /overview
```

---

---

# 30. Validation Schema

Bagian ini mendefinisikan aturan validasi input untuk setiap endpoint yang menerima request body atau query parameter.

Tujuan validation schema adalah memastikan:

1. Data yang dikirim client memiliki format yang benar.
2. Field wajib tidak boleh kosong.
3. Tipe data sesuai dengan API contract.
4. Nilai berada dalam batas yang diperbolehkan.
5. Data yang tidak valid ditolak sebelum diproses oleh business logic.

Pada NestJS, validation dapat diimplementasikan menggunakan:

```bash
npm install class-validator class-transformer
```

Kemudian aktifkan `ValidationPipe` secara global:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
  }),
);
```

`whitelist: true` digunakan untuk menghapus property yang tidak didefinisikan pada DTO.

`transform: true` digunakan agar data request dapat ditransformasikan sesuai kebutuhan DTO.

---

# 31. Authentication Validation

## 31.1 Register

### Endpoint

```http
POST /api/v1/auth/register
```

### Validation Schema

| Field                    | Type   | Required | Validation                    |
| ------------------------ | ------ | -------: | ----------------------------- |
| `name`                 | string |      Yes | 2–100 karakter               |
| `email`                | string |      Yes | Format email valid            |
| `password`             | string |      Yes | Minimal 8 karakter            |
| `passwordConfirmation` | string |      Yes | Harus sama dengan`password` |

### Example Valid Request

```json
{
  "name": "Jamal Apriadi",
  "email": "jamal@example.com",
  "password": "password123",
  "passwordConfirmation": "password123"
}
```

### DTO

```typescript
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  passwordConfirmation: string;
}
```

> Pengecekan bahwa `passwordConfirmation` sama dengan `password` merupakan business validation tambahan dan dapat dilakukan di service atau menggunakan custom validator.

---

## 31.2 Login

### Endpoint

```http
POST /api/v1/auth/login
```

### Validation Schema

| Field        | Type   | Required | Validation         |
| ------------ | ------ | -------: | ------------------ |
| `email`    | string |      Yes | Format email valid |
| `password` | string |      Yes | Minimal 8 karakter |

### DTO

```typescript
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;
}
```

---

# 32. Event Validation

## 32.1 Create Event

### Endpoint

```http
POST /api/v1/events
```

### Validation Schema

| Field                | Type     | Required | Validation          |
| -------------------- | -------- | -------: | ------------------- |
| `title`            | string   |      Yes | 3–150 karakter     |
| `description`      | string   |      Yes | Minimal 10 karakter |
| `categoryId`       | UUID     |      Yes | UUID valid          |
| `location.name`    | string   |      Yes | 2–150 karakter     |
| `location.address` | string   |      Yes | 5–255 karakter     |
| `location.city`    | string   |      Yes | 2–100 karakter     |
| `startDate`        | datetime |      Yes | ISO 8601            |
| `endDate`          | datetime |      Yes | ISO 8601            |
| `capacity`         | integer  |      Yes | Minimal 1           |

### Example Request

```json
{
  "title": "NestJS Workshop",
  "description": "Learn NestJS from beginner to advanced",
  "categoryId": "550e8400-e29b-41d4-a716-446655440000",
  "location": {
    "name": "Jakarta Convention Center",
    "address": "Jl. Gatot Subroto",
    "city": "Jakarta"
  },
  "startDate": "2026-11-10T09:00:00Z",
  "endDate": "2026-11-10T17:00:00Z",
  "capacity": 100
}
```

### Location DTO

```typescript
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class EventLocationDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  address: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;
}
```

### Create Event DTO

```typescript
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  description: string;

  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => EventLocationDto)
  location: EventLocationDto;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  capacity: number;
}
```

### Business Validation

Selain validation format, terdapat aturan bisnis:

```text
endDate harus lebih besar dari startDate
capacity harus lebih besar dari 0
categoryId harus mengacu pada category yang tersedia
```

Contoh:

```text
startDate = 2026-11-10 09:00
endDate   = 2026-11-10 17:00

VALID
```

Sedangkan:

```text
startDate = 2026-11-10 17:00
endDate   = 2026-11-10 09:00

INVALID
```

Pengecekan `endDate > startDate` sebaiknya dilakukan pada business/service layer atau menggunakan custom class-validator.

---

# 33. Update Event Validation

## Endpoint

```http
PATCH /api/v1/events/:id
```

Pada update event, seluruh field bersifat optional.

Contoh:

```json
{
  "title": "NestJS Advanced Workshop",
  "capacity": 150
}
```

### DTO

Gunakan `PartialType` dari `@nestjs/swagger` atau `@nestjs/mapped-types`.

```typescript
import { PartialType } from '@nestjs/swagger';

export class UpdateEventDto extends PartialType(CreateEventDto) {}
```

Dengan demikian:

```text
title       optional
description optional
categoryId  optional
location    optional
startDate   optional
endDate     optional
capacity    optional
```

Tetapi jika field dikirim, validation tetap harus diterapkan.

---

# 34. Event Category Validation

## 34.1 Create Category

### Endpoint

```http
POST /api/v1/event-categories
```

### Validation Schema

| Field    | Type   | Required | Validation      |
| -------- | ------ | -------: | --------------- |
| `name` | string |      Yes | 2–100 karakter |

### DTO

```typescript
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEventCategoryDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}
```

### Business Validation

Nama category tidak boleh duplicate.

Contoh:

```text
Technology
Technology
```

Data kedua harus ditolak apabila category `Technology` sudah tersedia.

---

## 34.2 Update Category

```typescript
import { PartialType } from '@nestjs/swagger';

export class UpdateEventCategoryDto extends PartialType(
  CreateEventCategoryDto,
) {}
```

---

# 35. Ticket Validation

## 35.1 Create Ticket

### Endpoint

```http
POST /api/v1/events/:eventId/tickets
```

### Validation Schema

| Field           | Type    | Required | Validation            |
| --------------- | ------- | -------: | --------------------- |
| `name`        | string  |      Yes | 2–100 karakter       |
| `description` | string  |       No | Maksimal 500 karakter |
| `price`       | number  |      Yes | Minimal 0             |
| `quota`       | integer |      Yes | Minimal 1             |

### Example Request

```json
{
  "name": "VIP",
  "description": "VIP access",
  "price": 300000,
  "quota": 20
}
```

### DTO

```typescript
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTicketDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quota: number;
}
```

### Business Validation

```text
price >= 0
quota >= 1
event harus tersedia
event belum selesai
```

Jika ticket sudah memiliki transaksi, perubahan quota harus mempertimbangkan jumlah ticket yang sudah terjual.

Contoh:

```text
Quota       = 100
Sold        = 80
New Quota   = 50

INVALID
```

Karena quota baru lebih kecil dari jumlah ticket yang sudah terjual.

---

# 36. Registration Validation

## Endpoint

```http
POST /api/v1/events/:eventId/register
```

### Validation Schema

| Field            | Type | Required | Validation |
| ---------------- | ---- | -------: | ---------- |
| `ticketTypeId` | UUID |      Yes | UUID valid |

### DTO

```typescript
import {
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class CreateRegistrationDto {
  @IsNotEmpty()
  @IsUUID()
  ticketTypeId: string;
}
```

### Business Validation

Selain format input, registration harus memenuhi aturan:

```text
1. User harus login.
2. Event harus tersedia.
3. Event harus berstatus published.
4. Event belum dimulai.
5. Ticket harus tersedia.
6. Quota ticket belum habis.
7. User belum terdaftar pada event yang sama.
```

Contoh:

```text
Ticket quota = 100
Ticket sold  = 100

Registration = INVALID
```

---

# 37. Check-in Validation

## Endpoint

```http
POST /api/v1/events/:eventId/check-in
```

### Validation Schema

| Field              | Type | Required | Validation |
| ------------------ | ---- | -------: | ---------- |
| `registrationId` | UUID |      Yes | UUID valid |

### DTO

```typescript
import {
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class CheckInDto {
  @IsNotEmpty()
  @IsUUID()
  registrationId: string;
}
```

### Business Validation

Check-in hanya boleh dilakukan apabila:

```text
1. Registration tersedia.
2. Registration milik event tersebut.
3. Registration berstatus registered/paid.
4. Peserta belum melakukan check-in.
5. Event sedang berlangsung atau berada pada waktu check-in.
```

---

# 38. Pagination Validation

Endpoint yang memiliki pagination menggunakan:

```text
?page=1&limit=10
```

### Validation Schema

| Field      | Type    | Required | Validation            |
| ---------- | ------- | -------: | --------------------- |
| `page`   | integer |       No | Minimal 1             |
| `limit`  | integer |       No | 1–100                |
| `search` | string  |       No | Maksimal 100 karakter |

### DTO

```typescript
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
```

Contoh:

```http
GET /api/v1/events?page=1&limit=20&search=nestjs
```

---

# 39. Event Filter Validation

Untuk filter event:

```http
GET /api/v1/events?category=technology&status=published
```

### Validation Schema

| Field         | Type   | Required | Validation                              |
| ------------- | ------ | -------: | --------------------------------------- |
| `category`  | string |       No | Maksimal 100 karakter                   |
| `status`    | enum   |       No | `draft`, `published`, `cancelled` |
| `startDate` | date   |       No | ISO 8601                                |
| `endDate`   | date   |       No | ISO 8601                                |

### DTO

```typescript
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
}

export class EventFilterDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
```

Business rule:

```text
endDate >= startDate
```

---

# 40. Validation Error Response

Apabila request tidak memenuhi validation schema, API mengembalikan error.

Contoh request:

```json
{
  "title": "",
  "description": "test",
  "capacity": 0
}
```

Response:

```json
{
  "success": false,
  "message": [
    "title should not be empty",
    "title must be longer than or equal to 3 characters",
    "categoryId must be a UUID",
    "capacity must not be less than 1",
    "startDate must be a valid ISO 8601 date string",
    "endDate must be a valid ISO 8601 date string"
  ],
  "error": "Unprocessable Entity",
  "statusCode": 422
}
```

> Format error response dapat berbeda tergantung konfigurasi `ValidationPipe` dan custom exception filter yang digunakan.

---

# 41. Recommended Global Validation Configuration

Konfigurasi yang direkomendasikan:

```typescript
import { ValidationPipe } from '@nestjs/common';

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
);
```

### Penjelasan

#### `whitelist`

```typescript
whitelist: true
```

Property yang tidak terdapat pada DTO akan dihapus.

Contoh:

```json
{
  "title": "NestJS Workshop",
  "capacity": 100,
  "unknownField": "hello"
}
```

`unknownField` tidak didefinisikan dalam DTO.

---

#### `forbidNonWhitelisted`

```typescript
forbidNonWhitelisted: true
```

Daripada menghapus property yang tidak dikenal, API dapat menolak request.

Contoh:

```json
{
  "title": "NestJS Workshop",
  "unknownField": "hello"
}
```

Request akan ditolak karena `unknownField` tidak diperbolehkan.

---

#### `transform`

```typescript
transform: true
```

Membantu melakukan transformasi tipe data.

Contoh query:

```text
?page=1&limit=10
```

Nilai query secara default dapat diterima sebagai string.

Dengan:

```typescript
@Type(() => Number)
```

nilai tersebut dapat ditransformasikan menjadi number.

---

# 42. Validation vs Business Validation

Mahasiswa perlu memahami bahwa validation terdiri dari dua jenis.

## Input Validation

Memastikan bentuk data benar.

Contoh:

```text
email harus berupa email
capacity harus integer
title tidak boleh kosong
categoryId harus UUID
```

Biasanya dilakukan menggunakan:

```text
class-validator
DTO
ValidationPipe
```

## Business Validation

Memastikan data memenuhi aturan bisnis.

Contoh:

```text
endDate harus setelah startDate
ticket tidak boleh dibeli jika quota habis
user tidak boleh register event dua kali
event harus published sebelum dapat didaftarkan
ticket quota tidak boleh lebih kecil dari ticket yang sudah terjual
```

Business validation biasanya dilakukan pada:

```text
Service
Use Case
Domain Layer
Database Transaction
```

---

# 43. Validation Flow pada NestJS

Alur request yang direkomendasikan:

```text
Client
  │
  ▼
HTTP Request
  │
  ▼
Controller
  │
  ▼
ValidationPipe
  │
  ├── Invalid
  │      │
  │      ▼
  │   422 Response
  │
  ▼
DTO
  │
  ▼
Service
  │
  ▼
Business Validation
  │
  ├── Invalid
  │      │
  │      ▼
  │   Business Error
  │
  ▼
Database
  │
  ▼
Response
```

---

# 44. Complete Validation Checklist

Sebelum endpoint dianggap selesai, mahasiswa dapat menggunakan checklist berikut:

### Request Validation

- [ ] Required field sudah divalidasi.
- [ ] String sudah menggunakan `@IsString()`.
- [ ] Email menggunakan `@IsEmail()`.
- [ ] UUID menggunakan `@IsUUID()`.
- [ ] Number menggunakan `@IsNumber()`.
- [ ] Integer menggunakan `@IsInt()`.
- [ ] Date menggunakan `@IsDateString()`.
- [ ] Enum menggunakan `@IsEnum()`.
- [ ] Minimum value menggunakan `@Min()`.
- [ ] Maximum value menggunakan `@Max()`.
- [ ] Minimum length menggunakan `@MinLength()`.
- [ ] Maximum length menggunakan `@MaxLength()`.
- [ ] Optional field menggunakan `@IsOptional()`.
- [ ] Nested object menggunakan `@ValidateNested()`.
- [ ] Nested object menggunakan `@Type()`.

### Business Validation

- [ ] Resource yang direferensikan tersedia.
- [ ] User memiliki permission.
- [ ] Event memiliki status yang sesuai.
- [ ] Ticket masih tersedia.
- [ ] User belum melakukan duplicate registration.
- [ ] Tanggal event valid.
- [ ] Quota tidak melebihi batas business rule.
- [ ] Data tidak menyebabkan conflict.

---

# 45. Validation Learning Exercise

Sebagai latihan, mahasiswa dapat diminta membuat DTO berikut:

```text
CreateEventDto
UpdateEventDto
CreateEventCategoryDto
UpdateEventCategoryDto
CreateTicketDto
UpdateTicketDto
RegisterDto
LoginDto
CreateRegistrationDto
CheckInDto
PaginationDto
EventFilterDto
```

Kemudian implementasikan:

```text
ValidationPipe
class-validator
class-transformer
DTO
Exception Handling
Business Validation
```

### Challenge

Buat endpoint:

```http
POST /api/v1/events
```

dengan requirement:

```text
title:
- required
- string
- min 3
- max 150

description:
- required
- string
- min 10

categoryId:
- required
- UUID

capacity:
- required
- integer
- min 1

startDate:
- required
- ISO 8601

endDate:
- required
- ISO 8601
- harus lebih besar dari startDate
```

Kemudian uji minimal:

```text
1. Request valid
2. title kosong
3. title terlalu pendek
4. title terlalu panjang
5. categoryId bukan UUID
6. capacity = 0
7. capacity berupa string
8. startDate invalid
9. endDate invalid
10. endDate sebelum startDate
11. Unknown property
```

Dengan latihan ini mahasiswa tidak hanya memahami cara membuat DTO, tetapi juga memahami bagaimana **API contract, validation, business rule, dan error handling** bekerja bersama dalam aplikasi NestJS.

# 29. Learning Objective

Setelah menyelesaikan project ini, mahasiswa diharapkan memahami bagaimana membangun REST API menggunakan NestJS dengan konsep:

- Module
- Controller
- Provider / Service
- DTO
- Entity
- Database
- CRUD
- Validation
- Pipes
- Authentication
- JWT
- Guards
- Authorization
- Role & Permission
- Exception Filter
- Interceptor
- Pagination
- Filtering
- Relationship
- Transaction
- Swagger / OpenAPI
- Unit Testing
- End-to-End Testing

Project **Event Management** dapat dikembangkan lebih lanjut dengan menambahkan:

- Payment Gateway
- Email Notification
- WhatsApp Notification
- QR Code Ticket
- Certificate
- Event Reminder
- Discount / Promo
- Refund
- Multi Organizer
- Event Analytics
- Attendance Report
