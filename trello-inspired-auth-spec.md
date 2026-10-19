# Auth Specification — Trello-Inspired Authentication & Registration

**Project:** Event Management API (NestJS)
**Versi dokumen:** 2.0
**Tanggal:** 5 Oktober 2026
**Status:** Draft — siap diimplementasikan
**Supersedes:** Section 5 (Authentication API) dan Section 31 (Authentication Validation) pada `event-management-api-spec.md`

---

## 0. Dokumen Ini Berasal dari Mana

Spec ini **bukan** spec Trello. Trello adalah **sumber inspiration**, ditelusuri lewat riset primary-source:

- Analisis konsolidasi: `docs/research/trello-auth-analysis.md`
- Rincian alur UI & validasi: `docs/research/trello-auth-login-register.md`
- Rincian sesi, token, OAuth: `docs/research/trello-auth-sessions-tokens.md`

Aturan di bawah yang bertanda **[T]** = diambil dari perilaku Trello yang terverifikasi.
Aturan bertanda **[R]** = keputusan kita sendiri, tidak ada di Trello.
Aturan bertanda **[B]** = best practice umum yang konsisten dengan temuan riset.

Setiap keputusan dan alasannya ada di [Section 15](#15-catatan-keputusan--rationale).

---

## 1. Prinsip Desain

### 1.1 Prinsip yang Diambil dari Trello

| Prinsip | Implementasi | Sumber |
|---|---|---|
| **Satu identifier, bukan dua** | Hanya email. Tidak ada username, tidak ada reserved-word list. | [T] |
| **Anti-enumeration konsisten** | Pesan login & recovery **harus identik** baik untuk akun ada maupun tidak. | [T] |
| **Similarity check > composition check** | Password ditolak kalau sama dengan email atau nama. Tidak ada aturan "harus 1 angka". | [T] |
| **Tidak ada konfirmasi password** | Field `passwordConfirmation` **dihapus**. | [T] |
| **Consent deklaratif + jejak audit** | Tidak ada checkbox, tapi server mencatat `consentVersion` + `consentedAt`. | [T] |
| **Pisahkan=web vs API** | Cookie untuk browser, Bearer token untuk API. Tidak dicampur. | [T] |
| **API key publik, token rahasia** | Untuk OAuth nanti: key = identitas app, token = kredensial user. | [T] |
| **Verbositas tinggi di log, rendah di user** | Log internal sangat terstruktur; pesan user generik. | [T] |
| **Multi-step pakai token bertanda tangan** | OTP & reset pakai JWT ber-TTL pendek, bukan session server. | [T] |
| **Password bocor = paksa ganti** | 403 dengan instruksi jelas, bukan sekadar tolak. | [T] |

### 1.2 Prinsip yang Sengaja TIDAK Diambil

| Trello | Alasan ditolak |
|---|---|
| Pre-check `check-username` sebelum password | UX bagus tapi **membocorkan keberadaan akun** (terverifikasi). Kita tidak punya kebutuhan UI yang sebanding. |
| 7 keyword Atlassian diblokir sebagai password | Terlalu spesifik vendor. Kita pakai daftar reserved generic. |
| Rate limit per-IP via AWS WAF | Infrastruktur Atlassian. Untuk lokal cukup `@nestjs/throttler`. |
| 3 lapis CAPTCHA (reCAPTCHA + AWS WAF + Castle) | Berlebihan untuk skala project kuliah. Satu toggle CAPTCHA enough. |
| OAuth 1.0a | Deprecated secara global. Langsung OAuth 2.0 kalau нужна. |
| `dsc` cookie `SameSite=None` | Hanya untuk iframe Power-Up. Tidak relevan. |

---

## 2. Konsep API

Mengikuti `event-management-api-spec.md` Section 2.

### Success Response
```json
{ "success": true, "message": "...", "data": {} }
```

### Error Response
```json
{ "success": false, "message": "...", "error": "...", "statusCode": 400 }
```

> **`message` tetap `string` untuk semua error auth.** Kita tidak memakai array seperti validasi 422, karena pesan auth memang tunggal dan generik. Ini keputusan conscious: array error Untuk form-driven validation, string untuk auth.

---

## 3. HTTP Status Code untuk Auth

| Status | Kapan dipakai |
|---|---|
| `200` | Sukses |
| `201` | Registrasi berhasil |
| `400` | Business validation gagal (mis. password tak cocok nama, OTP salah) |
| `401` | Kredensial salah / token invalid / akun terkunci |
| `403` | Akun belum verifikasi email / akun nonaktif |
| `409` | Email sudah terdaftar **[LIHAT Section 6.1 — anti-enumeration]** |
| `422` | Format input salah (dari `ValidationPipe`) |
| `429` | Rate limit / terlalu banyak percobaan |
| `500` | Error internal |

---

## 4. Endpoint Ringkasan

| Method | Endpoint | Auth | Status Sukses |
|---|---|---|---|
| `POST` | `/auth/register` | No | `201` |
| `POST` | `/auth/login` | No | `200` |
| `POST` | `/auth/logout` | Yes | `200` |
| `POST` | `/auth/logout-all` | Yes | `200` |
| `POST` | `/auth/refresh` | Yes (refresh) | `200` |
| `GET`  | `/auth/me` | Yes | `200` |
| `GET`  | `/auth/sessions` | Yes | `200` |
| `DELETE` | `/auth/sessions/:id` | Yes | `204` |
| `POST` | `/auth/verify-email/request` | No | `202` |
| `POST` | `/auth/verify-email/confirm` | No | `200` |
| `POST` | `/auth/forgot-password` | No | `202` |
| `POST` | `/auth/reset-password` | No | `200` |
| `POST` | `/auth/change-password` | Yes | `200` |

Base URL: `/api/v1`

---

## 5. Data Model

### 5.1 User

```typescript
export type UserStatus = 'active' | 'unverified' | 'suspended' | 'deleted';

export interface User {
  id: string;
  email: string;           // SELALU lowercase, sudah ternormalisasi
  name: string;
  passwordHash: string;    // argon2id, TIDAK PERNAH plaintext
  status: UserStatus;
  emailVerifiedAt: Date | null;
  consentVersion: string | null;    // jejak audit consent
  consentedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Field yang DITAMBAH dibanding entity sekarang** (`users/entities/user.entity.ts`):

| Field | Alasan |
|---|---|
| `status` | Menyediakan 4 state akun — fondasi untuk verification & lockout |
| `emailVerifiedAt` | Ganti flag boolean agar menyimpan kapan |
| `consentVersion` + `consentedAt` | Jejak audit legal ala Atlassian, tanpa checkbox |
| `failedLoginAttempts` + `lockedUntil` | Lockout permanen butuh state tersimpan |
| `passwordHash` (ganti `password`) | Rename membuat jelas ini bukan plaintext |

### 5.2 RefreshToken

```typescript
export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;       // SHA-256 dari token, bukan token mentah
  userAgent: string | null;
  ip: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;   // untuk deteksi reuse
  createdAt: Date;
}
```

> **Refresh token disimpan sebagai hash.** Kalau DB bocor, refresh token tidak langsung bisa dipakai. Pola ini wajib.

### 5.3 VerificationToken

Untuk OTP verifikasi email dan reset password.

```typescript
export type VerificationPurpose = 'verify_email' | 'reset_password' | 'change_email';

