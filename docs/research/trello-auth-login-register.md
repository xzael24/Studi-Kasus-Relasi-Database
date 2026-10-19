# Riset Primer: Alur Login & Registrasi Trello.com (Atlassian ID)

**Tanggal riset:** 5 Oktober 2026
**Objek:** `trello.com/login`, `trello.com/signup`, dan seluruh UI auth yang disajikan oleh **Atlassian ID** (`id.atlassian.com`)
**Metode:** inspeksi HTTP header, unduhan & pembacaan bundle JS produksi, dan pengujian langsung di browser (Playwright) pada form sungguhan.

> **Peringatan metodologi.** Halaman auth Trello **bukan server-rendered form** — ia adalah sebuah React SPA yang HTML-nya kosong dan seluruh form dibangun saat runtime. Jadi *semua* atribut HTML dan semua string error di bawah diambil dari dua sumber: (1) DOM yang benar-benar di-render di browser, dan (2) bundle JS produksi `index.04faf71f.js` (4,13 MB) milik `id-frontend.prod-east.frontend.public.atl-paas.net`.

---

## Ringkasan Eksekutif

- **Trello tidak punya sistem login sendiri.** `https://trello.com/login` dan `https://trello.com/signup` **tidak lagi melayani form apa pun** — keduanya langsung **302 redirect** ke `id.atlassian.com` dengan parameter `application=trello` (login) dan `application=trello--direct-signup` (signup). Verifikasi: `Invoke-WebRequest` mengikuti redirect dan mencatat `FINAL: https://id.atlassian.com/login?application=trello&continue=...`.
- **Asumsi "username" dalam brief ini sudah usang.** Login Trello modern meminta **email saja**. Field DOM-nya adalah `<input type="email" name="username" required autocomplete="username">` — label UI-nya persis **"Email"**, dan form memvalidasi dengan regex `/.+@.+/`. Identitas internal disebut `username`, tapi **nilainya adalah alamat email**. Bundle bahkan memuat pesan error yang secara eksplisit melarang login pakai username: `"You can no longer log in with a username. Use your primary email address {username} instead."`
- **Login Trello adalah dua langkah (multi-step), bukan satu form.** Langkah 1 hanya meminta email dan tombolnya bernama **"Continue"**. Email itu dikirim ke `POST /rest/check-username`, dan server memutuskan lewat field `action` apa yang terjadi (`no_action` → tampilkan password; `redirect` → lempar ke IdP SSO; `signup` → arahkan ke registrasi; `social_login`; `ic_redirect`; `not_permitted`; `continue_required`). Password baru dikirim di langkah 2 ke `POST /rest/authenticate`.
- **Password minimum adalah 8 karakter, bukan 8–72 seperti textbooks.** Kode produksi: `getMinimumPasswordLength = () => isFedM() ? 12 : 8` — 12 hanya untuk lingkungan FedRAMP. Unggahan 100 karakter adalah batas *hard* (`"Password length capped at 100 characters"`), bukan 72. **Tidak ada bukti first-party soal bcrypt 72-byte truncation.**
- **Tidak ada field "konfirmasi password" sama sekali.** Saya menelusuri seluruh 573 pesan i18n unik di bundle: tidak ada satu pun string confirm-password. Ini berbeda dari kebanyakan tutorial.
- **Ada dua CAPTCHA yang berlapis, plus satu vendor bot-detection.** (1) **reCAPTCHA Enterprise** — terbukti request `POST https://www.recaptcha.net/recaptcha/enterprise/clr?k=6Le9VxMnAAAAALKRlj8jmKwUYmFTZWcF0y4o9QeD` saat halaman login dimuat, dengan badge sengaja disembunyikan lewat CSS `.grecaptcha-badge{visibility:hidden}`; (2) **AWS WAF CAPTCHA** — header `aws-waf-token` + cookie `aws-waf-token` (466 karakter) + endpoint `POST /rest/captcha/verify`; (3) **Castle.io** — `castlePublishableApiKey: "pk_yqQBTzLjn7dMC52pBpyctrMqszVKo193"` dan token `castleToken` dikirim di body request.
- **Anti-enumeration dipakai, tapi bocor di satu tempat.** Password salah **dan** email tidak dikenal **keduanya** dipetakan ke kode yang sama `access_denied` → `invalid_user_password` → pesan identik *"Incorrect email address and/or password."* Namun **endpoint `check-username` justru membocorkan keberadaan akun**: untuk email yang tidak terdaftar server membalas `action: "signup"` dan UI langsung berpindah ke halaman "Sign up to continue". Saya mengonfirmasinya secara langsung.
- **Signup juga multi-step, dan urutannya email → OTP → baru nama+password.** `POST /rest/signup` dengan email yang valid langsung mengarahkan ke `/signup/verify-email/otp?token=<JWT>`, **bukan** ke form nama/password.
- **Token verifikasi email adalah JWT RS256 dengan TTL tepat 15 menit.** Saya decode token itu dari URL: `exp - nbf = 900` detik. Isinya juga membocorkan hal menarik: `recaptchaScore: "1.0"` disimpan di dalam token.
- **Server memblokir domain email tertentu — `example.com` ditolak.** Saya uji langsung: pesan server *"The provided email address is not allowed, please use a different one"* (`signup.email.restricted.domain.error`). Tapi TLD `.test` diterima, jadi blacklist-nya spesifik per-domain, bukan per-TLD.
- **Consent di signup berupa kalimat deklaratif, bukan checkbox.** Persis: *"By signing up, I accept the Atlassian Cloud Terms of Service and acknowledge the Privacy Policy."* Tidak ada `input[type=checkbox]` di halaman signup.
- **Tombol SSO yang benar-benar ada: Google, Microsoft, Apple, Slack, dan Passkey.** **Tidak ada Facebook.** Saya verifikasi langsung lewat snapshot DOM. Semua social login dilewatkan lewat Auth0 (`auth0Config.domain = "auth.atlassian.com"`).

---

## Metodologi & Keterbatasan

### Yang bisa saya verifikasi langsung

| Metode | Apa yang diameter |
|---|---|
| `Invoke-WebRequest` dengan mengikuti redirect | Rantai redirect `trello.com/login` → `id.atlassian.com/login?application=trello&continue=...`; header `x-amzn-waf-action: challenge`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block` |
| Unduh + grep bundle JS (4,13 MB, 573 pesan i18n unik) | Seluruh string validation, regex, konstanta, dan kontrak endpoint |
| Playwright — snapshot DOM | Struktur form, urutan field, label, tombol |
| Playwright — `browser_evaluate` | Atribut HTML langsung, `document.cookie`, dan **atribut cookie lengkap** (`httpOnly`/`secure`/`sameSite`/`expires`) |
| Playwright — submit form sungguhan | String error yang benar-benar dirender untuk input kosong & input invalid |
| Playwright — hook `window.fetch` | Body request + body response API (`/rest/login/state`, `POST /rest/signup`) |
| Decode JWT | Header & payload token verifikasi email, TTL |

### Yang **tidak** bisa saya verifikasi (reasons)

1. **Saya tidak pernah menyelesaikan login atau signup yang berhasil.** Saya tidak memiliki kredensial, dan menyelesaikan signup akan mengirim email. **Catatan metodologi:** saya memakai hanya alamat di domain reservasi (`.test`) dan domain yang tidak ada sama sekali. **Konsekuensi:** aturan sisi-server yang hanya muncul *setelah* OTP terverifikasi (mis. komposisi password, minimalitas, apakah akun bisa dipakai sebelum verifikasi) **tidak observable**.
2. **Saya membuat 2 permintaan signup yang menggantung** (`@invalid-domain-xyz.test` dan `@mailinator-xyz-nonexistent.com`). Keduanya **tidak pernah diverifikasi**, jadi **tidak ada akun yang benar-benar dibuat** dan tidak ada email yang sampai ke pihak mana pun. Verified by inspection: halaman OTP hanya menampilkan kode, tidak ada POST `/rest/signup/welcome`.
3. **Cookie sesi pasca-login di `id.atlassian.com` tidak observable.** Semua cookie yang saya lihat berasal dari pengunjung anonim. Saya **tidak tahu** nama maupun atribut cookie sesi setelah login berhasil. Saya menandainya "Not observable", bukan menebak.
4. **Aturan yang hanya menolak server tidak bisa saya buktikan tanpa akun.** Saya tidak tahu apakah `example.com` masuk blacklist Statis atau hanya gagal MX — kemungkinan besar yang kedua. Saya tidak mengklaim apa pun soal isi daftar domain.
5. **Ambang rate-limit tidak dipublikasikan Atlassian.** Saya mencari di dokumentasi resmi dan tidak menemukan angka. Saya tidak akan mengarangnya.
6. **`?intent=` dan `?modal=` ternyata bukan parameter nyata.** Saya grep seluruh bundle: `intent` muncul **1 kali**, `modal` 41 kali — semuanya untuk UI modal internal, bukan query param auth. Saya mencari `modal=` dan tidak menemukan. Ini negatif yang valuable.
7. **Halaman Trello sendiri (`trello.com/guide/...`) gagal dimuat** — blocked oleh firewall lingkungan. Jadi halaman support Trello tidak bisa saya verifikasi.
8. **Duplikasi dalam bundle.** Setiap pesan i18n muncul **dua kali** (build `type=module` + fallback `nomodule`). Saya dedup secara manual; angka "573 unik" sudah setelah dedup.

---

## URL Topology

| URL | Fungsi | Perilaku redirect (terverifikasi) |
|---|---|---|
| `https://trello.com/login` | Legacy entry point | **302** → `https://id.atlassian.com/login?application=trello&continue=https%3A%2F%2Ftrello.com%2Fauth%2Fatlassian%2Fcallback%3FreturnUrl%3D%26aaOnboarding%3D%26updateEmail%3D%26traceId%3D%26ssoVerified%3D%26createMember%3D%26jiraInviteLink%3D` |
| `https://trello.com/signup` | Legacy entry point | **302** → `https://id.atlassian.com/signup?application=trello--direct-signup&continue=...%26createMember%3Dtrue%26jiraInviteLink%3D` |
| `https://id.atlassian.com/login` | **Host yang benar-benar memiliki form login** | Melayani SPA shell. `<title>Log in to continue - Log in with Atlassian account</title>` |
| `https://id.atlassian.com/signup` | Host yang memiliki form signup | Melayani SPA shell. `<title>Sign up - Log in with Atlassian account</title>` |
| `https://id.atlassian.com/login/resetpassword` | Lupa password | Judul halaman: **"Can't log in?"** → "We'll send a recovery link to" → tombol **"Send recovery link"** |
| `https://id.atlassian.com/login/mfa` | 2FA/MFA (dari `412 mfa_required`) | Dicapai dengan `?transactionToken=<token>` |
| `https://id.atlassian.com/login/inactive` | Akun nonaktif/ditolak | `?application=<app>` bila ada |
| `https://id.atlassian.com/login/select-account` | Ganti akun | Link dari halaman logout |
| `https://id.atlassian.com/signup/verify-email/otp` | Verifikasi email signup | `?application=trello&token=<JWT>` — token TTL 900s |
| `https://id.atlassian.com/signup/welcome` | Nama tampilan + password | Diperoleh setelah OTP terverifikasi |
| `https://id.atlassian.com/logout` | Logout | Menampilkan form konfirmasi, **tidak** logout otomatis |
| `https://id.atlassian.com/authn` | — | Mengembalikan SPA shell yang sama; **tidak ada route auth khusus** |
| `https://id.atlassian.com/authorize` | — | SPA shell yang sama; tidak ada perilaku OAuth yang teramati |
| `https://trello.com/auth/atlassian/callback` | **Callback OAuth/OIDC milik Trello** | Target dari parameter `continue`; consume `returnUrl`, `createMember`, `ssoVerified` |
| `https://api.trello.com/1/...` | REST API Trello | Auth terpisah: `key` + `token` |
| `https://www.trellostatus.com/` | Status Trello | **Host terpisah** dari `status.atlassian.com` |

