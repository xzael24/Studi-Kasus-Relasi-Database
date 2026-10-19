# Analisis Lengkap Sistem Login & Registrasi Trello.com

**Tanggal:** 5 Oktober 2026
** Objek:** `trello.com/login`, `trello.com/signup`, `id.atlassian.com`, `api.trello.com`
**Basis bukti:** dokumen resmi Atlassian (`developer.atlassian.com`, `support.atlassian.com`), bundle JS produksi `id.atlassian.com` (4,13 MB, 573 pesan i18n unik), probe HTTP langsung ke `api.trello.com`, dan observasi DOM/cookie di browser sungguhan.

> **Dua laporan sumber (detail lengkap ada di sana):**
> - `docs/research/trello-auth-login-register.md` — alur UI, validasi, error, mekanisme keamanan
> - `docs/research/trello-auth-sessions-tokens.md` — cookie, sesi, token, OAuth, rate limit, kontrak error
>
> Dokumen ini adalah **sintesis** kedua laporan tersebut ditambah analisis gap terhadap kode repo ini.

---

## 1. Temuan Utama (TL;DR)

1. **Trello tidak punya sistem login sendiri.** `trello.com/login` dan `/signup` hanya **302 redirect** ke `id.atlassian.com`. Trello adalah *relying party*, Atlassian ID adalah *identity provider*.
2. **Konsep "username" sudah mati.** Field login bernama `username` di wire format, tapi isinya **email**. Tidak ada username, tidak ada reserved-word list, tidak ada handle `@user`.
3. **Login dua langkah, bukan satu form.** Email → `POST /rest/check-username` → server putuskan via enum `action` → baru password → `POST /rest/authenticate`.
4. **Signup tiga langkah, urutannya email → OTP → baru nama+password.** Password bukan field langkah pertama.
5. **Password policy-nya *similarity-based*, bukan composition-based.** Min 8 (12 di FedRAMP), maks **100**, dan ditolak kalau sama dengan email / display name / salah satu dari 7 keyword Atlassian.
6. **Tidak ada field konfirmasi password sama sekali** — nol dari 573 pesan i18n.
7. **Anti-enumeration dipakai tapi bocor di satu titik.** `/rest/authenticate` dan recovery identik untuk akun ada/tidak; tapi `check-username` membalasan `action:"signup"` → UI berubah ke "Sign up to continue".
8. **Tiga lapis anti-bot:** reCAPTCHA Enterprise (selalu aktif, badge disembunyikan), AWS WAF CAPTCHA (setelah kegagalan), Castle.io device fingerprinting.
9. **Dua pesawat auth yang terpisah total:** web = cookie; API = token only, cookie **ditolak**.
10. **10 dari 15 temuan mayor di -*-
report sesi bertanda UNVERIFIED** karena butuh kredensial. Angka tidak dikarang.

---

## 2. Arsitektur: Siapa Memiliki Apa

```
┌─────────────────────────────────────────────────────────────┐
│  trello.com  —  Next.js SSR                                 │
│  • Tidak menyajikan form auth sama sekali                    │
│  • Cookie: atl_session, atlUserHash, dsc, atl_xid.*         │
│  • Callback: /auth/atlassian/callback  (cookie auth.csrf)   │
└──────────────┬──────────────────────────┬───────────────────┘
               │ 302 continue=…           │ XHR ke /1/*  (COOKIE ONLY)
               ▼                          ▼
┌──────────────────────────────────────────────┐   ┌────────────────────┐
│  id.atlassian.com  —  React SPA              │   │  api.trello.com    │
│  • SATU-SATUNYA pemilik form login/signup    │   │  • TOKEN ONLY      │
│  • Validasi client-side                      │   │  • Cookie DITOLAK  │
│  • Rate limit, CAPTCHA, 2FA, lockout        │   │  • CORS: `*`       │
│  • Cookie: atlassian.account.xsrf.token      │   └────────────────────┘
│            (HttpOnly), aws-waf-token         │
└──────────────┬──────────────────────────────┘
               │ redirect_uri
               ▼
┌──────────────────────────────────────────────┐
│  auth.atlassian.com  —  Auth0 + OAuth 2.0     │
│  • Google, Microsoft, Apple, Slack, Passkey  │
│  • authorize / oauth/token / oauth/revoke    │
│  • /.well-known/openid-configuration        │
└──────────────────────────────────────────────┘
```

**Konsekuensi utama:** login Trello **bergantung pada `id.atlassian.com`**, yang berada di belakang AWS WAF. Ada satu titik kegagalan bersama antara Trello dan seluruh produk Atlassian lain.

### Callback-nya Punya Siapa (tabel redirect)

| Langkah | URL | Pemilik | Peran |
|---|---|---|---|
| 1 | `trello.com/login` | Trello | Entry point, **tidak ada form** |
| 2 | `id.atlassian.com/login?application=trello&continue=…` | Atlassian ID | **Form login sebenarnya** |
| 3 | `id.atlassian.com/rest/authenticate` | Atlassian ID | Verifikasi kredensial |
| 4 | `id.atlassian.com/rest/session` | Atlassian ID | Terbitkan sesi |
| 5 | `trello.com/auth/atlassian/callback` | Trello | Tukar token → sesi `atl_session` |
| 6 | `trello.com/?createMember=true` | Trello | Buat record member + onboarding |