export interface VerificationToken {
  id: string;
  userId: string;
  purpose: VerificationPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  attempts: number;        // untuk rate limit percobaan
  createdAt: Date;
}
```

---

## 6. Aturan Validasi

### 6.1 Email — normalisasi WAJIB

> ⚠️ **Ini temuan paling penting dari riset.** Implementasi sekarang (`users.service.ts:19`) memakai `===` sehingga `A@B.com` dan `a@b.com` dianggap akun berbeda.

**Aturan normalisasi, diterapkan di DTO (via transform) DAN di service (belt-and-braces):**

```typescript
email.trim().toLowerCase()
```

**Konsistensi wajib:** normalisasi harus happen di **tiga** tempat atau sistem akan bocor:
1. Saat create user
2. Saat lookup (`findByEmail`)
3. Saat update email

**Schema:**

| Aturan | Nilai | Sumber |
|---|---|---|
| Wajib | Ya | — |
| Format | Wajib ada isi sebelum & sesudah `@` | [T] |
| Panjang min | 3 | [R] |
| Panjang max | **254** | [B] — RFC 5321 batas panjang total alamat |
| Dinormalisasi | `trim().toLowerCase()` | [R] |
| Unik | Ya, case-insensitive | [R] |
| Domain diblokir | Diblokir: `example.com`, `example.org`, `example.net`, `localhost`, `.test`, `.invalid` | [T] |

> **Kenapa 254 dan bukan 100?** Trello tidak mempublikasikan batasnya (**tidak terverifikasi**). Kita pilih 254 karena RFC 5321 — bukan angka karangan, tapi standar.
>
> **Domain diblokir:** Trello terbukti menolak `example.com` tapi menerima `.test`. Menariknya, kemungkinan besar konsekuensi MX lookup, bukan blacklist statis. Kita tetap memakai daftar eksplisit karena perlu pesan error yang jelas.

**Domain yang diblokir & alasannya:**

| Domain | Alasan |
|---|---|
| `example.com/.org/.net` | Domain reservasi RFC 2606, tidak bisa menerima email |
| `localhost` | Tidak punya MX |
| `.test`, `.invalid`, `.example` | TLD reservasi RFC 6761 |

---

### 6.2 Name

| Aturan | Nilai | Sumber |
|---|---|---|
| Wajib | Ya | [T] |
| Panjang min | 1 | [T] |
| Panjang max | **255** | [T] |
| Tidak boleh kosong setelah trim | Ya | [T] |
| Tidak boleh berbentuk email | Ya | [T] |
| Tidak boleh sama dengan password | Ya, case-insensitive | [T] |
| Karakter | Bebas (unicode) | [T] |

> Trello tidak membatasi karakter nama — hanya panjang dan similarity. Kita ikuti persis.

---

### 6.3 Password

> **Keputusan utama: TIDAK ADA aturan komposisi karakter.**

| Aturan | Nilai | Sumber |
|---|---|---|
| Panjang min | **8** | [T] |
| Panjang max | **100** | [T] |
| Tidak boleh kosong setelah trim | Ya | [T] |
| Tidak boleh = email | Ya, case-insensitive | [T] |
| Tidak boleh = name | Ya, case-insensitive | [T] |
| Tidak boleh = reserved words | Ya | [T] |
| Tidak boleh di breach list | Ya (opsional, flagged) | [T] |
| Komposisi (upper/lower/digit/symbol) | **TIDAK ADA** | [T] |
| Konfirmasi password | **TIDAK ADA FIELD** | [T] |

> **Kenapa min 8 dan bukan 12?** Trello: `getMinimumPasswordLength = () => isFedM() ? 12 : 8`. 12 hanya untuk lingkungan FedRAMP. Kita tidak FedRAMP.
>
> **Kenapa max 100?** Trello punya batas hard dengan pesan eksplisit: `"Password length capped at 100 characters"`. Bukan hanya untuk UX — juga mencegah bcrypt truncation pada 72 byte.
>
> **Kenapa tidak ada komposisi?** Riset menunjukkan aturan komposisi itu **tidak dikonfirmasi aktif** di path Trello gratis, sementara similarity check **terbukti ada dan berjalan**. Similarity check memberi perlindungan nyata; "harus 1 angka" hanya mendorong `Password1!`.
>
> **Kenapa tidak ada konfirmasi password?** Nol field konfirmasi di 4 MB bundle Trello. Alasannya kuat: password manager butuh paste, dan konfirmasi hanya menambah gesekan.

**Reserved words (umum, bukan spesifik vendor):**
```typescript
export const RESERVED_WORDS = [
  'admin', 'administrator', 'root', 'user', 'users',
  'password', 'passwd', 'secret', 'login', 'signin',
  'event', 'events', 'attendee', 'organizer',
  'test', 'demo', 'example', 'temp', 'tmp',
];
```
> Trello memblokir `atlassian`, `bitbucket`, `confluence`, `jira`, `opsgenie`, `statuspage`, `trello`. Kita pakai daftar generic karena reserved-word harus relevan dengan domain aplikasi kita.

**Implementasi similarity check:**

```typescript
import { IsString, MaxLength, MinLength, IsNotEmpty, IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';
import { RESERVED_WORDS } from '../constants/reserved-words';

export class RegisterDto {
  @Transform(({ value }) => value?.trim())
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @MaxLength(254, { message: 'Email must not be longer than 254 characters' })
  email: string;

  @Transform(({ value }) => value?.trim())
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(1)
  @MaxLength(255, { message: 'Name must not be greater than 255 characters' })
  name: string;

  @IsString()
  @MinLength(8, { message: 'Password must have at least 8 characters' })
  @MaxLength(100, { message: 'Password length capped at 100 characters' })
  password: string;
}
```

> **`passwordConfirmation` dihapus dari DTO.** Spec lama (`event-management-api-spec.md` Section 31.1) masih punya field ini — itu yang berubah.

---

### 6.4 Register — Business Validation

Semua dijalankan di service, dalam urutan ini:

```
1. Normalisasi email                          → 422 (Transform, bukan business)
2. Format email valid                          → 422
3. Domain tidak diblokir                       → 400
4. Email belum terdaftar                       → 409  (lihat 6.1 caveat)
5. Password ≥ 8 dan ≤ 100                      → 422
6. Password ≠ email                            → 400
7. Password ≠ name                             → 400
8. Password ∉ RESERVED_WORDS                   → 400
9. Name bukan format email                     → 400
10. Name ≠ password                            → 400
11. (opsional) Password ∉ breach list          → 400
12. Hash password (argon2id)                    → internal
13. Simpan user dengan status='unverified'      → internal
14. Kirim OTP 6 digit, TTL 15 menit            → internal
15. Return user TANPA passwordHash             → 201
```

**Response 201:**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email for a verification code.",
  "data": {
    "user": {
      "id": "usr_01HXYZ123",
      "name": "Jamal Apriadi",
      "email": "jamal@example.com",
      "status": "unverified",
      "createdAt": "2026-10-05T02:30:00Z"
    },
    "emailVerificationRequired": true
  }
}
```

> **Tidak ada `accessToken` pada response register.** Berbeda dari spec lama yang langsung mengembalikan token. Alasannya: akun belum terverifikasi email, jadi memberi full access token bertentangan dengan model kita. Client harus `verify-email/confirm` dulu baru `login`.
>
> Ini **deviasi dari spec lama yang disengaja.** Alasannya didokumentasikan di [Section 15.1](#151-perubahan-terhadap-spec-lama).

**Pesan business validation:**

| Kondisi | Status | Message |
|---|---|---|
| Domain diblokir | `400` | `The provided email address is not allowed, please use a different one` |
| Email sudah dipakai | `409` | `Email already registered` |
| Password = email | `400` | `Your password can't match your email address.` |
| Password = name | `400` | `Your password can't match your display name.` |
| Password = reserved word | `400` | `Your password can't match a reserved word.` |
| Password di breach list | `400` | `This password has appeared in an external data breach. To continue, enter another password.` |
| Password terlalu umum | `400` | `This password is too widely used. Choose a password that's harder to guess.` |
| Name = email | `400` | `Please ensure your full name is not an email address` |
| Name = password | `400` | `Please ensure your full name is not your password` |

---

### 6.5 Login

> **Perubahan penting: TIDAK ADA validasi panjang password di login.**

Spec lama punya `@MinLength(8)` di `LoginDto.password`. Itu **bug**: kalau kebijakan password berubah, user dengan password lama **terkunci permanen** dan tidak bisa login sama sekali. Password di login **hanya** dicek: ada, string, dan tidak kosong.

```typescript
export class LoginDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
  // TIDAK ADA MinLength / MaxLength
}
```

**Business validation di service:**

```
1. Normalisasi email                          → 422
2. Format email valid                          → 422
3. Rate limit per-IP (10 / menit)              → 429
4. Rate limit per-email (5 / menit)            → 429
5. Lockout per-akun (5 gagal → lock 15 menit)  → 429
6. Cari user (hash compare, timing-safe)       → internal
7. Password cocok?                             → 401
8. Status = 'suspended'/'deleted'?             → 403
9. Status = 'unverified'?                      → 403
10. Reset failedLoginAttempts                  → internal
11. Terbitkan access + refresh token           → internal
12. Return user + token                        → 200
```

> **Langkah 6–7 wajib timing-safe.** Implementasi sekarang (`event-auth.service.ts:59`) memakai `user.password !== dto.password` — itu leaking timing DAN membandingkan plaintext. Harus pakai `argon2.verify()`.

**Response 200:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "usr_01HXYZ123",
      "name": "Jamal Apriadi",
      "email": "jamal@example.com",
      "status": "active"
    },
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

**Response error — pesan WAJIB identik:**

| Kondisi | Status | Message |
|---|---|---|
| Email tidak ada ATAU password salah | `401` | `Incorrect email address and/or password. Try again or reset your password.` |
| Akun terkunci | `429` | `Too many login attempts. Please try again in a few minutes.` |
| Email belum diverifikasi | `403` | `Please verify your email address before logging in. Check your inbox for the verification code.` |
| Akun suspended | `403` | `Your account has been suspended. Please contact support.` |
| Rate limit | `429` | `Too many requests. Please try again later.` |

> **Aturan anti-enumeration yang tidak bisa ditawar:** baris pertama dan baris "email belum diverifikasi" **tidak boleh** membocorkan apakah email terdaftar. `403` untuk unverified **membocorkan** bahwa email itu terdaftar — tapi ini trade-off yang disengaja: user butuh tahu harus verifikasi, dan endpoint verify-email ada. Kita tetap tidak pernah bilang "email tidak terdaftar" di jalur login.

---

### 6.6 Verify Email

#### Request OTP

```http
POST /api/v1/auth/verify-email/request
```
**Response `202 Accepted`:**
```json
{
  "success": true,
  "message": "If an account exists for that email, a verification code has been sent."
}
```
> **Respons netral** — pola yang sama seperti password recovery Trello. Tidak membocorkan keberadaan akun. Status `202` bukan `200` karena work-nya asynchronous.

#### Confirm OTP

```http
POST /api/v1/auth/verify-email/confirm
```
```json
{ "email": "jamal@example.com", "code": "123456" }
```

**Business validation:**
```
1. Normalisasi email + format          → 422
2. Rate limit (5 percobaan / token)    → 429
3. Token ada & belum expired?          → 400 "Token expired"
4. attempts < 5?                       → 429 "Rate limit exceeded. Try again in a couple of minutes."
5. Code cocok?                          → 400 "Provided verification code is invalid"
6. Set emailVerifiedAt, status='active' → internal
7. Return 200                           → 200
```

| Kondisi | Status | Message |
|---|---|---|
| OTP kosong | `422` | `Verification code is required` |
| Token expired | `400` | `Token expired` |
| OTP salah | `400` | `Provided verification code is invalid` |
| Terlalu banyak percobaan | `429` | `Rate limit exceeded. Try again in a couple of minutes.` |

> **Pesan "Token expired" dan "invalid code" sengaja dibedakan.** Ini bukan enumerasi akun — sudah lolos ke tahap "token valid ada", jadi keberadaan email sudah diketahui oleh yang meminta. Trello juga membedakan keduanya.

**TTL: 900 detik (15 menit)** — persis seperti Trello (`exp - nbf = 900`).

---

### 6.7 Forgot & Reset Password

#### Request

```http
POST /api/v1/auth/forgot-password
```
```json
{ "email": "jamal@example.com" }
```

**Response `202` — SELALU identik:**
```json
{
  "success": true,
  "message": "If an account exists for that email, we've sent a password reset link."
}
```

> **Wajib identik** baik untuk email terdaftar maupun tidak. Ini persis implementasi Trello yang diverifikasi byte-identical.

#### Confirm

```http
POST /api/v1/auth/reset-password
```
```json
{ "email": "jamal@example.com", "token": "<JWT>", "newPassword": "newSecurePass1" }
```

**Business validation:**
```
1. Normalisasi email + format           → 422
2. Token valid & belum expired?         → 400 "Reset link is invalid or has expired"
3. New password lolos semua aturan 6.3  → 400/422
4. Hash password baru                   → internal
5. Set passwordChangedAt                → internal
6. REVOKE semua refresh token user      → internal
7. Invalidate semua access token lama    → internal
8. Return 200                           → 200
```

| Kondisi | Status | Message |
|---|---|---|
| Token invalid/expired | `400` | `Reset link is invalid or has expired` |
| New password tidak lolos | `400`/`422` | (pesan dari Section 6.3) |
| Berhasil | `200` | `Password has been reset successfully` |

> **Langkah 6–7 wajib.** Kalau password di-reset tapi session lama masih hidup, akun yang dibajak tetap punya akses. Ini *forced logout* — hal yang tidak terverifikasi di Trello tapi jelas benar secara keamanan.
>
> **Kenapa step 7?** Karena access token JWT bersifat stateless, caraDicabutnya dengan `tokenVersion` di user payload. Naik `tokenVersion` = semua token lama otomatis invalid.

---

### 6.8 Change Password

```http
POST /api/v1/auth/change-password
Authorization: Bearer {accessToken}
```
```json
{ "currentPassword": "oldPass123", "newPassword": "newSecurePass1" }
```

```
1. Current password benar?                → 401 "Current password is incorrect"
2. New password ≠ current password?      → 400 "New password must be different from the current password"
3. New password lolos aturan 6.3         → 400/422
4. Hash + simpan                         → internal
5. Naikkan tokenVersion                  → internal
6. Revoke semua refresh token KECUALI yang sedang dipakai → internal
7. Return 200 + token baru               → 200
```

> **Mengapa refresh token yang sedang dipakai tidak dicabut?** Agar user tidak ikut logout dari request yang baru saja dia lakukan. Ini praktik umum OAuth 2.0 — refresh token lama di-*rotate* pada request berikutnya.

---

## 7. Token

### 7.1 Access Token

| Properti | Nilai | Alasan |
|---|---|---|
| Format | JWT | — |
| Algoritma | **HS256** | cukup untuk single-service |
| TTL | **900 detik (15 menit)** | [B] standar OAuth 2.0 |
| Secret | `JWT_SECRET` dari `.env`, min 32 char | wajib |
| Issuer | `event-management-api` | — |
| Audience | `event-management-api` | — |

**Payload:**
```json
{
  "sub": "usr_01HXYZ123",
  "email": "jamal@example.com",
  "name": "Jamal Apriadi",
  "role": "attendee",
  "status": "active",
  "tokenVersion": 3,
  "iss": "event-management-api",
  "aud": "event-management-api",
  "iat": 1791189196,
  "exp": 1791190096
}
```

> **`tokenVersion` adalah kunci revocation stateless.** Field ini memungkinkan kita mencabut semua access token user tanpa menyimpan blacklist. Tiap kali password diubah, naikkan `tokenVersion` → semua token lama mati otomatis. Ini menyelesaikan masalah "logout-all" tanpa state.

> **Kenapa HS256 dan bukan RS256?** Trello pakai RS256 karena_architekturally terdistribusi (banyak service, JWKS publik). Kita single service, jadi HS256 cukup dan lebih sederhana.

### 7.2 Refresh Token

| Properti | Nilai |
|---|---|
| Format | **opaque random**, bukan JWT |
| Panjang | 64 byte, base64url |
| Disimpan sebagai | SHA-256 hash |
| TTL | **30 hari** |
| Rotation | Ya — setiap refresh memberi token baru, yang lama di-revoke |
| Deteksi reuse | `replacedById` menandai rantai |

**Response `POST /auth/refresh`:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "bmV3LXJhbmRvbS10b2tlbi4uLg",
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

> **Refresh token = opaque, bukan JWT.** Alasannya: refresh token butuh **revocable**. JWT mustahil dicabut tanpa state tambahan. Dengan token opaque + hash di DB, `DELETE` satu row = selesai.
>
> **Deteksi reuse:** kalau refresh token yang sudah di-revoke dipakai lagi, itu tanda pencurian.aty-policy: revoke **seluruh** refresh token user tersebut.

---

## 8. Rate Limiting

Menggunakan `@nestjs/throttler`.

| Endpoint | Limit | Window | Keterangan |
|---|---|---|---|
| `POST /auth/login` | 10 | 1 menit | per-IP |
| `POST /auth/login` | 5 | 1 menit | per-email (key = normalized email) |
| `POST /auth/register` | 5 | 1 jam | per-IP |
| `POST /auth/forgot-password` | 3 | 1 jam | per-IP |
| `POST /auth/reset-password` | 10 | 1 jam | per-IP |
| `POST /auth/verify-email/request` | 5 | 1 jam | per-IP |
| `POST /auth/verify-email/confirm` | 5 | 15 menit | per-token |
| Default (endpoint lain) | 100 | 1 menit | per-IP |

**Lockout per-akun:**

```
failedLoginAttempts ≥ 5  →  lockedUntil = now + 15 menit
lockedUntil > now        →  429 "Too many login attempts. Please try again in a few minutes."
lockout expired          →  reset failedLoginAttempts = 0, izinkan login lagi
```

> **Dua lapis, bukan satu.** Trello hanyalockout per-IP. Kita pakai per-IP **dan** per-akun supaya penyerang dari banyak IP tetap tertahan.

**Response 429:**
```json
{
  "success": false,
  "message": "Too many requests. Please try again later.",
  "error": "Too Many Requests",
  "statusCode": 429
}
```
Plus header:
```http
Retry-After: 60
```

---

## 9. Struktur Module NestJS

```text
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── token.service.ts              ← issue/verify access + refresh
│   ├── verification.service.ts       ← OTP & reset token
│   ├── password.service.ts           ← hash/verify/similarity check
│   ├── rate-limit.service.ts         ← lockout per-akun
│   ├── constants/
│   │   └── reserved-words.ts
│   ├── dto/
│   │   ├── register.dto.ts
│   │   ├── login.dto.ts
│   │   ├── refresh-token.dto.ts
│   │   ├── verify-email.dto.ts
│   │   ├── confirm-verification.dto.ts
│   │   ├── forgot-password.dto.ts
│   │   ├── reset-password.dto.ts
│   │   └── change-password.dto.ts
│   └── __tests__/
│
├── common/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts         ← diperbaiki, bukan tokenStore Map
│   │   └── throttler.guard.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── public.decorator.ts       ← untuk menandai endpoint terbuka
│   ├── filters/
│   │   └── all-exceptions.filter.ts  ← plus handler 429
│   └── helpers/
│       └── response.helper.ts
│
├── users/
│   ├── users.service.ts              ← normalisasi email di findByEmail
│   └── entities/
│       └── user.entity.ts            ← field baru
```

> **`src/auth/` yang lama (duplikat) harus dihapus atau di-merge.** Sekarang ada `src/auth/` (sisa scaffold NestJS, menunjuk ke `Member`) dan `src/event-auth/`. Hanya `EventAuthModule` yang wired di `app.module.ts`. Struktur di atas memakai satu `auth/` saja.
>
> Kalau memilih path rename (`event-auth` → `auth`), lakukan sekaligus hapus yang lama. Jangan biarkan keduanya hidup.

---

## 10. Controller Signatures

```typescript
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  register(@Body() dto: RegisterDto) { /* ... */ }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() dto: LoginDto) { /* ... */ }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: AuthenticatedUser) { /* ... */ }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) { /* ... */ }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthenticatedUser) { /* ... */ }
}
```

---

## 11. Validasi Global (Tetap Sama)

Tidak berubah dari `main.ts` sekarang:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
);
```

> **`forbidNonWhitelisted: true` tetap dipakai.** Konsekuensinya: field `passwordConfirmation` **akan ditolak** dengan 422 kalau client mengirimnya. Ini yang kita mau — spec lama masih mengirimnya, dan client akan dapat error jelas bahwa field itu dihapus.

---

## 12. Dependency Baru

```bash
npm install argon2 @nestjs/throttler
```

| Package | Alasan |
|---|---|
| `argon2` | Hashing password. `argon2id` — memory-hard, Resistance lebih baik dari bcrypt |
| `@nestjs/throttler` | Rate limiting |

> **`argon2` butuh native binding.** Kalau `npm install` gagal di environment tertentu, fallback ke `bcrypt`. Tapi argon2 lebih baik karena memory-hard — GPU cracking jauh lebih mahal.
>
> `@nestjs/jwt` **sudah terpasang** — tidak perlu install.

Environment variables baru:
```bash
# .env
JWT_SECRET=<min 32 karakter random>
JWT_EXPIRES_IN=900
REFRESH_TOKEN_EXPIRES_IN=2592000
ARGON2_MEMORY_COST=19456
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1
```

---

## 13. Checklist Implementasi

### P0 — Kritis

- [ ] Hapus field `passwordConfirmation` dari `RegisterDto`
- [ ] Hapus `@MinLength(8)` dari `LoginDto`
- [ ] Hash password dengan argon2id — hapus storing plaintext
- [ ] Normalisasi email: `trim().toLowerCase()` di create, lookup, dan update
- [ ] Ganti `Map` token store dengan JWT sungguhan (`@nestjs/jwt`)
- [ ] Timing-safe password comparison (`argon2.verify`)
- [ ] Tambah `status`, `emailVerifiedAt`, `tokenVersion` ke User
- [ ] Naikkan `tokenVersion` saat password berubah

### P1 — Penting

- [ ] Install + configure `@nestjs/throttler`
- [ ] Rate limit per-IP + per-email + lockout per-akun
- [ ] Endpoint verify-email (OTP 6 digit, TTL 900s)
- [ ] Endpoint forgot/reset password dengan respons netral
- [ ] Refresh token dengan rotation + deteksi reuse
- [ ] Hapus `src/auth/` duplikat atau rename `event-auth` → `auth`

### P2 — Polish

- [ ] Consent tracking (`consentVersion`, `consentedAt`)
- [ ] Breach password check (flag opsional, default off)
- [ ] Header keamanan (`helmet`)
- [ ] CORS whitelist
- [ ] `GET /auth/sessions` + `DELETE /auth/sessions/:id`
- [ ] Unit test untuk setiap aturan similarity check
- [ ] E2E test untuk anti-enumeration (pesan identik)

### Test Minimum yang Wajib Ada

```
1. Register dengan email valid            → 201
2. Register dengan email terduplikasi    → 409
3. Register password < 8                 → 422
4. Register password > 100               → 422
5. Register password = email             → 400
6. Register password = name              → 400
7. Register name = email                 → 400
8. Register dengan domain diblokir       → 400
9. Register email " A@B.com "            → ternormalisasi a@b.com
10. Login email tidak ada                → 401 dengan pesan SPESIFIK
11. Login password salah                 → 401 dengan pesan IDENTIK dengan #10
12. Login 6x gagal                       → 429
13. Login akun unverified                → 403
14. OTP salah                            → 400
15. OTP expired                          → 400 "Token expired"
16. Forgot email ada                     → 202
17. Forgot email tidak ada               → 202 dengan pesan IDENTIK dengan #16
18. Reset password                       → revoke semua refresh token
19. Refresh dengan token revoked         → 401
20. Refresh dengan token lama (reuse)    → 401 + revoke semua
21. Change password                      → tokenVersion naik
22. Akses dengan token lama setelah reset → 401
```

> **Test #10 dan #11 adalah yang paling penting.** Assert `expect(body10.message).toBe(body11.message)` — bukan hanya assert status code. Itu satu-satunya cara untuk mengunci anti-enumeration.

---

## 14. Contoh Request/Response Lengkap

### Register — sukses

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "Jamal Apriadi",
  "email": "  Jamal@Example.COM ",
  "password": "sensiblePass1"
}
```
```json
201 Created
{
  "success": true,
  "message": "Registration successful. Please check your email for a verification code.",
  "data": {
    "user": {
      "id": "usr_01HXYZ123",
      "name": "Jamal Apriadi",
      "email": "jamal@example.com",
      "status": "unverified",
      "createdAt": "2026-10-05T02:30:00Z"
    },
    "emailVerificationRequired": true
  }
}
```
> Perhatikan: input `Jamal@Example.COM` dengan spasi → output `jamal@example.com`. Normalisasi bekerja.