### Parameter query yang benar-benar diparse aplikasi

Dari operasi `delete("...")` pada query string di seluruh bundle, hanya segitulah yang nyata:

`email` · `errorCode` · `token` · `transactionToken` · `login_hint` · `index`

Plus `continue` (dari redirect Trello), `application`, `remember`, `disableEmailInput`, `nativeHandoff`, dan `redirect_uri` (dari respons `check-username`).

> **`returnUrl` hanya muncul 1 kali di seluruh bundle** — di seed `continue`. Artinya Trello memang mengirimkannya, tapi itu parameter milik Trello yang dibaca di sisi Trello, bukan oleh Atlassian ID.

### Siapa memiliki apa

| Aspek | Pemilik |
|---|---|
| HTML form login/signup | `id.atlassian.com` (SPA dari `id-frontend.prod-east.frontend.public.atl-paas.net`) |
| Validasi client-side | `id.atlassian.com` |
| Sesi auth | `id.atlassian.com` (cookie `atlassian.account.xsrf.token` = **HttpOnly**) |
| Sesi aplikasi Trello | `trello.com` (cookie `atl_session`, **non-HttpOnly**) |
| Cookie API | `api.trello.com` (cookie `dsc`) |

---

## Alur Login

**Langkah 1 — Muat halaman**

1. `GET /login?application=trello&continue=<trello callback>` pada `id.atlassian.com`. Server mengirim SPA shell yang memuat `<script type="module" src=".../index.04faf71f.js">`.
2. Halaman berjalan: **heading "Log in to continue"**, satu field berlabel **`Email*`**, checkbox **"Remember me"**, tombol **"Continue"**.
3. Form HTML: `<form id="form-login" data-testid="form-login" **novalidate**>` — perhatikan `novalidate` ada, sehingga validasi HTML5 **dimatikan** meskipun `required` tetap menempel pada input.
4. Input: `type="email" name="username" autocomplete="username" required placeholder="Enter your email"` — **tanpa** `minlength`, **tanpa** `maxlength`, **tanpa** `pattern`.

**Langkah 2 — Pre-check identitas (`check-username`)**

5. Klik "Continue" → validasi client-side:

```js
let t = r.trim(),          // input di-trim
    n = "" === t,          // kosong setelah trim
    o = !t.match(/.+@.+/); // HARUS ada karakter sebelum & sesudah '@'
```

6. Lulus → `POST /rest/check-username?{query}`:

```jsonc
{
  "username": "<email>",          // ← nama field "username", isi email
  "recoveryToken": null,
  "challenge-response": null,
  "destinationOrgId": null
}
```
Header: `Content-Type: application/json`, **`X-CSRF-TOKEN`**, plus header AWS WAF bila feature gate aktif. Body **tidak** memakai `credentials:"same-origin"` eksplisit (same-origin default).

7. Server membalas JSON dengan field `action`:

| `action` | Arti | Efek UI |
|---|---|---|
| `no_action` | Existence normal | Tampilkan field password (`isSecondStep = true`) |
| `redirect` | Wajib SSO | Ikuti `redirect_uri` + `redirect_type` ke IdP |
| `ic_redirect` | Isolated Cloud redirect | Ikuti `redirect_uri` |
| `signup` | **Email tidak terdaftar** | **Alihkan ke halaman signup** |
| `social_login` | Hanya social | Tampilkan tombol provider (`identities`) |
| `continue_required` | Perlu Spectra lanjut | `POST /rest/v2/check-username/continue` |
| `not_permitted` | Ditolak | Tampilkan `error_code` |

Respons juga membawa `passwordless` (`allowed`/`disallowed`) dan `social` (`allowed`/`blocked`).

8. **Status error `check-username`:** `429` → `too_many_username_requests`; `400` → parse `{uiErrors:[{key}]}` dan pakai `uiErrors[0].key`; selain itu → `JSON.parse(body).formErrors[0]`.

**Langkah 3 — Password**

9. Field password muncul: `<input type="password" name="password" id="password" autocomplete="current-password" spellcheck="false" placeholder="Enter password">` — **tanpa `maxlength`**.
10. Tombol yang tersedia pada DOM login (terverifikasi langsung, hanya yang benar-benar ada):
    - `login-submit` — submit password
    - `passwordless-button` — **magic link** ("Log in with email")
    - `passkey-auth-button` — "Passkey"
    - `google-auth-button`, `microsoft-...`, `apple-...`, `slack-...`
11. Submit → (bila `captchaValue` ada) `POST /rest/captcha/verify` dengan body `{"g-recaptcha-response": "<token>", "email": "<email>"}`.
12. Lalu `POST /rest/authenticate?{query}`:

```jsonc
{
  "username": "<email>",      // tetap "username"
  "password": "<password>",
  "state": {
    "csrfToken": "...",
    "anonymousId": "...",
    "userFlow": "...",        // dimensi analitik
    "marketingConsent": { "consent": true, "locale": "en-US",
                          "marketingConsentText": "general consent captured",
                          "privacyPolicyText": "..." }
  },
  "token": "<Castle request token>"   // atau string literal "dummy-token"
}
```
`credentials: "same-origin"`. **Tidak ada header `X-CSRF-TOKEN` pada endpoint ini** — proteksi CSRF-nya datang dari Castle token + SameSite cookie, bukan header CSRF.

13. **Kontrak respons `/rest/authenticate`:**

| Status | Body | Arti |
|---|---|---|
| `200` | `{redirectUri}` | Sukses → navigasi ke `redirectUri` |
| `403` | `{error}` | `access_denied` · `blocked_user` · `password_leaked` · `too_many_attempts` · `client_ip_not_allowed` · `client_ip_missing` |
| `405` | — | CAPTCHA dibutuhkan (AWS WAF) |
| `412` | `{error:"mfa_required", token}` | Redirect ke `/login/mfa?…&transactionToken=…` |
| `429` | `{error:"too_many_logins"}` | Terlalu banyak percobaan login |
| lain | — | `unexpected_error` |

> `error_description` (bila ada) dienkode **base64 JSON** dan di-decode di sisi klien: `JSON.parse(atob(e.error_description))`.

**Langkah 4 — Sukses**