Parameter `continue` yang dikirim Trello berisi callback bertingkat yang membawa flag: `returnUrl`, `aaOnboarding`, `updateEmail`, `traceId`, `ssoVerified`, `createMember`, `jiraInviteLink`.

> ⚠️ **Destinasi akhir setelah login (mis. `/b/{shortlink}` atau board terakhir) TIDAK TERBUKTI.** Researcher tidak pernah menyelesaikan login karena tidak punya kredensial. Jangan mengklaim ini.

---

## 3. Alur Login — Langkah demi Langkah

### Langkah 1: Halaman
1. `GET /login?application=trello&continue=<trello callback>` → SPA shell, script `index.04faf71f.js`
2. Heading **"Log in to continue"**, satu field berlabel **`Email*`**, checkbox **"Remember me"**, tombol **"Continue"**
3. `<form id="form-login" novalidate>` — `novalidate` **mematikan** validasi HTML5 meski `required` masih menempel
4. Input: `type="email" name="username" autocomplete="username" required` — **tanpa** `minlength`/`maxlength`/`pattern`

### Langkah 2: Pre-check identitas
5. Validasi client:
```js
let t = r.trim();
if ("" === t)              → "Enter an email address"
if (!t.match(/.+@.+/))     → "Email address must contain text before and after an '@' symbol"
```
6. `POST /rest/check-username` dengan `{username, recoveryToken, challenge-response, destinationOrgId}` + header `X-CSRF-TOKEN`
7. Server balas **enum `action`**:

| `action` | Arti | Efek UI |
|---|---|---|
| `no_action` | Normal | Tampilkan field password |
| `redirect` | Wajib SSO | Ikuti `redirect_uri` ke IdP |
| `ic_redirect` | Isolated Cloud | Ikuti `redirect_uri` |
| `signup` | **Email tidak terdaftar** | **Alihkan ke signup** ← bocor enumerasi |
| `social_login` | Social only | Tampilkan tombol provider |
| `continue_required` | Perlu Spectra | `POST /rest/v2/check-username/continue` |
| `not_permitted` | Ditolak | Tampilkan `error_code` |

### Langkah 3: Password
8. Field password **muncul** (bukan ada dari awal), `autocomplete="current-password"`
9. Submit → `POST /rest/authenticate` dengan `{username, password, state, token}`
   - `state` = `{csrfToken, anonymousId, userFlow, marketingConsent}`
   - `token` = Castle request token
   - **Tidak** ada header `X-CSRF-TOKEN` di endpoint ini
10. **Kontrak respons:**

| Status | Body | Arti |
|---|---|---|
| `200` | `{redirectUri}` | Sukses → navigasi |
| `403` | `{error}` | `access_denied` · `blocked_user` · `password_leaked` · `too_many_attempts` · `client_ip_not_allowed` |
| `405` | — | CAPTCHA AWS WAF dibutuhkan |
| `412` | `{error:"mfa_required", token}` | Redirect `/login/mfa` |
| `429` | `{error:"too_many_logins"}` | Terlalu banyak percobaan |

> `error_description` di-*base64*-JSON lalu di-decode client: `JSON.parse(atob(e.error_description))`

### Langkah 4: Sukses
11. `POST /rest/session` → `{redirectUrl, formErrors}` → navigasi ke `trello.com/auth/atlassian/callback`
12. Callback men-*set* `auth.csrf` (HttpOnly, Secure, `Path=/auth/callback`), lalu sesi `atl_session`

---

## 4. Alur Registrasi — Langkah demi Langkah

**Urutannya penting: password bukan field pertama.**

### Langkah 1: Email (`POST /rest/signup`)
1. Halaman **"Sign up to continue"**, field `Email`, tombol **"Sign up"**
2. `<form id="form-sign-up">` — **tidak** punya `novalidate`, input **tidak** punya `required`
3. Consent **bukan checkbox**, melainkan kalimat deklaratif:
   > "By signing up, I accept the Atlassian Cloud Terms of Service and acknowledge the Privacy Policy."
4. Submit → `POST /rest/signup` dengan `{email, challenge-response, castleToken, productHint}`

**Validasi yang benar-benar di-trigger:**

| Input | Sumber | Pesan renders |
|---|---|---|
| kosong | client | "Please enter an email address" |
| `not-an-email` | client | "Please enter an email address" |
| `a@b` | client | "Please enter a valid email address" |
| `@example.com` | **server** | "The provided email address is not allowed, please use a different one" |
| `@invalid-domain-xyz.test` | server | Lolos → redirect OTP |

Saat error server, Atlassian menambah `aria-invalid="true"` + `aria-describedby` — **UX aksesibilitas yang benar**.

### Langkah 2: Verifikasi OTP
5. Redirect `/signup/verify-email/otp?token=<JWT>`
6. UI: **"We've emailed you a code"** → 6 kotak `<input maxlength="1">`
7. Submit kosong → **"Complete the verification code"**

**Token verifikasi = JWT RS256, TTL tepat 900 detik (15 menit):**