### Login — email tidak ada

```json
401 Unauthorized
{
  "success": false,
  "message": "Incorrect email address and/or password. Try again or reset your password.",
  "error": "Unauthorized",
  "statusCode": 401
}
```

### Login — password salah

```json
401 Unauthorized
{
  "success": false,
  "message": "Incorrect email address and/or password. Try again or reset your password.",
  "error": "Unauthorized",
  "statusCode": 401
}
```
> **Pesan identik.** Ll comparar body #1 dan #2 secara byte-for-byte.

### Validasi format — 422

```http
POST /api/v1/auth/register
Content-Type: application/json

{ "name": "", "email": "bukan-email", "password": "pendek" }
```
```json
422 Unprocessable Entity
{
  "success": false,
  "message": [
    "Name is required",
    "Email must be a valid email address",
    "Password must have at least 8 characters"
  ],
  "error": "Unprocessable Entity",
  "statusCode": 422
}
```

---

## 15. Catatan Keputusan (Rationale)

### 15.1 Perubahan terhadap Spec Lama

| Spec lama | Spec ini | Alasan |
|---|---|---|
| `passwordConfirmation` di register | **Dihapus** | [T] Trello tidak punya. Password manager butuh paste tanpa konfirmasi. |
| `@MinLength(8)` di `LoginDto` | **Dihapus** | Bug: user dengan password lama terkunci permanen. |
| Register mengembalikan `accessToken` | **Tidak lagi** | Akun belum verified; full token sebelum verifikasi bertentangan dengan model. |
| Email max length tidak ada | **254** | Standar RFC 5321. |
| Name max 100 | **255** | [T] nilai Trello. |
| Password plaintext | **argon2id** | Kritis. |
| `Map` token store | **JWT + refresh token** | Persistensi, expiry, revocation. |
| `409 Email already registered` | Tetap, tapi **dengan catatan** | Lihat 15.2 |
| Logout hapus 1 token | + `logout-all` | [T] Trello mendukung "log out of all devices". |