14. `POST /rest/session` dengan `{X-CSRF-TOKEN}` dan `credentials:"same-origin"`; server balas `{redirectUrl, formErrors}`. Client meng-parse `redirectUrl` dan menavigasi ke sana.
15. **Destinasi yang dapat saya buktikan:** redirect Trello mengirim `continue=https://trello.com/auth/atlassian/callback?returnUrl=&aaOnboarding=&updateEmail=&traceId=&ssoVerified=&createMember=&jiraInviteLink=` untuk login, dan `returnUrl=%2F&createMember=true` untuk signup.
    - **Signup** → `trello.com/` dengan `createMember=true` (server membuat record member Trello).
    - **Login** → `returnUrl` kosong, sehingga default Trello berlaku.
    - **Destinasi final `/b/{shortlink}` atau board terakhir: TIDAK TERBUKTI.** Saya tidak bisa melihat login berhasil. Jangan klaim ini.

---

## Alur Registrasi

**Langkah 1 — Email (`POST /rest/signup`)**

1. `GET /signup?application=trello` → halaman **"Sign up to continue"**, satu field `Email`, teks consent, tombol **"Sign up"**.
2. `<form id="form-sign-up">` — **tidak** punya `novalidate`, dan input **tidak** punya atribut `required`.
3. Input: `type="email" name="email" autocomplete="username" placeholder="Enter your email"` — tanpa `minlength`/`maxlength`/`pattern`.
4. Consent **bukan checkbox**, melainkan paragraf:
   > "By signing up, I accept the Atlassian [Cloud Terms of Service], and acknowledge the [Privacy Policy]."
5. Submit → `POST /rest/signup?{query}`, `credentials: "same-origin"`, **tanpa** header CSRF:

```jsonc
{
  "challenge-response": { "challenge-kind": "...", "token": {"value":"..."}, "type": "..." },
  "email": "<email>",
  "productHint": null,
  "display": null,          // diisi hanya untuk native handoff
  "castleToken": "<Castle request token>",
  "nativeHandoffSignupToken": "..."   // opsional
}
```

6. **Respons:** `{fieldErrors, uiErrors: [{key}], redirectTo}`. `redirectTo` menang atas `fieldErrors`.
7. **Validasi yang saya-trigger langsung:**

| Input | Sumber | Pesan renders |
|---|---|---|
| kosong | client | **"Please enter an email address"** |
| `not-an-email` | client | **"Please enter an email address"** |
| `a@b` | client | **"Please enter a valid email address"** |
| `…@example.com` | **server** | **"The provided email address is not allowed, please use a different one"** |
| `…@invalid-domain-xyz.test` | server | Lolos → redirect ke OTP |

   Saat error server tampil, Atlassian menambah `aria-invalid="true"` dan `aria-describedby="email-_r0_-error"` ke input.

**Langkah 2 — Verifikasi email OTP**

8. Redirect ke `/signup/verify-email/otp?application=trello&token=<JWT>`.
9. Teks UI: **"We've emailed you a code"** / **"To complete your account setup, enter the code we've sent to:"** → field **"Verification code"** → tombol **"Verify"** → **"Didn't receive an email? Resend email"**.
10. Field OTP = **6 kotak terpisah**, masing-masing `<input type="text" maxlength="1" autocomplete="off" aria-label="Please enter OTP character N" data-testid="otp-input-index-N">`.
11. Submit kosong → **"Complete the verification code"** (terverifikasi langsung).

**Isi token JWT (terverifikasi — saya decode dari URL):**

```jsonc
// header
{ "kid": "micros/aid-account/ailevpgpap8185n0", "alg": "RS256" }
// payload
{
  "sub": "<email>",
  "aud": "link-signature-validator",
  "iss": "micros/aid-account",
  "scope": "verifyEmailOtp",
  "redirectType": "signup",
  "nbf": 1791189196,
  "exp": 1791190096,          // exp - nbf = 900 detik = 15 menit
  "iat": 1791189196,
  "userId": "712020:ebf4acc2-99da-4bf2-abe4-5d830669ffde",
  "recaptchaScore": "1.0",    // skor reCAPTCHA ikut ditanam di dalam token
  "jti": "26cae6a5-4d1b-40e3-b3ab-3b8304f8200c",
  "mfaToken": "<1051 karakter>"
}
```

**Langkah 3 — Nama tampilan + password (`POST /rest/signup/welcome`)**

12. Halaman "welcome" menanyakan **`displayName` ("Full name")** + **`password`**. Email tidak diinput ulang — sudah terikat di token.
13. Validasi client-side (`onWelcomeInputValidate`) — kode asli:

```js
let o = getMinimumPasswordLength();          // 8, atau 12 di FedRAMP
// 1. displayName kosong setelah trim:
if (displayName !== undefined && "" === displayName.trim())
    err.displayName = "Please enter a name";
// 2. password:
if (password !== undefined)
    if ("" === password.trim())          err.password = "Please enter a password";
    else if (password.length < o)        err.password = "Password must have at least {minimumPasswordLength} characters";
// 3. nama = email:
if (emailRegex.test(displayName.trim()))
    err.emailUsedAsName = "Please ensure your full name is not an email address";
// 4. nama = password (case-insensitive):
if (displayName.toLowerCase().trim() === password.toLowerCase().trim())
    err.passwordUsedAsName = "Please ensure your full name is not your password";
```

> Perhatikan bug-like-but-harmless: nomor 4 menaruh error di key `passwordUsedAsName`, tapi renderer memetakannya ke field password.

14. `POST /rest/signup/welcome?{query}` dengan header **`X-CSRF-TOKEN`** (berbeda dari `/rest/signup`!):

```jsonc
{
  "challenge-response": {...},
  "displayName": "<full name>",
  "password": "<password>",
  "token": "<token dari URL>",
  "display": null,
  "castleToken": "<Castle request token>",
  "marketingConsent": { "consent": true, "locale": "en-US", ... }
}
```

15. **Respons:** `{fieldErrors, uiErrors:[{key}], redirectTo}` — identik dengan langkah 1.
16. **Guard internal yang menarik:** sebelum submit, kode menolak jalan bila `privacyPolicyText` atau marketing consent belum dimuat:
   `console.error("Form cannot be submitted without showing Privacy Policy")`.

**Langkah 4 — Onboarding**

17. Setelah `redirectTo`, Trello dipanggil dengan `createMember=true` dan `aaOnboarding=` (parameter kosong). Ini **indikasi kuat** ada wizard onboarding setelah akun dibuat.
    - **Tidak ada prompt workspace/team invite di flow Atlassian ID.** Saya tidak menemukan field invite di form mana pun.
    - **Apakah akun bisa dipakai sebelum verifikasi email: TIDAK TERBUKTI.** Saya tidak menyelesaikan OTP.

---

## Aturan Validasi

> Kolom "Client-side?" = ada validasi JS di `id.atlassian.com`. Kolom "Server-side?" = ada error dari API. `—` berarti **tidak ditemukan**.

### Login — Langkah 1 (identifier)

| Field | Rule | Min | Max | Pattern | Client-side? | Server-side? | Exact error message | Sumber |
|---|---|---|---|---|---|---|---|---|
| Email (`name="username"`) | Wajib; di-`trim()`; harus ada isi sebelum & sesudah `@` | 1 | **—** | `/.+@.+/` (JS) | ✅ | ✅ | kosong → `Enter an email address` · tak cocok → `Email address must contain text before and after an '@' symbol` | DOM live + bundle `login.form.email.empty` / `login.form.email.invalid` |
| Email | Normalisasi lower-case | — | — | — | ❌ | **—** | **Tidak observable** | — |
| Email | Batas panjang | — | **—** | — | ❌ | ❌ | **Tidak observable** (input tidak punya `maxlength`) | Atribut DOM live |
| Email | Domain disposable/diblokir | — | — | — | ❌ | ❌ | Tidak ada kode error spesifik untuk login | — |
| Remember me | Opsional, tidak divalidasi | — | — | — | — | — | — | `<input type="checkbox" name="remember">` |

### Login — Langkah 2 (password)

| Field | Rule | Min | Max | Pattern | Client-side? | Server-side? | Exact error message | Sumber |
|---|---|---|---|---|---|---|---|---|
| Password | Wajib | 1 | — | — | ✅ | ✅ | `Enter your password` (`login.form.password.empty`) | Bundle `login.form.password.empty` |
| Password | Terlalu pendek | — | — | — | — | ✅ | `The password is too short.` (`login.form.password.too.short`) | Bundle |
| Password | Terlalu panjang | — | **100** | — | — | ✅ | `Password length capped at 100 characters` (`login.form.password.too.long`) | Bundle |
| Password | Tidak ada komposisi (huruf besar/kecil/digit/simbol) | — | — | — | ❌ | ❌ **untuk login** | — (string ada tapi hanya untuk `welcome.`/`changePassword.`) | Bundle |
| Password | Tidak di-trim (client) | — | — | — | ❌ | **—** | — | Kode: password dikirim apa adanya |
| Password | bcrypt 72-byte truncation | — | — | — | — | **—** | **Tidak ada bukti first-party** | — |
| Password confirmation | **Field tidak ada** | — | — | — | — | — | **N/A** | Grep 573 pesan i18n: nihil |
| Strength meter | zxcvbn, 5 level | — | — | — | ✅ | ❌ | `Weak`/`Fair`/`Good`/`Strong`/`Very strong` | Bundle `password.strength.level.1..5` |