```jsonc
// header
{ "kid": "micros/aid-account/ailevpgpap8185n0", "alg": "RS256" }
// payload
{
  "sub": "<email>",
  "scope": "verifyEmailOtp",
  "nbf": 1791189196,
  "exp": 1791190096,          // exp - nbf = 900 detik
  "userId": "712020:ebf4acc2-…",
  "recaptchaScore": "1.0",    // skor reCAPTCHA ditanam di token
  "jti": "26cae5…",
  "mfaToken": "<1051 karakter>"
}
```

> **Trade-off yang perlu dipahami:** JWT di query string memungkinkan langkah berikutnya jadi stateless (tanpa lookup server), **tetapi** berisiko bocor via `Referer`, access log, dan browser history. Atlassian men'seimbangnya dengan TTL pendek + `scope` sempit.

### Langkah 3: Nama + Password (`POST /rest/signup/welcome`)
8. Halaman asks `displayName` ("Full name") + `password`. Email **tidak** diinput ulang.
9. Validasi client (kode asli):

```js
let o = getMinimumPasswordLength();          // 8, atau 12 di FedRAMP
if ("" === displayName.trim())        err.displayName = "Please enter a name";
if ("" === password.trim())           err.password    = "Please enter a password";
if (password.length < o)              err.password    = "Password must have at least {min} characters";
if (emailRegex.test(displayName))     err.emailUsedAsName  = "Please ensure your full name is not an email address";
if (displayName.toLowerCase().trim() === password.toLowerCase().trim())
                                       err.passwordUsedAsName = "Please ensure your full name is not your password";
```

### Langkah 4: Onboarding
10. Redirect ke `trello.com/?createMember=true&aaOnboarding=` → indikasi kuat ada wizard onboarding.

> ⚠️ **Apakah akun bisa dipakai SEBELUM verifikasi email: TIDAK TERBUKTI.** Researcher tidak menyelesaikan OTP.
> ⚠️ **Tidak ada prompt workspace/team invite** di form Atlassian ID. Ada param `jiraInviteLink` di `continue`, jadi mungkin ada di sisi Trello — tidak terverifikasi.

---

## 5. Aturan Validasi — Tabel Konsolidasi

### 5.1 Login

| Field | Rule | Min | Max | Client? | Server? | Pesan error |
|---|---|---|---|---|---|---|
| Email (`name="username"`) | Wajib, `trim()`, ada isi sebelum & sesudah `@` | 1 | **tidak diketahui** | ✅ | ✅ | "Enter an email address" · "Email address must contain text before and after an '@' symbol" |
| Email normalisasi lowercase | — | — | — | ❌ | **tidak observable** | — |
| Email batas panjang | — | — | **tidak diketahui** | ❌ | ❌ | tidak ada `maxlength` |
| Password | Wajib | 1 | — | ✅ | ✅ | "Enter your password" |
| Password terlalu pendek | — | — | — | — | ✅ | "The password is too short." |
| Password terlalu panjang | batas **hard** | — | **100** | — | ✅ | "Password length capped at 100 characters" |
| Komposisi karakter | **tidak ada** di path login | — | — | ❌ | ❌ | — |
| **Konfirmasi password** | **FIELD TIDAK ADA** | — | — | — | — | N/A |
| Strength meter | zxcvbn, 5 level | — | — | ✅ | ❌ | Weak/Fair/Good/Strong/Very strong |

### 5.2 Registrasi

| Field | Rule | Min | Max | Client? | Server? | Pesan error |
|---|---|---|---|---|---|---|
| Email — format | regex `([a-z0-9._%\-+!#$&/=?^\|~ ]+)@([a-z0-9 -]+\.)+ *[a-z]+` **tanpa flag `i`** | 1 | **tidak diketahui** | ✅ | ✅ | "Please enter an email address" · "Please enter a valid email address" · "Email is required to be in correct format" |
| Email — domain diblokir | `example.com` ditolak | — | — | ❌ | ✅ | "The provided email address is not allowed, please use a different one" |
| Email — sudah dipakai | deteksi duplikat | — | — | ❌ | ✅ | "It looks like you've already got an account associated with this email. Log in instead or reset your password if you've forgotten it" |
| Email — alias | dibatasi | — | — | ❌ | ✅ | "Email aliases are rate limited" |
| **Full name** | Wajib; bukan email; ≠ password | 1 | **255** | ✅ | ✅ | "Please enter a name" · "Full name must not be empty" · "Full name must not be greater than 255 characters" · "Please ensure your full name is not an email address" · "Please ensure your full name is not your password" |
| **Password** | Wajib; **similarity check** | **8** (12 FedRAMP) | **100** | ✅ | ✅ | "Please enter a password" · "Password must have at least {min} characters" |
| Password ≠ email | — | — | — | ✅ | ✅ | "Your password can't match your email address." |
| Password ≠ display name | — | — | — | ✅ | ✅ | "Your password can't match your display name." |
| Password ≠ keyword Atlassian | 7 keyword | — | — | ✅ | ✅ | "Your password can't match an Atlassian keyword." |
| Password bocor (HIBP) | deteksi breach | — | — | ✅ | ✅ | "This password has appeared in an external data breach. To continue, enter another password." |
| Password umum | deteksi | — | — | ✅ | ✅ | "This password is too widely used. Choose a password that's harder to guess." |
| Riwayat password | dicek | — | — | ❌ | ✅ | "You've used that password before. Please choose a different one." |
| Komposisi karakter | string ada, **aktif tidak terverifikasi** | — | — | ❌ | ✅? | "Your password must contain at least one uppercase and one lowercase letter." · "Your password must contain at least one digit or special character." · "Your password must be between 8 and 72 characters long." |
| **Consent/TOS** | **bukan checkbox**; guard JS | — | — | ✅ | — | "Form cannot be submitted without showing Privacy Policy" (log internal) |
| **Username** | **FIELD TIDAK ADA** | — | — | — | — | "Your account username must be a valid email address." |
| OTP | 6 digit, 6 kotak | 6 | 6 | ✅ | ✅ | "Complete the verification code" · "Provided verification code is invalid" · "Token expired" |