### 15.2 Trade-off yang Tidak Sempurna

Spec ini punya beberapa trade-off yang **sengaja tidak diselesaikan**. Lebih baik ditulis secara terbuka daripada dikubur.

**Trade-off 1: `409` pada register tetap membocorkan email terdaftar.**
Trello juga begitu (`It looks like you've already got an account…`). Dan signup *harus* bisa mengatakan ini — user perlu tahu harus login, bukan signup. Yang kita lakukan: **minimalkan** kebocokan (hanya di register, tidak di login/recovery). Alternatifnya (pesan generik + instruksi "check your email") lebih aman tapi sangat membingungkan untuk pengguna nyata.

**Trade-off 2: `403 "Please verify your email"` membocorkan keberadaan akun.**
Akun yang tidak ada mendapat `401`, yang ada tapi unverified mendapat `403`. Jadi perbedaan status code membocorkan. Trello tidak punya masalah ini karena verifikasi email terjadi sebelum account dibuat sepenuhnya. Kita tidak bisa.Hasilkan user experience yang sama tanpa mengorbankan kejelasan. Diterima karena scope project.

**Trade-off 3: `verify-email/confirm` dan `reset-password` membedakan "expired" vs "invalid".**
Secara teknis ini menambah attack surface informasi. Tapi setelah user lolos ke "token valid ada", keberadaan email sudah diketahui. Membedakan keduanya sangat membantu UX.