### Registrasi

| Field | Rule | Min | Max | Pattern | Client-side? | Server-side? | Exact error message | Sumber |
|---|---|---|---|---|---|---|---|---|
| Email — format | Kosong / domain tanpa TLD ditolak | 1 | **—** | `emailRegex = /([a-z0-9._%\-+!#$&/=?^|~ ]+)@([a-z0-9 -]+\.)+ *[a-z]+/` (**tanpa flag `i`** — case-sensitive!) | ✅ | ✅ | `Please enter an email address` · `Please enter a valid email address` · `Email is required to be in correct format` | DOM live + bundle `7SSik` + `signup.email.format.error` |
| Email — domain diblokir | `example.com` ditolak | — | — | — | ❌ | ✅ | `The provided email address is not allowed, please use a different one` (`signup.email.restricted.domain.error` / `signup.email.bans.not.allowed`) | **Uji langsung** |
| Email — sudah dipakai | Deteksi duplikat | — | — | — | ❌ | ✅ | `It looks like you've already got an account associated with this email. Log in instead or reset your password if you've forgotten it` | Bundle `login.form.info.existing.user.signup.attempt` |
| Email — alias | Dibatasi | — | — | — | ❌ | ✅ | `Email aliases are rate limited` | Bundle `signup.email.reached.max.aliases` |
| Email — MAX length | **—** | — | **—** | — | ❌ | ❌ | **Tidak observable** | — |
| **Full name** (`displayName`) | Wajib; tidak boleh berbentuk email; tidak boleh sama dengan password | 1 | **255** | — | ✅ | ✅ | kosong → `Please enter a name` / `Full name must not be empty` · >255 → `Full name must not be greater than 255 characters` · email → `Please ensure your full name is not an email address` · =password → `Please ensure your full name is not your password` | Bundle `signup.display.name.too.long`, `welcome.error.*` |
| Full name | Karakter diizinkan | — | — | **—** | ❌ | ❌ | **Tidak observable** | — |
| Full name | Bisa diedit setelah signup | — | — | — | — | — | **Tidak diverifikasi**; ada doc "Manage your personal profile" | — |
| **Password** | Wajib; minimal 8 (12 di FedRAMP); maks 100 | **8** | **100** | — | ✅ | ✅ | `Please enter a password` · `Password must have at least {minimumPasswordLength} characters` | Bundle `getMinimumPasswordLength()` |
| Password | Tidak boleh = email | — | — | — | ✅ | ✅ | `Your password can't match your email address.` | Bundle |
| Password | Tidak boleh = display name | — | — | — | ✅ | ✅ | `Your password can't match your display name.` | Bundle |
| Password | Tidak boleh = keyword Atlassian | — | — | — | ✅ | ✅ | `Your password can't match an Atlassian keyword.` | Bundle |
| Password | Deteksi breach (HIBP) | — | — | — | ✅ | ✅ | `This password has appeared in an external data breach. To continue, enter another password.` | Bundle `signup.form.password.leaked.xml` |
| Password | Deteksi password umum | — | — | — | ✅ | ✅ | `This password is too widely used. Choose a password that's harder to guess.` | Bundle |
| Password | Riwayat password | — | — | — | ❌ | ✅ | `You've used that password before. Please choose a different one.` | Bundle `passwordUsedBefore` |
| Password | Komposisi (case/digit/special) | — | — | — | ❌ | ✅ *(hanya di `welcome.`/`changePassword.`)* | `Your password must contain at least one uppercase and one lowercase letter.` · `Your password must contain at least one digit or special character.` · `Your password must be between 8 and 72 characters long.` | Bundle — ** tapi tidak terverifikasi aktif di path Trello gratis** |
| Password | Show/hide toggle | — | — | — | ✅ | — | `Show password` / `Hide password` | Bundle `password.field.password.*` |
| Password | Diblank di-trim saat cek kosong | — | — | — | ✅ | — | `Please enter a password` (spasi saja lolos ke cek panjang) | Kode `"" === n.trim()` |
| **Consent/TOS** | **Tidak ada checkbox**; consent deklaratif, wajib ditampilkan sebelum submit | — | — | — | ✅ (guard) | — | `Form cannot be submitted without showing Privacy Policy` (error log internal, bukan pesan UI) | Kode `onWelcomeSubmit` |
| **Username** | **Field tidak ada sama sekali** | — | — | — | — | — | `Your account username must be a valid email address.` | Bundle `welcome.error.usernameMustBeEmail` |
| **Reserved username** | **N/A** — tidak ada username. Tapi keyword ini diblokir sebagai **password**: `["atlassian","bitbucket","confluence","jira","opsgenie","statuspage","trello"]` | — | — | — | ✅ | — | `Your password can't match an Atlassian keyword.` | Bundle modul `9ZCrw` |
| OTP code | 6 digit, 6 kotak | 6 | 6 | — | ✅ | ✅ | `Complete the verification code` · `Provided verification code is invalid` · `Token expired` · `Rate limit exceeded. Try again in a couple of minutes.` | DOM live + bundle |

### Detail penting tentang normalisasi & reserved words

- **`emailRegex` tidak punya flag `i`.** `new RegExp(/([a-z0-9._%\-+!#$&/=?^|~ ]+)@([a-z0-9 -]+\.)+ *[a-z]+/)` — ini **hanya cocok untuk huruf kecil**, dan secara teknis mengizinkan **spasi** di dalam alamat. Ini bug-level longgaran; regex ini hanya dipakai untuk mendeteksi "nama = email", bukan validasi utama.
- **Blokir "reserved word" Trello yang klasik sudah tidak relevan.** Konsep `admin`/`trello`/`atlassian`/`api`/`support`/`help` sebagai username tidak ada karena tidak ada username. Yang tersisa: daftar 7 keyword Atlassian di atas, dan hanya sebagai **larangan password**.
- **Case-insensitivity username: N/A.** Tapi perbandingan nama-vs-password dilakukan **case-insensitive** (`toLowerCase()` di kedua sisi).

---

## Format Error & Kode Status

### Bentuk envelope

Ada **tiga** bentuk envelope berbeda yang dipakai Atlassian ID, dan frontend harus menangani ketiganya:

```jsonc
// A. field-level errors (VALIDASI per-field)
{ "fieldErrors": { "<fieldName>": "<pesan>" } }

// B. UI-level errors (kode, diterjemahkan ke teks)
{ "uiErrors": [ { "key": "<kode>" } ] }

// C. success with redirect
{ "redirectTo": "<url absolut>" }
```

Untuk `/rest/authenticate` bentuknya **berbeda lagi**:

```jsonc
{ "redirectUri": "<url>" }                 // 200 sukses
{ "error": "<kode_string>" }               // 403 / 429 / 412
```

Struktur `fieldErrors` pada login: `login.fieldErrors.{email, password}`; pada signup/welcome: `welcome.fieldErrors.{displayName, password, emailUsedAsName, passwordUsedAsName}`.

### Peta kode error server → pesan (`useTranslateFormErrorIfAvailable`)

Ini adalah **kamus lengkap** dari bundle produksi — key server → teks yang dirender:

| Kode server | Pesan yang dirender |
|---|---|
| `com.atlassian.profile.unknownError` | An unknown error occurred |
| `error.required` | This field is required |
| `login.form.no.password` | Enter your password |
| `login.form.password.too.long` | Password length capped at 100 characters |
| `login.form.password.too.short` | The password is too short. |
| `resetPassword.error` | An error occurred while attempting to reset your password. |
| `requestPasswordReset.email.format.error` | Please enter a valid email address |
| `signup.display.name.empty` | Full name must not be empty |
| `signup.display.name.too.long` | Full name must not be greater than 255 characters |
| `signup.email.format.error` | Email is required to be in correct format |
| `signup.email.reached.max.aliases` | Email aliases are rate limited |
| `signup.email.restricted.domain.error` | The provided email address is not allowed, please use a different one |
| `signup.email.bans.not.allowed` | The provided email address is not allowed, please use a different one |
| `signup.failure` | We are unable to sign you up. Please contact support. |
| `signup.captcha.response.required.error` | **Are you sure you're not a robot?** |

### Tabel lengkap kondisi error