### 5.3 Detail Penting

**Daftar 7 keyword Atlassian yang diblokir sebagai password:**
```js
["atlassian", "bitbucket", "confluence", "jira", "opsgenie", "statuspage", "trello"]
```

**Bug-level longgaran di `emailRegex`:**
- Tidak punya flag `i` → hanya cocok huruf kecil
- Mengizinkan **spasi** di dalam alamat (`[a-z0-9 -]+`)
- Hanya dipakai untuk mendeteksi "nama = email", bukan validasi utama

**Perbandingan nama-vs-password bersifat case-insensitive** (`toLowerCase()` di kedua sisi).

---

## 6. Kontrak Error

### 6.1 Tiga bentuk envelope Atlassian ID

```jsonc
// A. field-level
{ "fieldErrors": { "<fieldName>": "<pesan>" } }
// B. ui-level
{ "uiErrors": [ { "key": "<kode>" } ] }
// C. success + redirect
{ "redirectTo": "<url absolut>" }
```

`/rest/authenticate` berbeda lagi:
```jsonc
{ "redirectUri": "<url>" }     // 200
{ "error": "<kode_string>" }   // 403 / 412 / 429
```

### 6.2 Peta lengkap kondisi error

| Kondisi | Endpoint | HTTP | Kode | Pesan user |
|---|---|---|---|---|
| Password salah **atau** akun tidak ada | `/rest/authenticate` | `403` | `access_denied` | **"Incorrect email address and/or password. Try again or reset your password."** |
| Akun terkunci/nonaktif | `/rest/authenticate` | `403` | `blocked_user` | redirect `/login/inactive` |
| Password bocor | `/rest/authenticate` | `403` | `password_leaked` | "You must change your password to log in…" |
| Terlalu banyak percobaan | `/rest/authenticate` | `403` | `too_many_attempts` | memunculkan CAPTCHA |
| Terlalu banyak login | `/rest/authenticate` | `429` | `too_many_logins` | — |
| CAPTCHA ditolak | `/rest/captcha/verify` | — | `invalid_captcha` | "Are you sure you're not a robot?" |
| Skor CAPTCHA rendah | — | — | `captcha.score_too_low` | "We'd like to make sure it's really you…" |
| AWS WAF CAPTCHA perlu | `check-username`, `authenticate` | `405` | — | modal AWS WAF |
| **2FA diperlukan** | `/rest/authenticate` | **`412`** | `mfa_required` | redirect `/login/mfa` |
| IP tidak diizinkan | `/rest/authenticate` | `403` | `client_ip_not_allowed` | — |
| Rate limit identifier | `/rest/check-username` | `429` | — | `too_many_username_requests` |
| Akun ambigu | `/rest/authenticate` | `403` | `ambiguous_user` | "It seems that you have multiple accounts associated with this email…" |
| Login dengan username | `/rest/authenticate` | `403` | `username_is_not_email` | "You can no longer log in with a username. Use your primary email address {username} instead." |
| Alias bukan primer | `/rest/authenticate` | `403` | `email_is_not_primary` | "You can no longer log in with an email alias…" |
| SSO diblokir admin | — | — | `social.login.banned` | "Your admin has blocked third-party login…" |
| Rate limit verifikasi | `verify-email/otp` | — | `rate_limit_exceeded` | "…too many attempts to verify your account in the past hour…" |
| OTP kedaluwarsa | `verify-email/otp` | — | `expired_token` | "Token expired" |

### 6.3 User Enumeration — Temuan Keamanan Utama

| Surface | Bocor? | Bukti |
|---|---|---|
| Password salah vs akun tak ada | ❌ **Tidak** | keduanya `access_denied` → pesan identik |
| Permintaan recovery | ❌ **Tidak** | respons **byte-identik**: "We sent a recovery link to you at `<email>`" — **diverifikasi langsung** |
| **Pre-check `check-username`** | ✅ **YA** | akun tak ada → `action:"signup"` → UI pindah ke "Sign up to continue" — **diverifikasi langsung** |
| Signup email terpakai | ✅ **YA** | "It looks like you've already got an account…" |

> **Pelajaran:** pre-check endpoint adalah tempat enumerasi **paling sering bocor** karena sering dianggap "prefs flow", bukan security control.

---

## 7. Model Sesi, Cookie, dan Token

### 7.1 Dua pesawat terpisah

| | Web (`trello.com`) | API (`api.trello.com`) |
|---|---|---|
| Mekanisme | **cookie only** | **token only** |
| Key/token/header | XHR tidak mengirim `key`/`token`/`Authorization` | cookie **ditolak** (`400 invalid token`) |
| Bukti | `/1/members/me` via browser → `400 invalid token` (tanpa key) | `Cookie: trello_session=…; atl_token=…` → `400 invalid token` |