**Trade-off 4: Rate limit angka dipilih sendiri, bukan dari Trello.**
Atlassian **tidak mempublikasikan** angka ambangnya (temuan negatif yang sah). Angka di Section 8 adalah pilihan kita berdasarkan best practice umum, bukan replikasi Trello. Jangan diklaim sebagai "sesuai Trello".

### 15.3 Hal yang Tidak Diverifikasi dari Trello

Jika suatu aturan di spec ini terlihat seperti "aturan Trello", periksa Section 11 di `docs/research/trello-auth-analysis.md`. Ringkasnya:

| Aturan | Status di Trello |
|---|---|
| Email max length | **Tidak diketahui** (kita pilih 254 dari RFC) |
| Normalisasi lowercase server-side | **Tidak observable** (kita putuskan sendiri) |
| Aturan komposisi password | **Tidak terverifikasi aktif** |
| Ambang rate limit | **Tidak dipublikasikan** (angka kita pilih sendiri) |
| Normalisasi/trim password | **Tidak observable** |
| Email | digest definisi reserved domain | **Isi blacklist tidak diketahui** |

---

## 16. Ringkasan ()

Semua keputusan dalam satu tabel:

| Kategori | Keputusan | Sumber |
|---|---|---|
| Identifier | Email only | [T] |
| Email normalisasi | `trim().toLowerCase()` | [R] |
| Email max | 254 | [B] |
| Email domain blokir | RFC 2606/6761 reserved | [R] |
| Name min/max | 1 / 255 | [T] |
| Name ≠ email | Ya | [T] |
| Name ≠ password | Ya | [T] |
| Password min | 8 | [T] |
| Password max | 100 | [T] |
| Password composition | Tidak ada | [T] |
| Password similarity check | 3 aturan (email, name, reserved) | [T] |
| Password confirmation | Tidak ada | [T] |
| Hashing | argon2id | [B] |
| Access token | JWT HS256, 15 menit | [B] |
| Refresh token | Opaque + hash + rotation, 30 hari | [B] |
| Revocation | `tokenVersion` | [R] |
| OTP | 6 digit, TTL 900s | [T] |
| Anti-enumeration | Pesan identik di login & recovery | [T] |
| Rate limit | 10/menit per-IP, 5/menit per-email | [R] |
| Lockout | 5 gagal → 15 menit | [R] |
| Consent | Deklaratif + `consentVersion` | [T] |
| Register response | Tanpa access token | [R] |