| Kondisi | Endpoint | HTTP | Kode | Pesan user |
|---|---|---|---|---|
| Password salah **atau** akun tidak ada | `/rest/authenticate` | `403` | `access_denied` → client `invalid_user_password` | **Incorrect email address and/or password. Try again or reset your password.** |
| …varian Trello | `/rest/authenticate` | `403` | `access_denied` | **Incorrect email address and / or password. If you recently migrated your Trello account to an Atlassian account, you will need to use your Atlassian account password. Alternatively, you can get help logging in.** |
| Akun terkunci / nonaktif | `/rest/authenticate` | `403` | `blocked_user` | Redirect ke `/login/inactive` (bukan pesan) |
| Password bocor (breach) | `/rest/authenticate` | `403` | `password_leaked` | **You must change your password to log in. Your current password has appeared in an external data breach and your Atlassian account is at risk.** |
| Terlalu banyak percobaan | `/rest/authenticate` | `403` | `too_many_attempts` | Memunculkan CAPTCHA (`isCaptchaRequired = true`) |
| Terlalu banyak login | `/rest/authenticate` | `429` | `too_many_logins` | `too_many_logins` |
| CAPTCHA ditolak | `/rest/captcha/verify` | — | `invalid_captcha` | `Are you sure you're not a robot?` |
| Skor CAPTCHA rendah | — | — | `captcha.score_too_low` | **We'd like to make sure it's really you. Please confirm you're not a robot.** |
| CAPTCHA AWS WAF perlu | `/rest/check-username`, `/rest/authenticate` | `405` | — | Modal AWS WAF CAPTCHA; setelah N× gagal → `aws_captcha_failure_limit` |
| 2FA diperlukan | `/rest/authenticate` | **`412`** | `mfa_required` + `token` | Redirect ke `/login/mfa?transactionToken=…` |
| IP tidak diizinkan | `/rest/authenticate` | `403` | `client_ip_not_allowed` | `client_ip_not_allowed` |
| IP tidak terkirim | `/rest/authenticate` | `403` | `client_ip_missing` | `client_ip_missing` |
| Rate limit identifier | `/rest/check-username` | `429` | — | `too_many_username_requests` |
| Verifikasi identitas | `/rest/check-username` | `400` | `uiErrors[0].key` | Pesan dari kamus di atas |
| Gagal parse respons | `/rest/check-username` | non-2xx | — | `formErrors[0]` |
| Akun ambigu (ganda) | `/rest/authenticate` | `403` | `ambiguous_user` | **It seems that you have multiple accounts associated with your email. Please contact your administrator to remove the duplicate.** |
| User remote tanpa email | `/rest/authenticate` | `403` | `no_email_on_remote_user` | **Your {username} user doesn't have an associated email address, so we can't create your Atlassian account. Please contact support.** |
| Username bukan email | `/rest/authenticate` | `403` | `username_is_not_email` | **You must use your email address to log in. Did you mean to use {username}?** |
| Alias, bukan email primer | `/rest/authenticate` | `403` | `email_is_not_primary` | **You can no longer log in with an email alias. Use your primary email address {username} instead.** |
| Login dengan username | `/rest/authenticate` | `403` | `username_is_not_email` | **You can no longer log in with a username. Use your primary email address {username} instead.** |
| SSO diblokir admin | — | — | `social.login.banned` | **Your admin has blocked third-party login. Log in with your email address instead.** |
| Token sesi invalid | `/rest/authenticate` | `403` | `invalid.session.token` | `invalid.session.token` |
| Error tidak dikenal | semua | — | `unknown` / `unexpected_error` | **Something went wrong. Please try again.** |
| Rate limit verifikasi email | `/rest/signup/verify-email/otp` | — | `rate_limit_exceeded` | **There have been too many attempts to verify your account in the past hour. Please try again after an hour.** |
| OTP kedaluwarsa | `/rest/signup/verify-email/otp` | — | `expired_token` | **Token expired** |
| OTP salah | `/rest/signup/verify-email/otp` | — | `invalid_otp` | **Provided verification code is invalid** |
| OTP kurang panjang | — | — | `otp_length` | **Complete the verification code** |
| Token verifikasi rusak | `/signup/verify-email/otp` | — | `invalid_token` | **Something went wrong while trying to validate your email. Try again from a verification email in your inbox.** |

### Apakah terjadi user enumeration?

** Sebagian, dan tidak konsisten. Ini temuan keamanan yang layak dicatat.**

| Surface | Bocor? | Bukti |
|---|---|---|
| Password salah vs akun tak ada | ❌ **Tidak** | Keduanya `access_denied` → pesan identik |
| **Pre-check `check-username`** | ✅ **Ya** | Akun tak ada → `action:"signup"` → UI pindah ke "Sign up to continue". **Diverifikasi langsung.** |
| Permintaan recovery | ❌ **Tidak** | Respons **byte-identical**: *"We sent a recovery link to you at `<email>`"* untuk akun ada maupun tidak. **Diverifikasi langsung.** |
| Signup dengan email terpakai | ✅ **Ya** | `It looks like you've already got an account associated with this email…` |

Jadi: **CORS-style anti-enumeration diterapkan pada endpoint kredensial dan recovery, tetapi TIDAK pada endpoint pre-check.** Kalau kamu membangun auth sendiri, remember: pre-check endpoint adalah tempat enumerasi paling sering bocor.

---

## Mekanisme Keamanan

### Rate limiting / brute-force protection

Atlassian **tidak mempublikasikan angka ambangnya** — ini temuan negatif yang sah, bukan kelalaian riset. Yang terdokumentasi:

- *"we have a security measure in place that will lock your account after multiple, consecutive failed login attempts."* — [support.atlassian.com/atlassian-cloud/kb/im-locked-out-of-my-atlassian-account](https://support.atlassian.com/atlassian-cloud/kb/im-locked-out-of-my-atlassian-account)
- *"After you've made a number of login attempts, a CAPTCHA form will be displayed… If you're still unable to log in, your account will be temporarily locked and you'll need to wait a few minutes."* — [login-issues-related-to-a-locked-atlassian-account](https://support.atlassian.com/atlassian-account/docs/login-issues-related-to-a-locked-atlassian-account)
- **Lockout bersifat per-IP, bukan hanya per-akun:** *"The IP address associated with the login attempts has been locked out. You can continue to log in like normal from the devices that you normally use."*

Yang bisa saya baca dari kode (angka pasti):

| Mekanisme | Nilai | Sumber |
|---|---|---|
| `login.nextAttempt` | mulai dari `1` | State Redux default |
| `login.isCaptchaRequired` | `false` | State Redux default |
| Verifikasi email | *"too many attempts … in the past hour"* | `welcome.rate-limit-exceeded.error.main-action` |
| Verifikasi ulang email | *"There have been too many attempts to reverify your account in the past hour. Please try again later."* | `login.form.email.rate-limit-exceeded.error` |

### CAPTCHA / bot detection — tiga lapis

| Lapis | Vendor | Bukti first-party |
|---|---|---|
| 1 | **reCAPTCHA Enterprise** | Request nyata `POST https://www.recaptcha.net/recaptcha/enterprise/clr?k=6Le9VxMnAAAAALKRlj8jmKwUYmFTZWcF0y4o9QeD` saat halaman login dimuat. `<textarea name="g-recaptcha-response" id="g-recaptcha-response-100000">` ter-inject. Badge **disembunyikan** via CSS `.grecaptcha-badge{visibility:hidden}`. Kunci dari `/rest/login/state`: `recaptchaEnterpriseCheckboxKeySite`, `…InvisibleKeySite`, `…ScoreKeySite`. `recaptchaEnable: true`. |
| 2 | **AWS WAF CAPTCHA** | Feature gate `AidFrontendFeatureGate.ENABLE_AWS_WAF_CAPTCHA`; header `aws-waf-token`; header WAF dari `getAwsCaptchaWafHeaders()`; cookie `aws-waf-token` (466 char); respons `405` → `captcha_required`; error `aws_captcha_failure_limit`. Endpoint verifikasi: `POST /rest/captcha/verify` body `{"g-recaptcha-response","email"}`. |
| 3 | **Castle.io** (device fingerprinting) | `<link rel="preconnect" href="https://t.castle.io">` di HTML. `castlePublishableApiKey: "pk_yqQBTzLjn7dMC52pBpyctrMqszVKo193"` dari `/rest/login/state`. Token dikirim per-request: `getCastleRequestToken(["capability-group--login","capability-name--login-with-username-password"])` dan `["…signup","…signup"]`. |

> **Temuan:** statement "Atlassian memakai PerimeterX" **tidak saya konfirmasi**. Yang terbukti adalah **Castle.io** (bukan PerimeterX) + AWS WAF + Google reCAPTCHA Enterprise. Castle adalah vendor device-fingerprinting / risk-detection — Castle.io sering disebut "PerimeterX-style" karena tujuannya serupa, tapi itu produk berbeda. Saya tidak akan menyebut PerimeterX.

Bukti tambahan dari `<head>`: `<preconnect>` ke `accounts.google.com`, `api.segment.io`, `fonts.gstatic.com`, `sentry.io`, `t.castle.io`, `www.gstatic.com`, `www.recaptcha.net`.

### 2FA (Two-Step Verification)

**Berlaku untuk akun Trello.** Ini akun Atlassian pribadi, bukan fitur org berbayar. Bukti: dokumen resmi berada di [support.atlassian.com/atlassian-account/docs/manage-two-step-verification-for-your-atlassian-account](https://support.atlassian.com/atlassian-account/docs/manage-two-step-verification-for-your-atlassian-account), dan URL-nya ada di bawah `/atlassian-account/` (bukan `/atlassian-cloud-administration/`).

- **Enrollment:** `https://id.atlassian.com/manage-profile/security` → *Manage two-step verification* → masukkan password → pilih metode.
- **Metode yang didukung** (terverifikasi dari kode Enum `Totp` · `Sms` · `SecurityKey`):
  - Authenticator app (Google Authenticator, Authy, Duo)
  - SMS — *"only available if you're setting up your first two-step verification method"*
  - Security key (Yubikey)
- **Recovery:** emergency recovery key, **sekali pakai** (*"you can only use a recovery key once"*).
- **Enforcement:** hanya jika organisasi mengaktifkan. *"If your organization requires you to have two-step verification enabled, and you disable it on your account, you won't be able to log in to enable it again."*
- **Interaksi dengan API token:** *"that account won't be able to use a password for basic authentication against a REST API."*

Kode yang relevan:

- `412 mfa_required` → `/login/mfa?transactionToken=…`
- `POST /rest/mfa/authorize` · `POST /rest/mfa/verify?transactionToken=` · `POST /rest/mfa/resend?transactionToken=` · `POST /rest/mfa/verify/recoverycode`
- `POST /v2/mfa/promote` (promosi metode), `POST /2step/recover`
- `useSocialLogin` punya `mfaPromote.message`: *"To keep your account secure, two-step verification adds another step when logging in with your username and password."*
- **Passkey** juga tersedia: `POST /v2/passkey/challenge`, `POST /v2/passkey/verify`. Docs: *"Passkey authentication is only available for non-managed accounts."*

### SSO / Identity provider di layar login

**Tombol yang benar-benar ada (verifikasi langsung via snapshot DOM):**

| Provider | Di login? | Di signup? | ID tombol |
|---|---|---|---|
| **Google** | ✅ | ✅ | `google-auth-button` |
| **Microsoft** | ✅ | ✅ | — |
| **Apple** | ✅ | ✅ | — |
| **Slack** | ✅ | ✅ | — |
| **Passkey** | ✅ ("Or login with:") | ❌ | `passkey-auth-button` |
| **Facebook** | ❌ **TIDAK ADA** | ❌ | — |
| **SAML/OIDC (SAML org)** | ✅ via `check-username` → `action:"redirect"` | ❌ | — |

Label UI literal yang ter-render: **"Or login with:"** (Passkey) lalu **"Or continue with:"** (Google/Microsoft/Apple/Slack). Link **"Can't log in?"** dan **"Create an account"**.

Semua social login dimediasi **Auth0**: `auth0Config.domain = "auth.atlassian.com"`, dengan OAuth clientId per-provider (Apple `hSMIXZp9mqs6yhg1TY3WE1EsDGMtL9OQ`, Microsoft `8txT5SyXwjqIlAtmX3xJbhIyL4pDphh1`, Slack `2z1gHggedTDLLYsYcquqcaJiReZUbVCB`). Login Google One Tap juga aktif (`useGoogleOneTap`).

Dokumentasi SAML: *"If your admin enforces SAML single sign-on, you may not be able to log in with a third-party account."*

### Sesi & cookie

**Hardening header di `id.atlassian.com`** (dari respons HTTP):

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
x-amzn-waf-action: challenge        ← AWS WAF aktif di edge
Server: CloudFront
```

**Atribut cookie — diambil langsung dari browser context (`httpOnly`/`secure`/`sameSite`/`expires`):**

| Cookie | Domain | HttpOnly | Secure | SameSite | Expires |
|---|---|---|---|---|---|
| `atlassian.account.xsrf.token` | `id.atlassian.com` | ✅ **true** | ✅ true | Lax | session (`-1`) |
| `Bifrost-Atl-Ctx-Cloud-Service-Provider` | `id.atlassian.com` | false | ⚠️ **false** | Lax | session |
| `atlassian.account.ffs.id` | `id.atlassian.com` | false | true | Lax | ~1 tahun |
| `aws-waf-token` | `.id.atlassian.com` | false | true | Lax | ~4 hari |
| `g_state` | `id.atlassian.com` | false | ⚠️ false | Lax | ~6 bulan |
| `ajs_anonymous_id` | `.atlassian.com` | false | true | Lax | ~1 tahun |
| `__cuid` | `.atlassian.com` + `.id.atlassian.com` | false | ⚠️ false | Lax | ~1 tahun |
| **`atl_session`** | `trello.com` | ⚠️ **false** | ⚠️ **false** | Lax | **~30 menit** |
| `atlUserHash` | `.trello.com` | ⚠️ false | ⚠️ false | Lax | ~1 tahun |
| `dsc` | `trello.com` + `api.trello.com` | false | true | ⚠️ **None** | ~30 hari |
| `atl_xid.current` / `atl_xid.ts` / `atl_xid.xc` | `trello.com` / `.atlassian.com` | false | true | None | ~1 tahun |

> **`atl_session` di trello.com ternyata `HttpOnly=false` dan `Secure=false`.** Ini cookie yang terbaca JavaScript. **Namun:** ini cookie untuk pengunjung **anonim** (belum login). Perilaku pasca-login **tidak saya amati** dan bisa berbeda. Saya laporkan apa adanya, tanpa generalisasi.

**Nama & atribut cookie sesi auth pasca-login: TIDAK OBSERVABLE** (butuh kredensial).

**Durasi sesi (dari dokumentasi resmi):**

- **Default idle session duration = 30 hari** (Atlassian Cloud), **24 jam** (Atlassian Government Cloud) — [update-idle-session-duration](https://support.atlassian.com/security-and-access-policies/docs/update-idle-session-duration)
- Hanya berlaku untuk **managed accounts** (butuh domain terverifikasi).
- Untuk external users: **15 menit – 30 hari**.
- Ada **session expiration** terpisah (batas absolut, bukan idle).
- Cookie `atl_session` yang saya amati di trello.com berumur **~30 menit** — kemungkinan idle timeout aplikasi, **berbeda** dari idle timeout Atlassian ID. Saya tidak bisa memastikan hubungannya.
- Verifikasi identitas (identity verification): session valid **7 hari**, kode 6 digit valid **30 menit** — [verify-your-identity](https://support.atlassian.com/atlassian-account/docs/verify-your-identity)

### "Remember me" / trusted device

Checkbox `Remember me` ada di halaman login, dengan ikon info (*"More info about Remember Me."*).

**Mekanisme (terbaca dari kode):** tidak mengirim apa pun di body. Saat dicentang, `remember=true` **ditambahkan ke query string** `POST /rest/authenticate?…&remember=true` (dan `POST /rest/login/passwordless?…&remember=true`). Endpoint `/rest/remember/remove` ada untuk menghapus state.

**Perilaku — kutipan resmi:** *"When you select Remember me, you won't need to re-enter your email the next time you log in. You still need to log in using an authentication method such as password, two-step verification or single sign-on."*

Jadi: **Remember me bukan "skip login".** Ia hanya mengingat *email*-nya.

State Redux menyimpan `rememberedAccounts` dan `rememberedAccountsResponseCodes`, dengan kode `[...]=["userNotFound","userIsManaged","alreadyRequested"]`.

### Account recovery

**Topologi:**

1. `/login?application=trello` → link **"Can't log in?"** → `/login/resetpassword?application=trello`
2. Halaman: judul **"Can't log in?"**, teks **"We'll send a recovery link to"**, input email (`name="email"`, `placeholder="Enter email"`), tombol **"Send recovery link"**
3. Respons sukses (teks literal): **"We sent a recovery link to you at `<email>`"** + "If you haven't received the email, check your spam folder or sign up" + tombol **"Resend recovery link"**

**Apakah respons membocorkan keberadaan akun? TIDAK.** Saya uji dengan akun yang pasti ada vs. yang pasti tidak ada; teks respons **identik persis**. Ini implementasi anti-enumeration yang benar.

Ada juga pesan rate-limit dari sisi recovery:

- `You have already requested account recovery instructions. **If the account exists**, these instructions will be sent to your email address.`
- `We've sent too many emails, please try again later.`

> Perhatikan frasa *"If the account exists"* — Atlassian secara eksplisit dirancang untuk tidak membocorkan.

**Token & email:**

- Subject: **"Reset your Atlassian password"**
- Pengirim: `noreply+XXXXXXXXX@id.atlassian.com`
- Untuk verifikasi email (bukan reset): subject **"Verify your email for Atlassian …"**, pengirim `noreply+XXXXXXXXX@am.atlassian.com`
- **TTL token verifikasi yang saya ukur langsung: 900 detik (15 menit)** dari JWT `signup/verify-email/otp`
- **TTL reset password: tidak observable** (butuh email nyata)

**Post-reset forced logout:** **Tidak diverifikasi.** Pesan yang ada mengisyaratkan session-wide invalidation, tapi saya tidak punya bukti langsung. Pesan yang relevan ada: `To prevent unauthorized access to your account, your password has been invalidated.`

### Logout

- `https://id.atlassian.com/logout` → menampilkan **halaman konfirmasi**, Judul **"Log out of your Atlassian account"**, `<form data-testid="logout-form">`, tombol `logout-submit` ("Log out"). **Tidak** logout otomatis.
- **Mendukung post-logout redirect**: `doLogout` mem-POST ke `/logout?{params}&continue=<url>` — parameter `login_hint` dan `prompt` dihapus dari query sebelum dikirim.
- **Single session vs semua session** — keduanya didukung. Dua pesan berbeda:
  - `logout.confirm` → **"Log out"** (satu session)
  - `logout.confirm.multiple` → **"Log out of all accounts"** (semua session)
- Payload: `{csrfToken: hashedCsrfToken}` (menggunakan `hashedCsrfToken`, bukan `csrfToken` biasa).
- Pesan terkait: `To continue with this account, log out and sign in again.` (`logout.error.logout_required`) — untuk kasus punya beberapa akun.

### Atlassian ID sebagai platform

**Definisi resmi:** *"Your Atlassian account is your online Atlassian identity that exists independently of the Atlassian apps you use… You don't need separate accounts for each app."*

**Konsep kunci:**

| Konsep | Deskripsi | Sumber |
|---|---|---|
| **Managed account** | Admin org punya kontrol penuh; bisa mengubah detail, mewajibkan keamanan, menghapus akun | what-is-an-atlassian-account |
| **Verifikasi domain** | Setelah domain diverifikasi, **semua akun** dengan email domain itu jadi managed — inilah yang mengaktifkan SAML, 2FA enforcement, idle timeout | update-idle-session-duration |
| **SSO-only account** | Akun yang login-nya hanya lewat IdP; tidak bisa pakai password. Error: `Your admin has blocked third-party login…` | login docs |
| **Atlassian Government Cloud** | Lingkungan terpisah; SSO wajib; `id.atlassian-us-gov-mod.com`; min password **12** (`isFedM()`) | login docs + kode |
| **Trello = "cobranding"** | `cobranding: {application: "trello"}` dari `/rest/login/state` — Trello memakai UI auth Atlassian dengan identitas visual sendiri | respons API live |

**API token / OAuth untuk REST API Trello — ini dua dunia yang benar-benar terpisah:**

| Mekanisme | Endpoint / cara | Catatan |
|---|---|---|
| **API key + token** | `https://trello.com/1/authorize?expiration=…&scope=…&response_type=token&key=<APIKey>` | Token expiry: `1hour` \| `1day` \| `30days` \| `never`. Scope default read, bisa `read,write` |
| **Request API** | `https://api.trello.com/1/...` dengan `key=` + `token=` di query, atau `Authorization: OAuth oauth_consumer_key="...", oauth_token="..."`, atau di body PUT/POST | **API key bersifat publik**; token harus rahasia |
| **OAuth 1.0a** | `/1/OAuthGetRequestToken`, `/1/OAuthAuthorizeToken`, `/1/OAuthGetAccessToken` | Perlu application secret |
| **SCIM** | `Authorization: Bearer <token>`, token dari `https://trello.com/enterprise/[name]/token` | Enterprise admin only |
| **Forge** | OAuth 2.0 dengan scopes granular (`read:board:trello`, dll.) | Tidak bisa akses endpoint yang "Forge and OAuth2 apps cannot access" |

**Perbedaan fundamental dari session browser:**

1. Session browser = **cookie** di domain Trello/Atlassian, punya idle timeout, bisa di-invalidasi dari sisi server.
2. API token = **string portable**, tidak punya idle timeout, tidak bisa di-revoke per-sesi, dan **tidak bisa dipakai basic auth kalau 2FA aktif**.
3. *"API tokens grant access to the user's data, they should be kept secret."*
4. Token API Atlassian (untuk Jira/Confluence, bukan Trello) punya expiry **1–365 hari**, dan perlu verifikasi identitas (OTP email) sebelum bisa dibuat.

---

## Perbandingan dengan Pola Umum

Kalau kamu sedang membangun auth sendiri, ini bagian yang paling transferable:

**1. Trello tidak punya username sama sekali.**
Konsep "@username" di Trello yang lama sudah mati. Identifier = email. Ini keputusan arsitektural yang bagus: menghapus satu field mengurangi satu field unik, satu regex, satu aturan reserved-word, dan satu pesan error. Hati-hati: Atlassian **tetap** men-*call* field-nya `username` di wire format (`{"username": "a@b.com"}`), jadi saat membaca kode mereka you'll see nama yang menyesatkan.

**2. Pre-check endpoint = prefs-flow schema, bukan security control.**
`POST /rest/check-username` yang dipanggil sebelum password dikirim memberi UI yang jauh lebih baik (bisa menampilkan SSO vs password vs signup tanpa menebak), tapi sekaligus **membocorkan keberadaan akun**. Ini trade-off yang sangat umum dan sering tidak disadari. Kalau kamu menirunya, harus sadari konsekuensinya.

**3. Anti-enumeration harus konsisten di semua endpoint.**
Atlassian religiously memakai pesan generik di `/rest/authenticate` dan di recovery — lalu bocor di `check-username` dan di "email already in use". Konsistensi sekeras ini sangat sering gagal di titik ketiga.

**4. CAPTCHA itu ditampilkan, bukan selalu di tempat.**
Saya menemukan `g-recaptcha-response` ter-inject di halaman login **sebelum** ada kegagalan. Jadi reCAPTCHA invisible/Enterprise di sini berjalan *selalu*, sementara AWS WAF CAPTCHA + `too_many_attempts` hanya setelah kegagalan. Dua lapisan dengan trigger berbeda.

**5. Password policy nyata: min 8, maks 100, plus *similarity* check.**
Yang paling menarik: password ditolak kalau **sama persis** dengan email, display name, atau salah satu dari 7 keyword Atlassian. Itu lebih berguna daripada sekadar "harus 8 karakter + 1 angka". Pelajaran: **cek similaritas lebih besar dampaknya daripada komposisi karakter.**

**6. Password confirmation field adalah optional — dan Atlassian memilih tidak pakai.**
Nol field konfirmasi di 4 MB bundle. Kalau kamu setuju password bisa di-paste dari password manager (hal yang sangat mungkin terjadi), konfirmasi hanya menambah gesekan tanpa menambah keamanan. Ini kontra-intuitif tapi masuk akal.

**7. Password meter pakai zxcvbn dengan level Atlassian sendiri.**
Raw zxcvbn (0–4) dipetakan +1 jadi 5 level: Weak/Fair/Good/Strong/Very strong. Dan `if (password.length < min || [email, name, ...keywords].includes(password)) return 0` — jadi password yang "sama" selalu dapat skor 0 apa pun strukturnya.

**8. Consent tanpa checkbox + guard di kode.**
Signup Trello tidak punya checkbox TOS, hanya kalimat deklaratif. Dan ada guard JS: `if (!privacyPolicyText) return console.error("Form cannot be submitted without showing Privacy Policy")` — jadi server tetap merekam teks persetujuan yang dirender (`marketingConsent.privacyPolicyText`) untuk bukti hukum. Ini pola yang rapi: UX-nya ringan, tapi jejak auditnya lengkap.

**9. JWT di URL untuk multi-step, bukan session server.**
Email → OTP → nama/password, dihubungkan oleh **signed RS256 JWT in the query string**, `exp - nbf = 900`. Token membawa `scope`, `userId`, `recaptchaScore`. Gunanya jelas: step berikutnya stateless, tidak perlu lookup server. **Tapi hati-hati:** menaruh JWT di URL berarti ia bisa bocor via `Referer`, log server, dan browser history. Atlassian tetap uncompromis dengan expiration pendek dan hanya Passcode scope.

**10. Remember me ≠ skip login.**
Ia hanya mengingat email. Ini, honestly, lebih jujur secara keamanan daripada checkbox "Keep me signed in" yang membuat orang mengira itu melewati 2FA.

**11. "Password bocor" diperlakukan sebagai *forced password change*, bukan sekadar tolak login.**
`password_leaked` (403) memaksa user ganti password sebelum bisa masuk, dan mengarahkan ke `/login/resetpassword`. Ini lebih baik daripada hanya menolak login, karena user punya jalan keluar yang jelas.

**12. Error log sangat detail tapi aman untuk user.**
Breadcrumb Sentry seperti `"check_username"` / `"Password login failed"` + `capability-group--login` + `capability-subgroup--username-password-login` + `capability-name--login-with-username-password`. Error reporting-nya terstruktur capability, sementara UI tetap generik. Pola yang bagus: **verbosity tinggi di log, verbosity rendah di user.**

---

## Daftar URL Sumber

### Halaman produk (diperiksa langsung)

1. `https://trello.com/login` → **302** ke `id.atlassian.com/login?application=trello&continue=https://trello.com/auth/atlassian/callback?returnUrl=&aaOnboarding=&updateEmail=&traceId=&ssoVerified=&createMember=&jiraInviteLink=`
2. `https://trello.com/signup` → **302** ke `id.atlassian.com/signup?application=trello--direct-signup&continue=…&createMember=true`
3. `https://id.atlassian.com/authn` → SPA shell yang sama; **tidak** ada route auth khusus
4. `https://id.atlassian.com/authorize` → SPA shell yang sama
5. `https://id.atlassian.com/login?application=trello` → **form login sungguhan**; DOM, atribut, dan error diverifikasi
6. `https://id.atlassian.com/signup?application=trello` → **form signup sungguhan**; DOM & error diverifikasi
7. `https://id.atlassian.com/login/resetpassword?application=trello` → "Can't log in?" / "Send recovery link"
8. `https://id.atlassian.com/logout` → form konfirmasi "Log out of your Atlassian account"
9. `https://id.atlassian.com/signup/verify-email/otp?application=trello&token=<JWT>` → OTP 6 digit; **JWT di-decode**
10. `https://trello.com/` → Next.js SSR; cookie `atl_session`, `atlUserHash`, `dsc`
11. `https://www.trellostatus.com/` → status page Trello (terpisah dari Atlassian)

### Bundle JS produksi

12. `https://id-frontend.prod-east.frontend.public.atl-paas.net/assets/index.04faf71f.js` (4.130.775 byte) → **sumber utama**: 573 pesan i18n unik, semua regex, konstanta, kontrak endpoint
13. `https://id-frontend.prod-east.frontend.public.atl-paas.net/assets/index.41bb4597.js` (4.134.120 byte) → fallback `nomodule` (duplikat)
14. `https://id-frontend.prod-east.frontend.public.atl-paas.net/assets/index.19f82625.css` → mengonfirmasi `.grecaptcha-badge{visibility:hidden}`

### Endpoint API yang teramati

15. `GET /rest/login/state?application=trello&email=…` → 200; membocorkan `csrfToken`, `hashedCsrfToken`, `castlePublishableApiKey`, kunci reCAPTCHA, `auth0Config`, `loginHint`
16. `POST /rest/check-username` → kontrak pre-check; `action` enum
17. `POST /rest/authenticate` → kontrak login utama; status 200/403/405/412/429
18. `POST /rest/signup` → kontrak signup langkah 1
19. `POST https://www.recaptcha.net/recaptcha/enterprise/clr?k=6Le9VxMnAAAAALKRlj8jmKwUYmFTZWcF0y4o9QeD` → **request reCAPTCHA Enterprise nyata**
20. `POST /rest/session` → `{redirectUrl, formErrors}`
21. `/rest/captcha/verify`, `/rest/login/passwordless`, `/rest/signup/welcome`, `/rest/signup/verify-email/otp`, `/rest/logout/state`, `/rest/login/mfa/state`, `/rest/remember/remove`

### Dokumentasi resmi Atlassian

22. [Log in to your Atlassian account](https://support.atlassian.com/atlassian-account/docs/log-in-to-your-atlassian-account) → *"Remember me"* hanya mengingat email; Government Cloud butuh SAML
23. [Create an Atlassian account](https://support.atlassian.com/atlassian-account/docs/create-an-atlassian-account) → *"We'll email you asking that you verify your email address"*
24. [What is an Atlassian account?](https://support.atlassian.com/atlassian-account/docs/what-is-an-atlassian-account) → definisi; konsep managed account
25. [Email address verification issues](https://support.atlassian.com/atlassian-account/docs/email-address-verification-issues) → pengirim `noreply+XXXXXXXXX@am.atlassian.com`; tombol Resend
26. [Password reset issues](https://support.atlassian.com/atlassian-account/docs/password-reset-issues) → subject *"Reset your Atlassian password"*; pengirim `@id.atlassian.com`
27. [Login issues related to a locked Atlassian account](https://support.atlassian.com/atlassian-account/docs/login-issues-related-to-a-locked-atlassian-account) → *"a CAPTCHA form will be displayed"*; lockout sementara
28. [I'm locked out of my Atlassian account](https://support.atlassian.com/atlassian-cloud/kb/im-locked-out-of-my-atlassian-account) → **lockout per-IP**
29. [Login issues related to an incorrect email address error](https://support.atlassian.com/atlassian-account/docs/login-issues-related-to-an-incorrect-email-address-error) → *"We're unable to log you in to [app] with y@email.com…"*
30. [Login issues related to browser cookies](https://support.atlassian.com/atlassian-account/docs/login-issues-related-to-browser-cookies) → daftar domain cookie yang di-allow-list (`*.atlassian.com`, `*.trello.com`, `*.atlassian.net`, …)
31. [Log in with SAML single sign-on](https://support.atlassian.com/atlassian-account/docs/log-in-with-saml-single-sign-on) → SAML memblokir third-party login
32. [Manage two-step verification for your Atlassian account](https://support.atlassian.com/atlassian-account/docs/manage-two-step-verification-for-your-atlassian-account) → metode, recovery key sekali pakai, efek ke API token
33. [Verify your identity](https://support.atlassian.com/atlassian-account/docs/verify-your-identity) → session 7 hari; kode 6 digit 30 menit
34. [Manage API tokens for your Atlassian account](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account) → expiry 1–365 hari; basic auth; verifikasi identitas
35. [Update idle session duration](https://support.atlassian.com/security-and-access-policies/docs/update-idle-session-duration) → **default 30 hari**; Gov Cloud 24 jam
36. [Set idle session duration for external users](https://support.atlassian.com/security-and-access-policies/docs/set-idle-session-duration-for-external-users) → 15 menit – 30 hari
37. [Set session expiration](https://support.atlassian.com/security-and-access-policies/docs/set-session-expiration) → batas absolut
38. [Enforce two-step verification](https://support.atlassian.com/security-and-access-policies/docs/enforce-two-step-verification/) → enforcement oleh org
39. [Verify a domain to manage accounts](http://support.atlassian.com/user-management/docs/verify-a-domain-to-manage-accounts) → verifikasi domain mengaktifkan managed account
40. [Access your Atlassian account with a passkey](https://support.atlassian.com/atlassian-account/docs/access-your-atlassian-account-with-a-passkey) → hanya non-managed account

### Dokumentasi developer Trello

41. [Authorizing With Trello's REST API](https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/) → `/1/authorize`, `expiration=1hour|1day|30days|never`, scope, 3 cara passing token
42. [Trello REST API — API introduction](http://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction) → API key publik, token rahasia; `api.trello.com/1/...`
43. [REST API Client (Power-Ups)](https://developer.atlassian.com/cloud/trello/power-ups/rest-api-client) → `client.authorize()`, token disimpan di private plugin data
44. [SCIM Authorization](https://developer.atlassian.com/cloud/trello/scim/authorization) → `Authorization: Bearer`, token dari `/enterprise/[name]/token`
45. [Trello REST API reference](https://developer.atlassian.com/cloud/trello/rest) → endpoint & scope OAuth 2.0

### Status

46. `https://status.atlassian.com/` → "All Systems Operational" (5 Oktober 2026); Trello punya status page sendiri di `trellostatus.com`

---

## Ringkasan Hal yang **Tidak** Bisa Diverifikasi

Daftar jujur ini penting — jangan pakai angkanya tanpa konfirmasi lebih lanjut:

1. **Batas panjang maksimum email.** Tidak ada `maxlength`, tidak ada kode error, tidak teramati. **Tidak diketahui.**
2. **Normalisasi email (lowercase/trim) di sisi server.** Client melakukan `trim()`. Apakah server juga meng-`toLowerCase()` tidak teramati.
3. **Apakah password di-trim server-side.** Client tidak trim; perilaku server tidak teramati.
4. **bcrypt 72-byte truncation.** **Tidak ada bukti first-party sama sekali.** String *"must be between 8 and 72 characters long"* ada di bundle tapi berasal dari code path `welcome.`/`changePassword.` yang berbeda, dan jelas berbeda dari batas 100 karakter di login. Jangan menyimpulkan apa-apa.
5. **Aturan komposisi password (uppercase/lowercase/digit/special) untuk signup Trello gratis.** String errornya ada, tapi **tidak terverifikasi aktif** di path ini — saya tidak menyelesaikan signup.
6. **Nama & atribut cookie sesi auth pasca-login di `id.atlassian.com`.** Butuh login berhasil.
7. **Ambang angka rate-limit / lockout** (jumlah percobaan, durasi lockout). Atlassian tidak mempublikasikannya.
8. **Isi blacklist domain email.** Hanya teramati `example.com` ditolak dan `.test` diterima. Kemungkinan besar ini konsekuensi MX lookup, bukan daftar statis.
9. **Apakah akun dapat dipakai sebelum verifikasi email selesai.** Tidak terverifikasi.
10. **Apakah ada prompt workspace/team invite di signup.** Tidak ada di form Atlassian ID; ada parameter `jiraInviteLink` di `continue` Trello, jadi mungkin ada di sisi Trello — tapi tidak terverifikasi.
11. **Apakah display name bisa diedit setelah signup.** Tidak diuji langsung (ada dokumentasi "Manage your personal profile").
12. **Perilaku forced-logout setelah reset password.** Tidak terverifikasi.
13. **Case-insensitivity username.** N/A — tidak ada username.
14. **`Expires`/`Max-Age` dari header `Set-Cookie` saat login.** Tidak teramati (butuh kredensial).
15. **Halaman support Trello** (`trello.com/guide/…`) — diblokir firewall lingkungan.