`trello.com/1/*` dan `api.trello.com/1/*` adalah **service yang sama**, dibedakan hanya plane host.

### 7.2 Cookie yang benar-benar ada

> ⚠️ **`trello_session`, `JSESSIONID`, `atl_token`, `_hjSessionUser_*` TIDAK PERNAH teramati.** Itu artefak Jira/Confluence/Data Center, bukan Trello.

| Cookie | Domain | HttpOnly | Secure | SameSite | Masa hidup |
|---|---|---|---|---|---|
| **`atl_session`** | `trello.com` | ⚠️ **false** | ⚠️ **false** | `Lax` | ~28 menit saat diamati |
| `atlUserHash` | `.trello.com` | false | false | `Lax` | ~400 hari |
| `dsc` | `trello.com` + `api.trello.com` | false | true | **`None`** | ~30 hari |
| `atl_xid.current` / `.ts` | `trello.com` | false | true | `Lax` | ~365 hari |
| `atl_xid.xc` | `.atlassian.com` | false | true | **`None`** | ~365 hari |
| `atlCohort` | `.trello.com` | false | false | `Lax` | ~400 hari |
| `atlassian.account.xsrf.token` | `id.atlassian.com` | ✅ **true** | true | `Lax` | **session** |
| `atlassian.account.ffs.id` | `id.atlassian.com` | false | true | `Lax` | ~365 hari |
| `aws-waf-token` | `.id.atlassian.com` | false | true | `Lax` | ~4 hari |

`dsc` di-refresh **setiap response** dengan nilai berbeda → ini device/session cookie, **bukan** session login. `SameSite=None` supaya bisa dibaca cross-site (kebutuhan iframe Power-Up).

> ⚠️ **`atl_session` tidak `HttpOnly` dan tidak `Secure`** pada sesi anonim. Tidak lazim untuk cookie pembawa kredensial. Kemungkinan ini token *device binding*, bukan bearer credential tunggal — tapi **UNVERIFIED**.

### 7.3 CSRF

**Bukti konkret** — `GET trello.com/auth/atlassian/callback`:
```
Set-Cookie: auth.csrf=s%3A<b64url>%3D.<b64url>; Path=/auth/callback; HttpOnly; Secure
```
Nilai `s:<value>.<HMAC>` = format **signed cookie** Express `csurf`. Nilainya **berbeda tiap request** (token di-refresh). Scoped ke jalur callback saja.

`/rest/login/state` mengirim pasangan `csrfToken` + `hashedCsrfToken` via **body** → pola *masked double-submit*.

> ⚠️ **Penegakan CSRF pada write cookie-authenticated: UNVERIFIED.** Yang teramati hanya penerbitan token.

### 7.4 API key vs token

| | API key | Token |
|---|---|---|
| Sifat | **identitas aplikasi** | **kredensial pengguna** |
| Publik? | ✅ **boleh publik** | ❌ **harus rahasia** |
| Regex | `^[0-9a-fA-F]{32}$` | — |

Kutipan resmi: *"It is ok for your API key to be publicly available, but a token should never be publicly available. If a token becomes public, it should be revoked immediately by the user."*

**Tiga cara mengirim kredensial** (dokumentasi): query param, `Authorization: OAuth …`, atau body PUT/POST.

**Precedence: header menang.** `?key=bad&token=bad` + header OAuth buruk → `400 invalid token` (bukan `401 invalid key`).

**Scope & expiry model lama** (`/1/authorize`):
| Parameter | Nilai |
|---|---|
| `scope` | `read`, `write`, `account` |
| `expiration` | `1hour`, `1day`, `30days`, `never` |
| `callback_method` | `postMessage`, `fragment` |

**Allowed origins** (anti-open-redirect): *"If the URL in the `return_url` parameter does not match one of your API key's allowed origins, **the redirect is blocked**."* Kalau tidak diset → **tidak ada** redirect yang bekerja.

**Rate limit (angka resmi, first-party):**
| Limit | Nilai |
|---|---|
| Per API key | **300 req / 10 detik** |
| Per token | **100 req / 10 detik** |
| `/1/members/` | **100 req / 900 detik** |
| 429 di API | `{"error":"API_TOKEN_LIMIT_EXCEEDED","message":"Rate limit exceeded"}` |

### 7.5 OAuth — provider vs consumer

**Trello sebagai Provider** (memberi akses ke data Trello) — tiga model coexist:
1. `/1/authorize` + Trello Auth token (**masih default**)
2. OAuth 1.0a basic (`/1/OAuthGetRequestToken` → `OAuthAuthorizeToken` → `OAuthGetAccessToken`)
3. **OAuth 2.0 3LO — baru, 15 Sep 2026** (`CHANGE-3427`), granular scopes, PKCE `S256`, access token **1 jam**, refresh token **90 hari & sekali pakai**

**Trello sebagai Consumer** (login pakai Google/Apple/dll.) — lewat `auth.atlassian.com` (Auth0):

| Provider | Client ID |
|---|---|
| Google | `596149463257-9oquqfivs9on8t8erq23c8qso6vk3cp1.apps.googleusercontent.com` |
| Microsoft | `8txT5SyXwjqIlAtmX3xJbhIyL4pDphh1` |
| Apple | `hSMIXZp9mqs6yhg1TY3WE1EsDGMtL9OQ` |
| Slack | `2z1gHggedTDLLYsYcquqcaJiReZUbVCB` |

> **Tidak ada tombol Facebook.** Terverifikasi via snapshot DOM.

### 7.6 Kontrak error API Trello (teramati langsung)

| Request | Status | Content-Type | Body |
|---|---|---|---|
| `GET /1/members/me` | **400** | `text/plain` | `invalid token` |
| `?key=<valid>` (tanpa token) | **401** | `text/plain` | `invalid key` |
| `?key=bad&token=bad` | **401** | `text/plain` | `invalid key` |
| `Authorization: OAuth …` buruk | **400** | `text/plain` | `invalid token` |
| `Cookie: …` | **400** | `text/plain` | `invalid token` |
| **`Authorization: Bearer …`** | **401** | ⚠️ **`text/html`** | halaman AtlassianEdge (`ext_authz_denied`) |
| `GET /1/boards/AbCdEfGh` | `404` | `text/plain` | `Board not found` |
| `GET /1/nonexistent-path` | `404` | `text/plain` | `Cannot GET /1/nonexistent-path` |
| `POST /1/boards` tanpa auth | `400` | `application/json` | `{"message":"invalid value for name","error":"ERROR"}` |

**⚠️ Pelanggaran yang paling mudah terlewat:**
```
GET /1/boards/<public>?fields=name              → 200
GET /1/boards/<public>?key=<32hex>&fields=name  → 401  invalid key   ← kredensial invalid MERUSAK akses publik
```
Kredensial invalid lebih merusak daripada tidak mengirim apa pun.

**⚠️ `Authorization: Bearer` membalas HTML**, bukan JSON → klien yang `JSON.parse` setiap response akan **crash**.

---

## 8. Mekanisme Keamanan

### 8.1 Rate limiting & lockout

Atlassian **tidak mempublikasikan angka ambangnya** (temuan negatif yang sah). Yang terdokumentasi:

> *"we'll lock your account after multiple failed login attempts in a short period of time. After you've made a number of login attempts, a **CAPTCHA** form will be displayed… If you're still unable to log in, your account will be **temporarily locked**…"*

**Lockout bersifat per-IP**, bukan hanya per-akun:
> *"The IP address associated with the login attempts has been locked out. You can continue to log in like normal from the devices that you normally use."*

### 8.2 Anti-bot — tiga lapis

| Lapis | Vendor | Trigger | Bukti |
|---|---|---|---|
| 1 | **reCAPTCHA Enterprise** | **selalu aktif** | request nyata `www.recaptcha.net/recaptcha/enterprise/clr?k=6Le9VxMn…`; badge disembunyikan via CSS `.grecaptcha-badge{visibility:hidden}` |
| 2 | **AWS WAF CAPTCHA** | setelah kegagalan | header+cookie `aws-waf-token` (466 char), respons `405`, endpoint `/rest/captcha/verify` |
| 3 | **Castle.io** | setiap request | `castlePublishableApiKey: pk_yqQBTzLjn7dMC52pBpyctrMqszVKo193`; token per-request dengan *capability* |

> **Catatan:** klaim "Atlassian memakai PerimeterX" **tidak terkonfirmasi**. Yang terbukti adalah **Castle.io** (device fingerprinting), AWS WAF, dan Google reCAPTCHA Enterprise.

### 8.3 2FA

Berlaku untuk **akun Trello** (akun Atlassian pribadi, bukan fitur org berbayar). Metode: authenticator app, SMS (hanya untuk metode pertama), security key (Yubikey). Recovery key **sekali pakai**. Endpoint: `/rest/mfa/authorize`, `/rest/mfa/verify`, `/rest/mfa/resend`.

**Efek ke API token:** *"that account won't be able to use a password for basic authentication against a REST API."*

### 8.4 Passkeys

Tersedia, tapi **hanya untuk non-managed account**: *"If your account is managed by an organization, you will not see the option to enable passkeys."*

### 8.5 Status akun

| Status | Dampak |
|---|---|
| Lockout | CAPTCHA → lockout sementara |
| Deactivated di **Workspace** Trello | **Masih bisa** akses konten non-workspace & board privat sendiri |
| Deactivated di **Atlassian account** | **Tidak bisa login sama sekali** ke Trello maupun produk Atlassian lain |
| **Dormant** | Tidak aktif **≥ 2 tahun** → Atlassian berhak hapus; email pemberitahuan dikirim **60 hari** sebelum penghapusan |
| SSO-only (SAML) | Tidak bisa pakai password |
| Government Cloud | Min password **12** |

### 8.6 "Remember me"

Checkbox ada, tapi **tidak mengirim apa pun di body** — hanya menambah `remember=true` ke query string. Kutipan resmi:
> *"When you select Remember me, you won't need to re-enter your email the next time you log in. **You still need to log in using an authentication method** such as password, two-step verification or single sign-on."*

> **Remember me ≠ skip login.** Ia hanya mengingat *email*. Ini lebih jujur secara keamanan daripada checkbox "keep me signed in".

### 8.7 Header keamanan

```
Strict-Transport-Security: max-age=63072000; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```
> **Catatan:** CSP yang *enforce* **kosong**; hanya `Report-Only` yang terisi. `Cross-Origin-Opener-Policy` tidak ada padahal `postMessage` adalah `callback_method` resmi.

---

## 9. Pola yang Layak Dipelajari

| # | Pelajaran | Detail |
|---|---|---|
| 1 | **Hapus identifier yang tidak perlu** | Tidak ada username = satu field unik, satu regex, satu reserved-word list, satu pesan error lebih sedikit |
| 2 | **Pre-check = prefs flow, bukan security control** | UX jauh lebih baik, tapi membocorkan keberadaan akun |
| 3 | **Anti-enumeration harus konsisten di SEMUA endpoint** | Atlassian rapi di `/authenticate` + recovery, bocor di `check-username` + "email already in use" |
| 4 | **CAPTCHA dengan trigger berbeda** | reCAPTCHA Enterprise selalu aktif (invisible), AWS WAF CAPTCHA setelah gagal |
| 5 | **Similarity check > composition check** | "Password = email/nama/keyword" lebih berguna daripada "harus 1 angka" |
| 6 | **Konfirmasi password itu opsional** | Nol field konfirmasi di 4 MB bundle; password manager jadi alasan yang valid |
| 7 | **Consent tanpa checkbox + guard di kode** | UX ringan, tapi server tetap merekam `privacyPolicyText` untuk bukti hukum |
| 8 | **JWT di URL untuk multi-step** | Stateless antar-step; Exposure dikontrol TTL pendek + scope sempit |
| 9 | **Password bocor = forced password change** | `password_leaked` (403) mengarahkan ke reset, bukan sekadar tolak login |
| 10 | **Verbosity tinggi di log, rendah di user** | Sentry breadcrumb terstruktur `capability-group--login`; UI tetap generik |
| 11 | **Pisahkan pesawat web dan API** | Cookie untuk browser, token untuk integrasi — jangan campur |
| 12 | **API key publik, token rahasia** | Pemisahan identitas aplikasi vs kredensial pengguna |

---

## 10. Analisis Gap terhadap Repo Ini

### 10.1 Perbandingan validasi

| Aturan | Trello (terverifikasi) | Implementasi repo (`src/event-auth/`) | Status |
|---|---|---|---|
| Identifier | email only | email only | ✅ sesuai |
| Email max length | tidak diketahui | **tidak ada** | ⚠️ perlu ditetapkan |
| Email normalisasi | tidak observable | **`===` case-sensitive, tanpa trim** (`users.service.ts:19`) | ❌ **BUG** |
| Name min/max | 1 / **255** | 2 / 100 | ⚠️ lebih ketat dari Trello |
| Name ≠ email | ✅ ada | ❌ **tidak ada** | ❌ kurang |
| Name ≠ password | ✅ ada (case-insens) | ❌ **tidak ada** | ❌ kurang |
| Password min | **8** | 8 | ✅ sesuai |
| Password max | **100** | **tidak ada** | ❌ perlu |
| Password composition | **tidak ada** (similarity) | tidak ada | ✅ konsisten |
| Password ≠ email | ✅ ada | ❌ **tidak ada** | ❌ kurang |
| Password breach | ✅ HIBP | ❌ tidak ada | ❌ kurang |
| Password history | ✅ ada | ❌ tidak ada | ❌ kurang |
| **Konfirmasi password** | ❌ **tidak ada** | ✅ **ada** | ⚠️ **deviasi** (repo lebih ketat) |
| Terms consent | deklaratif + guard | ❌ tidak ada | ❌ kurang |
| OTP verifikasi email | ✅ 6 digit, TTL 900s | ❌ tidak ada | ❌ kurang |

### 10.2 Perbandingan keamanan

| Aspek | Trello | Implementasi repo | Status |
|---|---|---|---|
| Hash password | bcrypt/argon (asumsi, UNVERIFIED) | ⚠️ **PLAINTEXT** (`event-auth.service.ts:40`) | ❌ **KRITIS** |
| Token | JWT RS256 ber-TTL | ⚠️ **string random di `Map`** (`jwt-auth.guard.ts:22`) | ❌ **KRITIS** |
| Token expiry | ada (30 hari idle / TTL) | ❌ **tidak ada** | ❌ |
| Refresh token | ada (OAuth 2.0: 90 hari) | ❌ tidak ada | ❌ |
| Rate limit login | ada (per-IP + per-akun) | ❌ **tidak ada** | ❌ |
| Lockout | ada (temporer) | ❌ tidak ada | ❌ |
| CAPTCHA | 3 lapis | ❌ tidak ada | ❌ |
| 2FA | Totp/SMS/SecurityKey | ❌ tidak ada | ❌ |
| CSRF | signed cookie + masked double-submit | ❌ tidak ada (Bearer, jadi tidak wajib) | ✅ OK |
| Anti-enumeration | inconsistent | ⚠️ `409 Email already registered` (`event-auth.service.ts:34`) | ❌ **bocor** |
| Token revocation | ✅ `DELETE /1/tokens` | ✅ `tokenStore.delete` | ✅ |
| Logout | konfirmasi + "all devices" | ✅ hapus 1 token | ⚠️ minimal |

### 10.3 Temuan Kode yang Perlu Diperbaiki

| # | File:line | Masalah | Dampak |
|---|---|---|---|
| 1 | `event-auth.service.ts:40` | password disimpan plaintext | **Kritis** — kebocoran DB = semua akun |
| 2 | `event-auth.service.ts:15-21` | token = `Math.random()`, bukan JWT | **Kritis** — diprediksi, tidak punya signature |
| 3 | `jwt-auth.guard.ts:22` | token store in-memory `Map` |_token hilang saat restart, tidak multi-instance |
| 4 | `users.service.ts:19` | `findByEmail` pakai `===` | `A@B.com` ≠ `a@b.com` → akun duplikat |
| 5 | `event-auth.service.ts:34` | `409` bocorkan keberadaan email | user enumeration |
| 6 | `dto/login.dto.ts:13` | `@MinLength(8)` di password saat login | user dengan password lama **terkunci permanen** |
| 7 | `event-auth.service.ts:59` | `user.password !== dto.password` | timing leak + plaintext compare |
| 8 | `dto/register.dto.ts:23,29` | password tak di-trim, tak ada max length | `" abcdefgh "` lolos |
| 9 | `main.ts:14-20` | tidak ada `helmet`, tidak ada CORS config | header keamanan default |
| 10 | `src/auth/` vs `src/event-auth/` | dua folder auth, hanya yang kedua wired | dead code |

### 10.4 Rekomendasi Prioritas

**P0 — wajib sebelum demo/production:**
1. Hash password (`bcrypt` atau `argon2`). `@nestjs/jwt` sudah terpasang — tinggal pakai.
2. Ganti `Map` dengan JWT sungguhan + expiry + `refresh token`.
3. Normalisasi email: `trim().toLowerCase()` di **saat input dan saat lookup**.
4. Hapus `@MinLength(8)` dari `LoginDto`.
5. Ubah `409` → `200` generik atau pesan netral (anti-enumeration).

**P1 — nilai jual akademik:**
6. Password max length 100 + similarity check (≠ email, ≠ name).
7. Rate limiting via `@nestjs/throttler`.
8. Email verification OTP (TTL 900s, mengiru Atlassian).
9. Password reset dengan respons netral.

**P2 — 확장:**
10. Refresh token + rotation.
11. 2FA (TOTP).
12. OAuth 2.0 3LO dengan PKCE.

---

## 11. Daftar Hal yang TIDAK Bisa Diverifikasi

> Jangan isi kekosongan ini dengan angka karangan.

1. **Batas panjang maksimum email** — tidak ada `maxlength`, tidak ada kode error.
2. **Normalisasi email (lowercase) di sisi server** — client `trim()`, server tidak teramati.
3. **Apakah password di-trim server-side.**
4. **bcrypt 72-byte truncation** — tidak ada bukti first-party. String "8 to 72 characters" milik code path lain.
5. **Apakah aturan komposisi password aktif di signup Trello gratis.**
6. **Nama & atribut cookie sesi setelah login berhasil** — butuh kredensial.
7. **Ambang angka rate-limit / lockout** — Atlassian tidak mempublikasikannya.
8. **Isi blacklist domain email** — kemungkinan besar konsekuensi MX lookup, bukan daftar statis.
9. **Apakah akun bisa dipakai sebelum verifikasi email selesai.**
10. **Destinasi final setelah login** (`/b/{shortlink}` vs board terakhir).
11. **Perilaku forced-logout setelah reset password.**
12. **Precedence header vs query param dengan kredensial VALID** (hanya tidak valid yang teramati).
13. **Apakah `atl_session` adalah bearer credential** atau device binding.
14. **Bentuk response 403 & 429 yang dipicu langsung.**
15. **Mengapa `Error parsing body` muncul sekali lalu hilang** (edge-dependent, tidak direproduksi).

---

## 12. Sumber Utama

**Bundle & halaman produk**
- `id.atlassian.com/login?application=trello` · `/signup` · `/login/resetpassword` · `/logout`
- `id-frontend.prod-east.frontend.public.atl-paas.net/assets/index.04faf71f.js` (4.130.775 byte)
- `trello.com/auth/atlassian/callback` · `trello.com/ensureSession`
- `api.trello.com/1/*` · `dac-static.atlassian.com/cloud/trello/swagger.v3.json`

**Dokumentasi developer**
- `developer.atlassian.com/cloud/trello/guides/rest-api/authorization/`
- `developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/`
- `developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-confidential-client-usage/`
- `developer.atlassian.com/cloud/trello/changelog/` (`CHANGE-3427`)
- `auth.atlassian.com/.well-known/openid-configuration`

**Dokumentasi support**
- `support.atlassian.com/atlassian-account/docs/log-in-to-your-atlassian-account`
- `support.atlassian.com/atlassian-account/docs/login-issues-related-to-a-locked-atlassian-account`
- `support.atlassian.com/atlassian-account/docs/verify-your-identity`
- `support.atlassian.com/security-and-access-policies/docs/update-idle-session-duration`
- `support.atlassian.com/trello/docs/dormant-trello-account-policy`

**Detail lengkap & 46 URL sumber**: lihat kedua laporan di `docs/research/`.
