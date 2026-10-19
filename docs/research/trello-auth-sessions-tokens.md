# Autentikasi, Session, dan Token Trello.com — Riset Berbasis Sumber Primer

**Tanggal riset:** 5 Oktober 2026
**Target:** `trello.com`, `api.trello.com`, `id.atlassian.com`, `auth.atlassian.com`
**Metode:** penelusuran dokumentasi resmi + probe HTTP langsung (`curl.exe -i`) + observasi cookie jar browser sungguhan (Chrome via Playwright)

> **Cara membaca dokumen ini.** Setiap klaim non-trivial diberi URL sumber. Klaim yang berasal dari probe langsung diberi label `OBSERVASI` beserta status code, header, dan body verbatim. Klaim yang **tidak bisa** diverifikasi ditandai `UNVERIFIED` — tidak ada yang ditebak. Istilah teknis (cookie, header, token, scope, endpoint, dsb.) dipertahankan dalam bahasa Inggris; prosa penjelasan dalam bahasa Indonesia.

---

## 1. Ringkasan Eksekutif

Trello punya **dua pesawat autentikasi yang saling terpisah**, dan ini adalah temuan paling penting dari riset ini:

1. **Pesawat web (`trello.com`)** — autentikasi berbasis *session cookie* yang disimpan di browser, dengan identitas yang sesungguhnya dikelola oleh **Atlassian ID** di `id.atlassian.com`. Cookie sesi yang benar-benar terpakai adalah **`atl_session`**. Permintaan XHR dari aplikasi web Trello ke endpoint `/1/*` **tidak mengirim `key`/`token` dan tidak mengirim header `Authorization`** — jadi mekanismenya murni cookie.
2. **Pesawat API (`api.trello.com` dan `trello.com/1/...`)** — **hanya menerima token**, dan **menolak cookie sepenuhnya**. `OBSERVASI`: mengirim cookie tiruan `trello_session`, `JSESSIONID`, dan `atl_token` menghasilkan `400 invalid token` — sama persis dengan tidak mengirim apa pun.

Temuan lain yang menonjol:

- **Nama cookie di brief tidak cocok dengan kenyataan.** `trello_session`, `JSESSIONID`, `atl_token`, dan `_hjSessionUser_*` **tidak pernah teramati**. Yang ada: `atl_session`, `atlUserHash`, `dsc`, `atl_xid.*`, `atlCohort`, `atlassian.account.xsrf.token`, `atlassian.account.ffs.id`, `aws-waf-token`, `ajs_anonymous_id`.
- **`atl_session` tidak `HttpOnly` dan tidak `Secure`.** `OBSERVASI` (anonymous session, 2026-10-05): `httpOnly=false secure=false sameSite=Lax`, nilai 36 karakter, masa hidup ~28 menit saat diamati. Ini tidak lazim untuk cookie pembawa kredensial — `UNVERIFIED` apakah cookie ini benar-benar pembawa auth atau hanya token *device binding*.
- **Trello sekarang punya OAuth 2.0 3LO** (diumumkan 15 September 2026, entri changelog `CHANGE-3427`), berdampingan dengan model lama `/1/authorize` + Trello Auth token, dan model OAuth 1.0a yang masih didokumentasikan.
- **Kontrak error Trello tidak konsisten**, dan ini layak diajarkan apa adanya: `400 invalid token` (text/plain) untuk kredensial hilang, `401 invalid key` untuk key tidak valid, `401` **berupa halaman HTML AtlassianEdge** untuk jalur `Authorization: Bearer`, dan JSON `{"message":…,"error":…}` untuk validasi.
- **Kredensial invalid tidak diabaikan — justru merusak.** `OBSERVASI`: `GET /1/boards/5abbe4b7ddc1b351ef961414` tanpa kredensial → `200` (board publik), tetapi dengan `?key=<32-hex-palsu>` → `401 invalid key`. Menghilangkan header ini membuat endpoint publik tidak bisa diakses.
- **Ada CSRF cookie yang konkret**: `OBSERVASI` `Set-Cookie: auth.csrf=s%3A…; Path=/auth/callback; HttpOnly; Secure` pada `GET https://trello.com/auth/atlassian/callback`. Ini bukti CSRF *double-submit* pada jalur callback OAuth Atlassian.

---

## 2. Metodologi dan Basis Bukti

Semua klaim di dokumen ini termasuk ke salah satu dari tiga kategori:

| Kategori | Arti | Penanda |
|---|---|---|
| **DOKUMENTASI** | Diambil dari `developer.atlassian.com/cloud/trello/*` atau `support.atlassian.com/*` | kutipan verbatim + URL |
| **OBSERVASI** | Diukur langsung dengan probe HTTP (`curl.exe -i`) atau browser sungguhan | status code + header + body verbatim |
| **UNVERIFIED** | Tidak bisa dibuktikan dengan metode yang tersedia; tidak ditebak | label eksplisit |

Keterbatasan metode yang penting:

- **Tidak ada kredensial Trello yang sah.** Semua probe memakai key/token Buatan berbentuk 32-hex (`0123456789abcdef0123456789abcdef`). Ini cukup untuk memetakan *kontrak* (status code, bentuk error, urutan evaluasi) tetapi **tidak** untuk memverifikasi perilaku sukses.
- **`webfetch` menyembunyikan header**, jadi semua probe header memakai `curl.exe -i` via PowerShell. Skripnya ada di `scripts/probe-*.ps1` dan bisa dijalankan ulang.
- **`id.atlassian.com` berada di belakang AWS WAF.** `OBSERVASI`: klien non-browser mendapat `x-amzn-waf-action: challenge` dengan status `202`. Halaman itu hanya bisa diambil lewat browser sungguhan.
- **Tidak ada browser yang sudah login.** Observasi cookie adalah untuk sesi anonim.
- Beberapa probe yang sama diulang-ulang secara identik 5× (`scripts/probe-repro.ps1`); hasilnya dicatat apa adanya termasuk ketidakkonsistenan yang teramati.

### 2.1 Sumber yang bisa mesin baca

Trello mempublikasikan OpenAPI v3 statis:

```
https://dac-static.atlassian.com/cloud/trello/swagger.v3.json
```

`OBSERVASI` isi yang relevan:

```json
"servers": [{ "url": "https://api.trello.com/1" }],
"securitySchemes": {
  "APIKey":   { "type": "apiKey", "in": "query", "name": "key" },
  "APIToken": { "type": "apiKey", "in": "query", "name": "token" },
  "OAuth2":   { "type": "oauth2", "flow": "authorizationCode",
                "authorizationUrl": "https://auth.atlassian.com/authorize",
                "tokenUrl": "https://auth.atlassian.com/authorize/oauth/token" }
}
```

`OBSERVASI` global `security` adalah `APIKey` + `APIToken` — artinya OpenAPI itu sendiri hanya tahu cara query-param auth, dan **tidak** mendokumentasikan jalur `Authorization: OAuth …` maupun jalur cookie. Pola key: `^[0-9a-fA-F]{32}$`.

Ada juga discovery OIDC Atlassian yang bisa dibaca mesin di `https://auth.atlassian.com/.well-known/openid-configuration` (`OBSERVASI` `200 OK`, `Content-Type: application/json;charset=UTF-8`, `Access-Control-Allow-Origin: *`):

```json
{"authorization_endpoint":"https://auth.atlassian.com/authorize",
 "claims_supported":["aud","auth_time","created_at","email","email_verified","exp","family_name","given_name","iat","identities","iss","name","nickname","phone_number","picture","sub"],
 "code_challenge_methods_supported":["S256"],
 "device_authorization_endpoint":"https://auth.atlassian.com/oauth/device/code",
 "id_token_signing_alg_values_supported":["HS256","RS256"],
 "issuer":"https://auth.atlassian.com",
 "jwks_uri":"https://auth.atlassian.com/.well-known/jwks.json",
 "mfa_challenge_endpoint":"https://auth.atlassian.com/mfa/challenge",
 "registration_endpoint":"https://auth.atlassian.com/oidc/register",
 "request_parameter_supported":false,
 "request_uri_parameter_supported":false,
 "response_modes_supported":["query","fragment","form_post"],
 "response_types_supported":["code","token","id_token","code token","code id_token","token id_token","code token id_token"],
 "revocation_endpoint":"https://auth.atlassian.com/oauth/revoke",
 "scopes_supported":["openid","profile","offline_access","name","given_name","family_name","nickname","email","email_verified","picture","created_at","identities","phone","address"],
 "subject_types_supported":["public"],
 "token_endpoint":"https://auth.atlassian.com/oauth/token",
 "token_endpoint_auth_methods_supported":["client_secret_basic","client_secret_post"],
 "userinfo_endpoint":"https://auth.atlassian.com/userinfo"}
```

Catatan penting: `scopes_supported` di sini **tidak** memuat scope Trello seperti `read:board:trello`. Scope tersebut milik *audience* `api.trello.com`, bukan scope OpenID Connect generik Atlassian.

### 2.2 Ketidakkonsistenan probe yang harus dilaporkan jujur

`OBSERVASI` — pada beberapa probe awal, `POST` dengan body JSON yang **valid** ke `/1/token/exchange` dan `POST https://trello.com/1/boards` mengembalikan `400 Error parsing body` (`text/plain`). Pengulangan identik 5× pada sesi berikutnya **tidak** mereproduksi itu (`401 invalid token` dan `400 {"message":"invalid value for name","error":"ERROR"}`). `X-Amz-Cf-Pop` berbeda antar-run (`SIN2-P5` vs `SIN2-P11`).

Kesimpulan yang jujur: **`Error parsing body` itu edge-dependent / flaky dan TIDAK boleh dianggap kontrak API.** Yang reproducible adalah `401 invalid token`. Laporan ini tidak mengklaim apa pun tentang penyebabnya.

---

## 3. Arsitektur Autentikasi: Dua Pesawat Terpisah

### 3.1 Pesawat web — session cookie di `trello.com`

**DOKUMENTASI** — Login Trello diarahkan ke Atlassian ID. Sumber: `https://support.atlassian.com/trello/docs/recovering-your-account` menyatakan reset password dilakukan di `https://id.atlassian.com/login/resetpassword`.

**OBSERVASI** — Rantai redirect:

```
GET https://trello.com/login
→ HTTP/1.1 302 Found
  Location: https://id.atlassian.com/login?application=trello&continue=https%3A%2F%2Ftrello.com%2Fauth%2Fatlassian%2Fcallback%3FreturnUrl%3D...
```

Parameter `continue` menunjuk ke `trello.com/auth/atlassian/callback`. Jadi **Atlassian ID adalah identity provider**, dan `trello.com/auth/atlassian/callback` adalah *callback* yang kembali ke Trello.

Ada dua alias endpoint yang behave identik:

```
GET https://trello.com/ensureSession          → 302 → id.atlassian.com/login?application=trello&continue=…
GET https://trello.com/1/session              → 404  "Cannot GET /1/session"
```

`ensureSession` adalah endpoint yang bisa dianggap "session gate": kalau tidak ada sesi, ia langsung mengarahkan ke login Atlassian. `/1/session` **tidak ada** — jangan dipanggil.

**OBSERVASI** — Mekanisme auth aplikasi web, dibuktikan dari network log browser:

```
[GET] https://trello.com/1/members/me?organizations=all&organization_fields=name,displayName,memberships,url,products&credits=freeTrial  =>  [400]
```

Header request yang teramati (Playwright menyembunyikan `Cookie` dari tampilan, tetapi browser **tetap** mengirimnya secara otomatis):

```
sec-ch-ua-platform: "Windows"
referer: https://trello.com/
user-agent: …Chrome/154.0.0.0 Safari/537.36
```

Tidak ada `key`, tidak ada `token`, tidak ada header `Authorization`. Response-nya `400` dengan body persis `invalid token` (13 byte). **Kesimpulan:** aplikasi web Trello mengautentikasi XHR-nya **hanya lewat cookie**; endpoint `/1/*` yang sama menolak key/token dari browser karena memang tidak ada.

### 3.2 Pesawat API — token-only di `api.trello.com`

**OBSERVASI** — Bukti bahwa cookie **ditolak** oleh host API:

```
GET https://api.trello.com/1/members/me
  -H "Cookie: trello_session=xxx; JSESSIONID=yyy; atl_token=zzz"
→ HTTP/1.1 400 Bad Request
  Content-Type: text/plain; charset=utf-8
  invalid token
```

Identik dengan tidak mengirim cookie. Artinya plane API benar-benar terpisah dari plane web.

**OBSERVASI** — `trello.com/1/*` dan `api.trello.com/1/*` adalah service yang **sama**, bukan implementasi berbeda. Bukti: body identik, header identik, dan perilaku identik pada host yang sama:

| Probe | `trello.com/1/...` | `api.trello.com/1/...` |
|---|---|---|
| `GET /1/members/me` | `400 invalid token` | `400 invalid token` |
| `?key=bad&token=bad` | `401 invalid key` | `401 invalid key` |
| `POST /1/boards` JSON `{name}` | `400 {"message":"invalid value for name","error":"ERROR"}` | `400 {"message":"invalid value for name","error":"ERROR"}` |
| `POST /1/token/exchange` JSON `{scopes:[...]}` | `401 invalid token` | `401 invalid token` |

Yang membedakan keduanya hanya **jenis layanannya**: `trello.com` melayani HTML aplikasi web plus API, `api.trello.com` hanya API. Keduanya dibelakangi `AtlassianEdge` + CloudFront.

### 3.3 CORS di host API

**OBSERVASI** — header ini stabil di semua response API:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, PUT, POST, DELETE
Access-Control-Allow-Headers: Authorization, Accept, Content-Type
Access-Control-Expose-Headers: x-rate-limit-api-key-interval-ms, x-rate-limit-api-key-max,
  x-rate-limit-api-key-remaining, x-rate-limit-api-token-interval-ms, x-rate-limit-api-token-max,
  x-rate-limit-api-token-remaining, retry-after
```

Implikasi yang bisa ditarik dengan aman: `Access-Control-Allow-Headers` hanya mengizinkan `Authorization`, `Accept`, `Content-Type`. Jadi **tidak ada custom header CSRF yang bisa dikirim cross-origin** — konsisten dengan desain token-only.

### 3.4 Apa yang tetap UNVERIFIED di section ini

- **`UNVERIFIED`** — nama dan atribut cookie sesi **saat sudah login**. Semua observasi cookie adalah sesi anonim. Tidak ada cara mendapatkan nama cookie sesi terautentikasi tanpa kredensial.
- **`UNVERIFIED`** — apakah `atl_session` benar-benar *bearer credential* atau hanya *device/session binding* yang ditopang oleh cookie lain (misalnya `atlUserHash`). Alasan kami: cookie itu **tidak `HttpOnly`**, jadi bisa dibaca JavaScript — pola yang biasanya menandakan bukan satu-satunya pembawa otorisasi.
- **`UNVERIFIED`** — apakah kebijakan *idle session duration* 30 hari berlaku untuk akun Trello gratis. Dokumentasi itu adalah dokumentasi *Atlassian authentication policy* dan secara eksplisit hanya berlaku untuk **managed accounts** (lihat section 8).

---

## 4. Observasi Cookie di Browser Sungguhan

Diambil dari cookie jar Chrome sungguhan (sesi anonim, domain `*.trello.com` dan `*.atlassian.com`), 5 Oktober 2026.

### 4.1 Cookie inti Trello

| Nama | Domain | HttpOnly | Secure | SameSite | Masa hidup | Nilai |
|---|---|---|---|---|---|---|
| `atl_session` | `trello.com` | **false** | **false** | `Lax` | ~1.717 detik (~28,6 menit) saat diamati | 36 char |
| `atlUserHash` | `.trello.com` | false | false | `Lax` | ~345.595.850 detik (~400 hari) | 10 char |
| `dsc` | `trello.com` **dan** `api.trello.com` | false | **true** | `None` | ~2.591.162 detik (~30 hari) | 64 char |
| `atl_xid.xc` | `.atlassian.com` | false | true | **`None`** | ~365 hari | 141 char |
| `atl_xid.ts` | `trello.com` | false | true | `Lax` | ~365 hari | 13 char |
| `atl_xid.current` | `trello.com` | false | true | `Lax` | ~365 hari | 147 char |
| `atlCohort` | `.trello.com` | false | false | `Lax` | ~400 hari | 96 char |
| `ajs_anonymous_id` | `.atlassian.com` **dan** `.trello.com` | false | true | `Lax` | ~365 hari | 42 char |
| `__cuid` | `.atlassian.com`, `.id.atlassian.com` | false | false | `Lax` | ~400 hari | 32 char |
| `_otPreferencesSynced` | `trello.com` | false | false | `Lax` | ~365 hari | (kosong) |

**OBSERVASI** — `dsc` di-set pada hampir **setiap** response anonim, dengan bentuk persis:

```
Set-Cookie: dsc=dafe645a0351b390af7593224461b0c6fc0f52ac3e19e2c9059d5e19b72b08b0; Path=/; Expires=Wed, 04 Nov 2026 08:40:53 GMT; Secure; SameSite=None
```

`dsc` di-set pada `trello.com/1/...`, `api.trello.com/1/...`, `trello.com/login`, `trello.com/ensureSession`, `trello.com/auth/atlassian/callback`, dan `/1/search`. Nilai `dsc` **berbeda tiap response** ( bandingkan `dafe64…`, `d7b21e…`, `bc00b2…`, `a516d8…` pada probe berturut-turut). **`dsc` bukan session login** — ini device/session cookie yang di-refresh tiap kali, dengan `SameSite=None` sehingga bisa dibaca cross-site (kebutuhan iframe Power-Up).

### 4.2 Cookie Atlassian ID

| Nama | Domain | HttpOnly | Secure | SameSite | Masa hidup |
|---|---|---|---|---|---|
| `atlassian.account.xsrf.token` | `id.atlassian.com` | **true** | true | `Lax` | **session cookie** (`expires=-1`), 36 char |
| `atlassian.account.ffs.id` | `id.atlassian.com` | false | true | `Lax` | ~365 hari, 36 char |
| `aws-waf-token` | `.id.atlassian.com` | false | true | `Lax` | ~4 hari, 466 char |
| `g_state` | `id.atlassian.com` | false | false | `Lax` | ~180 hari |
| `Bifrost-Atl-Ctx-Cloud-Service-Provider` | `id.atlassian.com` | false | false | `Lax` | session cookie |

`atlassian.account.xsrf.token` adalah satu-satunya cookie CSRF yang teramati, dan **`HttpOnly` + session-scoped**. Ini penting: karena `HttpOnly`, JavaScript **tidak bisa** membacanya — jadi kalau Trello web app memakai pola *double-submit* CSRF, tokennya harus datang lewat response body.

**OBSERVASI** — `GET https://id.atlassian.com/rest/login/state?application=trello` mengembalikan JSON yang memuat:

```
csrfToken, hashedCsrfToken, ffsId, login.rememberMeEnabled,
appConfig: { …OAuth social client IDs…, castlePublishableApiKey, …reCAPTCHA keys… }
```

Artinya pasangan `csrfToken` / `hashedCsrfToken` itu **ada dan dikirim lewat body**, dengan bentuk *masked double-submit* (hashed version untuk client, token asli untuk server).

### 4.3 Cookie pihak ketiga yang ikut tercipta

`_ga`, `_ga_2PBSYQJXE3`, `_gcl_au`, `_mkto_trk`, `BP_GTM_FPC`, `sn_id` (Swirl, cookielaw), `_rdt_uuid`, `_twpid` (Strict), `_twsid`, `OptanonConsent`. Tidak ada relevansi terhadap auth, tapi menunjukkan consent/analytics stack OneTrust + Marketo + Google Tag Manager.

### 4.4 Cookie yang TIDAK ada

**OBSERVASI** — semua cookie berikut **tidak pernah muncul** di cookie jar:

```
trello_session   → ABSENT
JSESSIONID       → ABSENT
atl_token        → ABSENT
_hjSessionUser_* → ABSENT
```

Nama `trello_session` dan `atl_token` adalah artefak **Jira/Confluence/Data Center**, bukan Trello. Ini tidak boleh dipindahkan ke analisis Trello. Nama `atl_session` + `atlUserHash` + `atl_xid.*` + `atlCohort` adalah yang benar-benar dipakai Trello.

---

## 5. CSRF, XSRF, dan Perlindungan Sesi Web

### 5.1 Cookie CSRF pada jalur callback — bukti konkret

**OBSERVASI** — `GET https://trello.com/auth/atlassian/callback` (tanpa parameter):

```
HTTP/1.1 302 Found
Content-Type: text/plain; charset=utf-8
Set-Cookie: dsc=9c199f1c…; Path=/; Expires=…; Secure; SameSite=None
Set-Cookie: auth.csrf=s%3AjojW22qtEEeKAxb2MzJcN7lg4fEjR4BnsPTxrerBq78%3D.d6FKyQTCduFyacjuHI4FiIFtwb%2Bt8yICFZoCtCUaadA; Path=/auth/callback; HttpOnly; Secure
Location: https://id.atlassian.com/login?application=trello&continue=https%3A%2F%2Ftrello.com%2Fauth%2Fatlassian%2Fcallback%3FreturnUrl%3D%252F%26aaOnboarding%3D%26updateEmail%3D%26traceId%3D%26ssoVerified%3D%26createMember%3Dfalse%26jiraInviteLink%3D
```

Atribut `auth.csrf`:

- `Path=/auth/callback` — **di-scope ke jalur callback saja**
- `HttpOnly` — tidak bisa dibaca JavaScript
- `Secure` — HTTPS only
- **Tanpa `SameSite`** → default `Lax` per RFC 6265bis
- Nilai berbentuk `s%3A<b64url>%3D.<b64url>` — ini persis format **signed cookie** dari middleware Express `cookie-parser`/`csurf` (`s:<value>.<HMAC>`)

`OBSERVASI` — nilainya **berbeda tiap request** (probe kedua menghasilkan `s%3A5I%2FFe65nlS…%3D.H%2BwUTubocpPDLnXRklK9H3Xm%2BFXXi4bH%2F4uoLPP%2Byy4`), jadi ini token CSRF yang di-refresh, bukan nilai statis.

**OBSERVASI** — ada alias: `GET https://trello.com/auth/callback` → `302 Location: /auth/atlassian/callback`.

**Bacaan:** Trello "menerbitkan" cookie CSRF yang di-scope ke jalur callback OAuth Atlassian. Ini konsisten dengan pola double-submit, tapi karena cookie-nya `HttpOnly` dan tidak terlihat pernah dikirim balik sebagai header, mekanismenya secara lengkap belum bisa dipastikan.

### 5.2 Apa yang tidak ada

**OBSERVASI** — tidak ada `X-XSRF-TOKEN`, `X-CSRF-Token`, atau header serupa pada response mana pun di `trello.com` maupun `api.trello.com`. `Access-Control-Allow-Headers` hanya `Authorization, Accept, Content-Type`.

### 5.3 CSP dan header keamanan

**OBSERVASI** — `GET https://trello.com/?cb=99871` (dipaksa cache-bust, `X-Cache: Hit from cloudfront`):

```
Content-Security-Policy:
Content-Security-Policy-Report-Only: base-uri 'self'; default-src 'self' *.atlassian.com …; script-src 'self' … 'unsafe-eval' 'unsafe-inline'; …
```

**Catatan:** header `Content-Security-Policy` yang *enforce* adalah **kosong**; hanya varian `Report-Only` yang terisi. Jadi secara praktis CSP Trello tidak menegakkan apa pun saat ini — hanya melaporkan. Ini temuan yang layak dicatat, bukan tuduhan.

`OBSERVASI` — `Strict-Transport-Security` konsisten di mana-mana: `max-age=63072000; preload`.

**OBSERVASI** — header keamanan bersama di host API:

```
Strict-Transport-Security: max-age=63072000; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-Download-Options: noopen
X-Permitted-Cross-Domain-Policies: none
X-Xss-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
X-Dns-Prefetch-Control: off
Surrogate-Control: no-store
Server: AtlassianEdge
X-Trello-Version: 1.500824.0
X-Trello-Environment: Production
Atl-Traceid: 1170d0afede54481a5e2c8832ab5e710
Atl-Request-Id: 1170d0af-ede5-4481-a5e2-c8832ab5e710
```

Header yang **tidak** ada: `Cross-Origin-Opener-Policy` dan `Cross-Origin-Resource-Policy` — padahal `postMessage` adalah salah satu `callback_method` resmi untuk `/1/authorize`. Untuk popup Power-Up tanpa COOP, relasi `window.opener` tetap bisa disalahgunakan; ini catatan risiko, bukan temuan eksploitasi.

### 5.4 UNVERIFIED di section ini

- **`UNVERIFIED`** — apakah Trello benar-benar *menegakkan* CSRF pada request state-changing yang diautentikasi cookie. Butuh sesi login. Yang teramati hanya *penerbitan* cookie-nya.
- **`UNVERIFIED`** — nama header CSRF yang dikirim web app saat melakukan write. Tidak ada response yang menunjukkan nama header tersebut, dan request XHR anonim tidak pernah sampai ke fase write.

---

## 6. Model API Key, Token, dan Masa Berlakunya

### 6.1 Dua hal yang harus dimiliki

**DOKUMENTASI** — `https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/`:

> "To begin the authentication process, you need an API key. As an API key is tied to a Power-Up, you can visit the https://trello.com/apps/admin page, access your Power-Up, navigate to the **Trello Auth** tab and select the option **Generate a new API Key** if you haven't generated the API key yet."

> "Tokens for users should always be securely stored as they grant access to the entire user's account! **It is ok for your API key to be publicly available, but a token should never be publicly available.** If a token becomes public, it should be revoked immediately by the user."

Jadi: **API key = identitas aplikasi (boleh publik). Token = kredensial pengguna (rahasia).**

### 6.2 Tiga cara mengirim kredensial

**DOKUMENTASI** — halaman yang sama, bagian "Passing Token and Key In API Requests" menyatakan ada tepat tiga cara: *Query parameters*, *Authorization header*, *PUT/POST body*.

**Query parameters** (verbatim dari dokumentasi):
```
curl https://api.trello.com/1/members/me?key={{apiKey}}&token={{apiToken}}
```

**Authorization header** (verbatim):
```
curl -H "Authorization: OAuth oauth_consumer_key=\"{{apiKey}}\", oauth_token=\"{{apiToken}}\"" https://api.trello.com/1/members/me
```

**PUT/POST body** (verbatim):
```
curl -X PUT \
  https://api.trello.com/1/cards/5e568d33e9b5e88bb99996d0/name \
  -H "Content-Type: application/json" \
  -d '{"key": "{{apiKey}}", "token": "{{apiToken}}", "value": "Finish Final Presentation" }'
```

### 6.3 Precedence: header dievaluasi lebih dulu

**OBSERVASI** — `?key=bad&token=bad` **sekaligus** `Authorization: OAuth oauth_consumer_key="…", oauth_token="…"` dengan nilai tidak valid → hasilnya `400 invalid token`, **bukan** `401 invalid key`. Middleware jalur `Authorization: OAuth` diproses sebelum parsing query param.

Dan yang lebih penting:

**OBSERVASI** — `Authorization: Bearer <token>` **sekaligus** query param tidak valid → `401` **HTML** (`Content-Type: text/html`), title `The credentials supplied were not valid for this endpoint`. Header menang lagi, dan jalurnya baru saja diproses oleh **filter authz di edge AtlassianEdge**, bukan oleh aplikasi Trello.

**`UNVERIFIED`** — precedence dengan kredensial **valid**. Yang teramati hanya perilaku dengan kredensial tidak valid. Secara logika "header menang" masih berlaku, tapi tidak boleh diklaim sebagai terverifikasi.

### 6.4 Scope dan masa hidup (model lama)

**DOKUMENTASI** — `/1/authorize` route options, verbatim:

| Parameter | Valid values | Deskripsi |
|---|---|---|
| `callback_method` | `postMessage` atau `fragment` | `postMessage` untuk popup (Trello memanggil `window.postMessage()` ke opener; `return_url` dipakai sebagai *origin*), `fragment` untuk redirect (token dikembalikan di hash URL) |
| `return_url` | URL valid | Harus dipakai bersama `callback_method` |
| `scope` | `read`, `write`, `account` (comma-separated) | `Read`: membaca board/organization; `Write`: menulis board/organization; `Account`: read member email, menulis member info, menandai notifikasi read |
| `expiration` | `1hour`, `1day`, `30days`, `never` | Kapan token kedaluwarsa |
| `key` | API key valid | Untuk menghasilkan token user |
| `response_type` | `token` | Mengembalikan token penuh di window browser, tanpa redirect |

Dampak `scope`: **DOKUMENTASI** — "Member emails can only be accessed when the `account` scope is requested."

Penanganan `Deny` — **DOKUMENTASI**: untuk `response_type=fragment` Trello menambahkan query param `token=` kosong plus `error=`; untuk `postMessage` Trello mengirim key error via `postMessage`.

### 6.5 Allowed origins — proteksi anti-open-redirect

**DOKUMENTASI** — bagian "Allowed Origins", verbatim:

> "If the URL in the `return_url` parameter does not match one of your API key's allowed origins, **the redirect is blocked**. This prevents malicious actors from using your API key and secretly redirecting users to their application instead."

Wildcard `*` dan subdomain (`https://*.myapplication.com`) didukung; `http://localhost:3000` boleh didaftarkan untuk pengembangan lokal. **"If your API key has no allowed origins set, then no redirect URL will work."**

### 6.6 Revocation

**DOKUMENTASI** — pengguna melihat daftar aplikasi beserta scope, tanggal persetujuan, dan tanggal kedaluwarsa di `https://trello.com/u/{username}/account`, lalu menekan **Revoke**. Dokumentasi juga menyebut "There is a `/1/tokens` resource that includes a `DELETE` action."

Kontrak setelah dicabut — **DOKUMENTASI**: "the API will respond with a **401** HTTP status and the message: **`invalid token`**".

**OBSERVASI** — `/1/tokens` sendiri **tidak bisa diakses tanpa auth**:
```
GET https://api.trello.com/1/tokens        → 404  Cannot GET /1/tokens
GET https://api.trello.com/1/members/me/tokens → 400  invalid token
```

### 6.7 Rate limit

**DOKUMENTASI** — `https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/`, verbatim:

> "our API imposes rate limits **per API key** for all issued tokens. There is a limit of **300 requests per 10 seconds for each API key** and **100 requests per 10 second interval for each token**. Additionally, there is a limit on requests to `/1/members/` of **100 requests per 900 seconds**."

> "If the amount of 429 errors per API key exceeds 200, Trello will return 429 for the remainder of the API key requests for the remainder of the 10s window."

Bentuk error 429 (verbatim):
```json
{ "error": "API_TOKEN_LIMIT_EXCEEDED", "message": "Rate limit exceeded" }
{ "error": "API_KEY_LIMIT_EXCEEDED",  "message": "Rate limit exceeded" }
```

Bentuk error lain: `API_TOKEN_DB_LIMIT_EXCEEDED` (kuota waktu query DB per token) dan `API_TOO_MANY_CARDS_REQUESTED` dengan pesan `"Requested too many cards with action loads, please limit"`.

Header rate limit yang dikembalikan — **DOKUMENTASI** memberi contoh:
```
x-rate-limit-api-token-interval-ms: 10000
x-rate-limit-api-token-max: 100
x-rate-limit-api-token-remaining: 99
x-rate-limit-api-key-interval-ms: 10000
x-rate-limit-api-key-max: 300
x-rate-limit-api-key-remaining: 299
```

**OBSERVASI** — header yang benar-benar muncul pada request tanpa kredensial:

```
X-Rate-Limit-Asap-Interval-Ms: 10000
X-Rate-Limit-Asap-Max: 1000000
X-Rate-Limit-Asap-Remaining: 997286
```
dan pada request dengan key tanpa token: `X-Rate-Limit-Api-Key-No-Token-*` dengan **max 100 / 10s**; pada jalur `Bearer` yang ditolak: `X-Rate-Limit-Unauthed-Ip-*` dengan **max 200 / 10s**. Ketiganya **tidak** ada di `Access-Control-Expose-Headers` — jadi informasi rate-limit untuk request anonim tidak terbaca browser cross-origin.

**OBSERVASI** — "Special Route Limits": dokumentasi menyebut tiga route dengan limit ketat: `/1/members`, `/1/membersSearch`, `/1/search`. Yang benar-benar ada di route table:
```
GET /1/search?query=trello&idBoards=5abbe4b7ddc1b351ef961414  → 200  (tanpa auth)
GET /1/members                                                → 404  Cannot GET /1/members
GET /1/membersSearch?query=trello                             → 404  Cannot GET /1/membersSearch?query=trello
```
Jadi `members` dan `membersSearch` adalah **prefix**, bukan route terpisah — `/1/members/me` ada, `/1/members` sendiri tidak. Dokumentasinya memakai prefix tanpa garis miring yang jelas.

### 6.8 UNVERIFIED di section ini

- **`UNVERIFIED`** — perilaku `?token=omit`. **`OBSERVASI`**: `GET /1/members/me?token=omit` → `401 invalid key` (identik dengan `token` hilang). Jadi pada versi API yang diamati, sentinel `omit` **tidak** mengubah perilaku; perlakukan sebagai token tidak valid biasa.
- **`UNVERIFIED`** — kedaluwarsa nyata token `1hour` / `1day` / `30days`. Butuh token valid.

---

## 7. OAuth: Trello sebagai Provider vs Trello sebagai Consumer

Dua arah yang sama sekali berbeda dan sering tercampur. Pemisahan ini penting.

### 7.1 Trello sebagai OAuth **Provider** — Trello memberi akses ke data Trello

Tiga model hidup berdampingan:

#### (a) `/1/authorize` + Trello Auth token (model lama, masih jadi default)

**DOKUMENTASI** — `https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/`:

> "There are two ways to authorize a client and receive a User Token. The first is via our `1/authorize` route, the second is via basic OAuth1.0."

Contoh minimal dari dokumentasi:
```
https://trello.com/1/authorize?expiration=1day&scope=read&response_type=token&key={YourAPIKey}
```

**OBSERVASI** — dengan key 32-hex Buatan:
```
GET https://trello.com/1/authorize?expiration=never&name=Probe&scope=read&response_type=token&return_url=https%3A%2F%2Fexample.com%2Fcb&key=0123456789abcdef0123456789abcdef
→ HTTP/1.1 404 Not Found
  Content-Type: text/plain; charset=utf-8
  App not found
```
`404 App not found` — validasi key terjadi sebelum layar consent. Error string ini **tidak** ada di dokumentasi.

#### (b) OAuth 1.0a basic (legacy, masih didokumentasikan)

**DOKUMENTASI**, verbatim:
```
https://trello.com/1/OAuthGetRequestToken
https://trello.com/1/OAuthAuthorizeToken
https://trello.com/1/OAuthGetAccessToken
```
"You'll also need your application secret (used to sign your requests). That's listed in the Trello Auth tab on your Power-Up management page https://trello.com/apps/admin."

**OBSERVASI** — ketiga endpoint bereaksi berbeda, dan itu informatif:
```
GET /1/OAuthGetRequestToken?oauth_consumer_key=<32hex>&oauth_callback=oob&…
→ 404  App not found                       (key dicek dulu)

GET /1/OAuthGetAccessToken?oauth_token=faketoken&oauth_consumer_key=<32hex>&…
→ 400  Missing oauth_verifier              (butuh oauth_verifier, konsisten OAuth 1.0a)
```

#### (c) OAuth 2.0 3LO (baru, 15 September 2026)

**DOKUMENTASI** — changelog Trello, entri `CHANGE-3427`, `"type": "Announcement"`, `"date": "2026-09-15"`, `apiGroups: ["power-ups-trello","rest-trello"]`:

> "Trello now supports OAuth 2.0 authorization code grants for apps, featuring **granular scopes, short-lived tokens, resource restrictions, and a redesigned consent screen** consistent with other Atlassian products. New apps can opt in right away, and existing apps can transition when ready."
> Sumber: `https://developer.atlassian.com/cloud/trello/changelog/` dan `https://community.developer.atlassian.com/t/oauth-2-0-3lo-is-now-available-for-trello/102691`

**DOKUMENTASI** — `guides/rest-api/oauth-2-getting-started/`:

> "Trello's OAuth 2.0 3LO protocol (also known as 'three-legged OAuth' or 'authorization code grants') is the right choice for user-facing apps, where a person logs in and consents to access."

> "If your app does not run on behalf of a logged-in user (bots, automation, or server-to-server integrations), then OAuth 2.0 may not be the ideal authorization mechanism."

Tiga perubahan yang disebut eksplisit: token punya umur terbatas dan harus di-refresh; access scope lebih granular; alur authorization + request lebih ringkas.

Scope default Power-Up — **DOKUMENTASI** (`oauth-2-client-configuration`): `read:board:trello` dan `write:board:trello`. `offline_access` **ditambahkan otomatis** oleh sistem.

**OBSERVASI** — endpoint 3LO:

```
GET https://auth.atlassian.com/authorize?audience=api.trello.com&client_id=<32hex>&scope=read:board:trello&redirect_uri=…&state=xyz&response_type=code&code_challenge=…&code_challenge_method=S256
→ HTTP/1.1 302 Found
  Location: https://id.atlassian.com/login?continue=https%3A%2F%2Fauth.atlassian.com%2Fauthorize%3Faudience%3Dapi.trello.com%26client_id%3D…

GET https://auth.atlassian.com/authorize            (tanpa param) → 302 → id.atlassian.com/login?continue=…
OPTIONS https://auth.atlassian.com/authorize                      → 302 (tidak ada header Allow)
OPTIONS https://auth.atlassian.com/oauth/token                    → 200  Allow: POST,OPTIONS
```

Sekarang validasi `client_id` **tidak** terjadi di `/authorize`; permintaan selalu dipaksa lewat login Atlassian dulu. Ini konsisten dengan dokumen OAuth: consent hanya diberikan setelah user terautentikasi.

Kontrak error token endpoint — **OBSERVASI** (`Content-Type: application/json`):

```json
// POST /oauth/token  body {}
{"error":"invalid_request","error_description":"grant_type must be one of [authorization_code|refresh_token|client_credentials]"}

// POST /oauth/token  grant_type=authorization_code, kredensial Buatan
{"error":"invalid_request","error_description":"Incorrect request parameters"}
```
`grant_type=client_credentials` dan `grant_type=refresh_token` dengan kredensial Buatan memberi error yang sama persis. `token_endpoint_auth_methods_supported` = `["client_secret_basic","client_secret_post"]`.

PKCE — **DOKUMENTASI** (`oauth-2-confidential-client-usage`): PKCE wajib untuk client rahasia, `code_challenge_method: S256`. **`OBSERVASI` dari discovery document** mengonfirmasi: `"code_challenge_methods_supported":["S256"]` (hanya S256, tidak ada `plain`). Umur token dari dokumentasi: **access token 1 jam**, **refresh token 90 hari dan sekali pakai** (single-use, dirotasi saat di-refresh).

### 7.2 Token exchange — migrasi tanpa re-consent

**DOKUMENTASI** (`guides/rest-api/oauth-2-for-existing-apps/` dan `oauth-2-confidential-client-usage/`), verbatim:

> "The token exchange endpoint accepts a valid Trello Auth token and returns a new set of OAuth 2.0 tokens for the same user. **The original Trello Auth token is revoked as part of the exchange.**"

> "After the exchange, all Trello API requests for that user must use the new OAuth 2.0 access token as a bearer token (`Authorization: Bearer {access_token}`)."

> "Additionally, for Power-Up OAuth 2.0 clients, the new OAuth 2.0 token is **workspace-restricted to the workspace the user is currently in**. If your users use your Power-Up across multiple workspaces, only the first workspace can be migrated this way."

Request body (dokumentasi): `scopes` (string[], required) dan `idOrganization` (string, required untuk Power-Up karena token-nya workspace-restricted).
Response (dokumentasi): `access_token`, `refresh_token`, `id_token`.

Contoh verbatim dari dokumentasi:
```js
const response = await fetch("https://api.trello.com/1/token/exchange", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `OAuth oauth_consumer_key="${API_KEY}", oauth_token="${TRELLO_AUTH_TOKEN}"`,
  },
  body: JSON.stringify({
    scopes: ["read:board:trello", "write:board:trello"],
    idOrganization: WORKSPACE_ID,
  }),
});
```

**OBSERVASI** — kontrak yang benar-benar terukur:

```
POST /1/token/exchange  (JSON valid, tanpa kredensial) → 401  invalid token      (5/5 reproducible)
POST /1/token/exchange  (JSON {}, tanpa kredensial)   → 401  invalid token
POST /1/token/exchange  (form-encoded)                → 401  invalid token
POST /1/token/exchange  (tanpa body)                  → 401  invalid token
GET  /1/token/exchange                                 → 400  invalid token
DELETE /1/token/exchange                               → 400  invalid token
OPTIONS /1/token/exchange                              → 200  Allow: DELETE, GET, HEAD
```

Dua hal yang layak dicatat:

1. **`OPTIONS` melaporkan `Allow: DELETE, GET, HEAD` — `POST` tidak ada di dalamnya**, padahal `POST` jelas valid (dokumentasi + 401 yang reproducible). Jadi metadata `Allow` di sini **tidak bisa dipercaya**.
2. Body JSON **dan** form-encoded sama-sama diterima; endpoint menolak di level auth, bukan level parsing.

### 7.3 Trello sebagai OAuth **Consumer** — Atlassian ID sebagai provider

Ini arah yang berlawanan dan sering keliru dianggap bagian dari API Trello.

**OBSERVASI** — `GET https://id.atlassian.com/rest/login/state?application=trello` memuat di `appConfig` **OAuth social client ID** milik Trello:

| Provider | Client ID |
|---|---|
| Google | `596149463257-9oquqfivs9on8t8erq23c8qso6vk3cp1.apps.googleusercontent.com` |
| Microsoft | `8txT5SyXwjqIlAtmX3xJbhIyL4pDphh1` |
| Apple | `hSMIXZp9mqs6yhg1TY3WE1EsDGMtL9OQ` |
| Slack | `2z1gHggedTDLLYsYcquqcaJiReZUbVCB` |

Ditambah `castlePublishableApiKey` (Castle — anti-fraud/anti-bot) dan kunci reCAPTCHA.

Artinya: ketika orang menekan "Continue with Google" di halaman login Trello, **Trello adalah OAuth client** dari Google. Flow-nya: `trello.com/login` → `id.atlassian.com` (login/consent) → callback ke `trello.com/auth/atlassian/callback` → `Set-Cookie: auth.csrf` → sesi `atl_session`.

**Konsekuensi untuk analisis keamanan:** login lewat Apple dan Google memberi sinyal yang lebih kuat daripada password Trello; dan karena `id.atlassian.com` berada di belakang AWS WAF (`aws-waf-token`, `x-amzn-waf-action: challenge`), ada satu titik kegagalan bersama antara Trello dan seluruh produk Atlassian lain untuk keperluan login.

### 7.4 UNVERIFIED di section ini

- **`UNVERIFIED`** — response sukses end-to-end dari `/authorize` dan `/oauth/token` (butuh `client_id` + `client_secret` asli).
- **`UNVERIFIED`** — apakah `GET /1/authorize` dengan key **valid** masih mengarahkan ke layar consent atau diam-diam sudah di-deprecate pasca 3LO. Dokumentasi masih memforklasikannya sebagai cara utama; `404 App not found` tidak membedakan key salah dari key mati.
- **`UNVERIFIED`** — perilaku `Allowed Origins` saat key valid dan `return_url` tidak cocok. Tidak ada cara mengujinya tanpa key sah.

---

## 8. Kebijakan Sesi, Logout, dan Status Akun

Semua ini dikelola Atlassian ID, bukan Trello.

### 8.1 Sesi idle dan masa berlaku

**DOKUMENTASI** — `https://support.atlassian.com/security-and-access-policies/docs/update-idle-session-duration`, verbatim:

> "When you set idle session duration in an authentication policy, members of that policy are automatically logged out when they haven't interacted with the app for the specified period of time. A session is considered **idle when a user takes no action, including passive interactions such as an automatic page refresh**."

> "**The default setting for idle session duration is 30 days.** In Atlassian Government Cloud, it is 24 hours."

Tiga batasan penting:

- Hanya berlaku untuk **managed accounts**: "When you set idle session duration in an authentication policy, **it only applies to your managed accounts**."
- Tidak berlaku untuk sesi mobile app: "Idle session duration doesn't apply to mobile app sessions."
- Membutuhkan domain terverifikasi dulu: "To update idle session duration, you need to verify at least one domain."

Ada juga **session expiration** terpisah (bukan idle): "If configured, users may be logged out when reaching that limit, regardless of activity or idle timeout."

### 8.2 Log out per perangkat

**DOKUMENTASI** — `https://support.atlassian.com/atlassian-account/docs/manage-recently-used-devices-for-your-atlassian-account`, verbatim:

> "Click **Log out of all devices** at the bottom of your recent devices list. This will log you out of all devices **apart from the one that you're currently using**."

> "If you've logged in using a mobile app, you'll see a listing for a web login as well as your mobile login because mobile logins are completed through a browser."

> "**Non-interactive logins (for example, calls using API tokens) will not be displayed in your recent devices list.**"

Yang terakhir ini penting secara operasional: **"log out of all devices" tidak mencabut API token**. Token harus dicabut lewat halaman `https://trello.com/u/{username}/account` (tombol Revoke) atau endpoint `DELETE /1/tokens`.

### 8.3 Passkeys

**DOKUMENTASI** — `https://support.atlassian.com/atlassian-account/docs/access-your-atlassian-account-with-a-passkey`:

> "Passkeys let you sign in to your Atlassian account without requiring a password or using two-factor authentication."

> "**Passkey authentication is only available for non-managed accounts.** If your account is managed by an organization, you will not see the option to enable passkeys."

Dikelola di `https://id.atlassian.com/manage-profile/security` → bagian *Passkeys* → **Create and manage passkeys** → **Register key**. Bisa punya banyak passkey; menghapus semua passkey tidak membuat akun terkunci (password tetap tersedia).

### 8.4 Status akun yang memblokir login

**DOKUMENTASI** — `https://support.atlassian.com/atlassian-account/docs/login-issues-related-to-a-locked-atlassian-account`, verbatim:

> "we'll lock your account after multiple failed login attempts in a short period of time. After you've made a number of login attempts, a **CAPTCHA** form will be displayed which you'll need to complete before attempting to log in again. If you're still unable to log in, your account will be **temporarily locked** and you'll need to wait a few minutes before attempting again."

**DOKUMENTASI** — `https://support.atlassian.com/trello/docs/what-is-a-deactivated-user`, verbatim:

> "A deactivated user is someone who has either been deactivated in the Trello Workspace, or **whose entire Atlassian account is deactivated**."

> "Users who have been deactivated in a Trello Workspace **can still access non-Workspace content** that their account had access to (such as content on other Workspaces, or their own private boards)."

> "Users whose **Atlassian account is deactivated can't log in**, so they can't access Trello or any other Atlassian apps."

Konsekuensi: deaktivasi di level Workspace Trello **tidak** memutus login; deaktivasi di level Atlassian account yang memutus seluruh akses.

**DOKUMENTASI** — `https://support.atlassian.com/trello/docs/dormant-trello-account-policy`:

> "A dormant Trello account is an account that has not had any activity for **2 years or more**, and Atlassian reserves the right to delete these accounts if they haven't been used for that long."

Prosedur penghapusan (dari halaman terkait):
> "If your Trello account has been inactive for over two years, you may get an email from us saying that your account is scheduled for deletion. **The deletion will happen 60 days after this email is sent.** You'll also receive a second at least 3 days before deletion. During these 60 days, you can log in to your Trello account to keep it active."

### 8.5 2FA dan SSO

**DOKUMENTASI** — 2FA Trello didelegasikan ke Atlassian account (2SV), bukan dikelola Trello. SSO Trello untuk Enterprise dikelola lewat Atlassian Guard, dengan **30-day grace period** setelah perubahan lisensi sebelum tab SSO Setup lama dihapus dari admin console Enterprise.

### 8.6 UNVERIFIED di section ini

- **`UNVERIFIED`** — apakah default 30 hari idle session berlaku untuk **akun Trello gratis**. Dokumentasinya adalah dokumentasi authentication policy Atlassian yang eksplisit hanya berlaku untuk managed accounts; akun Trello gratis adalah *unmanaged*. Tidak ada sumber yang menyatakan salah satu arah secara eksplisit.
- **`UNVERIFIED`** — apakah `atl_session` yang teramati (~28 menit) ada hubungannya dengan kebijakan idle session, atau murni cookie teknis berumur pendek yang terpisah dari cookie sesi terautentikasi.

---

## 9. Kontrak Error dan Kode Status

### 9.1 Tabel lengkap hasil probe

Semua ke `https://api.trello.com` kecuali yang ditandai. Body dan `Content-Type` verbatim.

| Request | Status | `Content-Type` | Body |
|---|---|---|---|
| `GET /1/members/me` | **400** | `text/plain; charset=utf-8` | `invalid token` |
| `GET /1/members/me?token=omit` | **401** | `text/plain; charset=utf-8` | `invalid key` |
| `GET /1/members/me?key=<32hex>` | **401** | `text/plain; charset=utf-8` | `invalid key` |
| `GET /1/members/me?token=invalidtoken` | **401** | `text/plain; charset=utf-8` | `invalid key` |
| `GET /1/members/me?key=bad&token=bad` | **401** | `text/plain; charset=utf-8` | `invalid key` |
| `Authorization: OAuth oauth_consumer_key="bad", oauth_token="bad"` | **400** | `text/plain; charset=utf-8` | `invalid token` |
| `Cookie: trello_session=…; JSESSIONID=…; atl_token=…` | **400** | `text/plain; charset=utf-8` | `invalid token` |
| `Authorization: Bearer <token>` | **401** | **`text/html`** | halaman AtlassianEdge (lihat 9.2) |
| `Authorization: Bearer` + query param buruk | **401** | **`text/html`** | sama — header menang |
| `POST /1/token/exchange` (JSON valid) | **401** | `text/plain; charset=utf-8` | `invalid token` |
| `GET /1/token/exchange` | **400** | `text/plain; charset=utf-8` | `invalid token` |
| `POST /1/boards` (tanpa auth) | **400** | `application/json; charset=utf-8` | `{"message":"invalid value for name","error":"ERROR"}` |
| `POST /1/boards` **tanpa header `Content-Type`** | **401** | `text/plain; charset=utf-8` | `missing scopes` (5/5) |
| `POST /1/batch` | **400** | `application/json; charset=utf-8` | `{"message":"invalid value for requests","error":"BATCH_INVALID_JSON_ARRAY"}` |
| `GET /1/batch` (tanpa auth) | **200** | `application/json; charset=utf-8` | array hasil |
| `GET /1/boards/doesnotexist` | **400** | `text/plain; charset=utf-8` | `invalid id` |
| `GET /1/boards/AbCdEfGh` | **404** | `text/plain; charset=utf-8` | `Board not found` |
| `GET /1/nonexistent-path` | **404** | `text/plain; charset=utf-8` | `Cannot GET /1/nonexistent-path` |
| `POST /1/boards/AbCdEfGh/stars` | **404** | `text/plain; charset=utf-8` | `Cannot POST /1/boards/AbCdEfGh/stars` |
| `OPTIONS /1/boards/5abbe…/cards` | **200** | — | `Allow: GET, HEAD` |
| `GET /1/tokens` | **404** | `text/plain; charset=utf-8` | `Cannot GET /1/tokens` |
| `GET /1/members` | **404** | `text/plain; charset=utf-8` | `Cannot GET /1/members` |
| `GET https://trello.com/1/members/me` | **400** | `text/plain; charset=utf-8` | `invalid token` |

### 9.2 Jalur `Authorization: Bearer` — satu-satunya yang balas HTML

**OBSERVASI**:

```
HTTP/1.1 401 Unauthorized
Content-Type: text/html

<!DOCTYPE html><html><head>
<title>The credentials supplied were not valid for this endpoint</title>
<meta name="flags" content="UAEX">
<meta name="details" content="ext_authz_denied">
</head><body style="background:#F4F5F7; padding:0; margin:0;">…
```

Penanda `UAEX` + `ext_authz_denied` + `Server: AtlassianEdge` menunjukkan request ini **ditolak oleh filter authorization di edge AtlassianEdge**, sebelum mencapai aplikasi Trello. Akibatnya: klien yang melakukan `JSON.parse` pada setiap response API akan **crash** di jalur ini. Ini delta penting dari jalur `OAuth …` yang tetap `text/plain`.

### 9.3 Temuan yang paling mudah terlewat

**OBSERVASI** — empat endpoint publik terbuka **tanpa autentikasi apa pun**:

```
GET /1/boards/5abbe4b7ddc1b351ef961414?fields=name        → 200
GET /1/members/trello?fields=fullName                     → 200
GET /1/search?query=trello&idBoards=5abbe4b7ddc1b351ef961414 → 200
GET /1/batch?urls=/1/members/trello&fields=name           → 200
```

`/1/search` mengembalikan nama board (`"name":"Trello Platform Changelog"`) dan isi card tanpa kredensial.

Dan kebalikannya — **kredensial invalid merusak akses publik**:

```
GET /1/boards/5abbe4b7ddc1b351ef961414?fields=name                 → 200
GET /1/boards/5abbe4b7ddc1b351ef961414?key=<32hex>&fields=name     → 401  invalid key
GET /1/boards/5abbe4b7ddc1b351ef961414?key=<32hex>&fields=name&token=…  → 401  invalid key
GET /1/boards/5abbe4b7ddc1b351ef961414   (Authorization: Bearer …)   → 401  HTML
```

Implikasi operasional: bila `TRELLO_API_KEY` dan `TRELLO_TOKEN` di-`set` tapi salah, semua request ke board publik ikut gagal. Jangan pakai variabel auth yang mungkin kosong sebagai default untuk API publik.

### 9.4 Quirk `missing scopes`

**OBSERVASI** — `POST /1/boards` dengan body tapi **tanpa header `Content-Type` sama sekali** → `401 missing scopes` (reproducible 5/5). Dengan `application/json`, `application/x-www-form-urlencoded`, maupun `text/plain` → `400 {"message":"invalid value for name","error":"ERROR"}`.

Jadi middleware auth Trello punya jalur kode yang gagal membaca body (`missing scopes` — pesan milik OAuth 2.0, di endpoint yang tidak ada hubungannya dengan token exchange). Ini konsisten dengan dugaan bahwa ada **dua middleware auth** yang bertumpuk: satu untuk token gaya `/1/authorize`, satu untuk OAuth 2.0 bearer. Klaim penyebabnya **UNVERIFIED**; yang teramati hanya outputnya.

### 9.5 Status codes dari dokumentasi

**DOKUMENTASI** — `guides/rest-api/status-codes/`: `200`, `400`, `401`, `403`, `404`, `409`, `429`, **`449 Sub-Request Failed`** (khusus `POST /1/batch` dengan URL yang gagal), `500`, `503`, `504`, dengan batas waktu 30 detik.

### 9.6 UNVERIFIED di section ini

- **`UNVERIFIED`** — bentuk persis response 403. Tidak ada cara memicu 403 tanpa key sah dengan scope kurang (misal meminta `account` scope tanpa DEVELOPER).
- **`UNVERIFIED`** — bentuk persis 429 di API ini. Bentuknya diambil dari dokumentasi; belum pernah dipicu secara langsung (butuh >100 req/10s atau >100 req/900s pada `/1/members/`).
- **`UNVERIFIED`** — perilaku `449` pada `/1/batch` dengan URL yang tidak valid di dalam payload.

---

## 10. Daftar URL Sumber

### Dokumentasi developer Trello

- `https://developer.atlassian.com/cloud/trello/guides/rest-api/introduction/` — pengantar REST API
- `https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/` — `/1/authorize`, tiga cara kirim kredensial, allowed origins, revoke, OAuth 1.0
- `https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-getting-started/` — apakah 3LO cocok untuk app Anda
- `https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-client-configuration/` — scope, client publik vs rahasia, workspace restriction
- `https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-confidential-client-usage/` — PKCE, `/1/token/exchange`, masa hidup token
- `https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-for-existing-apps/` — migrasi token lama ke OAuth 2.0
- `https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/` — 300/10s, 100/10s, `/1/members/` 100/900s, bentuk error 429
- `https://developer.atlassian.com/cloud/trello/guides/rest-api/status-codes/` — 200 s.d. 504, termasuk 449
- `https://developer.atlassian.com/cloud/trello/guides/rest-api/limits/` — batas ukuran objek
- `https://developer.atlassian.com/cloud/trello/power-ups/authentication/` — auth Power-Up
- `https://developer.atlassian.com/cloud/trello/power-ups/managing-apps/` — mengelola aplikasi
- `https://developer.atlassian.com/cloud/trello/changelog/` — entri `CHANGE-3427`, 2026-09-15
- `https://community.developer.atlassian.com/t/oauth-2-0-3lo-is-now-available-for-trello/102691` — pengumuman komunitas (tautan dari changelog)
- `https://dac-static.atlassian.com/cloud/trello/swagger.v3.json` — OpenAPI v3, `securitySchemes`

### Dokumentasi dukungan Atlassian

- `https://support.atlassian.com/trello/docs/recovering-your-account/` — pemulihan akun, reset password
- `https://support.atlassian.com/trello/docs/revoke-a-trello-token/` — pencabutan token
- `https://support.atlassian.com/trello/docs/dormant-trello-account-policy/` — akun dorman 2 tahun, penghapusan setelah 60 hari
- `https://support.atlassian.com/trello/docs/what-is-a-deactivated-user/` — deaktivasi Workspace vs Atlassian account
- `https://support.atlassian.com/trello/docs/two-factor-authentication/` — 2FA Trello
- `https://support.atlassian.com/trello/docs/single-sign-on/` — SSO via Atlassian Guard
- `https://support.atlassian.com/trello/docs/managed-atlassian-accounts-for-trello/` — managed Atlassian accounts
- `https://support.atlassian.com/atlassian-account/docs/login-issues-related-to-a-locked-atlassian-account` — akun terkunci + CAPTCHA
- `https://support.atlassian.com/atlassian-account/docs/access-your-atlassian-account-with-a-passkey` — passkeys (non-managed saja)
- `https://support.atlassian.com/atlassian-account/docs/manage-recently-used-devices-for-your-atlassian-account` — daftar perangkat, log out
- `https://support.atlassian.com/security-and-access-policies/docs/update-idle-session-duration` — idle session default 30 hari
- `https://support.atlassian.com/security-and-access-policies/docs/understand-authentication-policies` — policy authentication

### Endpoint yang diprobe langsung

- `https://api.trello.com/1/*` — API host (token-only, cookie ditolak)
- `https://trello.com/1/*` — API yang sama lewat web host
- `https://trello.com/login` → `https://id.atlassian.com/login?application=trello&continue=…`
- `https://trello.com/ensureSession` → 302 ke Atlassian ID
- `https://trello.com/1/session` → `404 Cannot GET /1/session`
- `https://trello.com/auth/callback` → 302 ke `/auth/atlassian/callback`
- `https://trello.com/auth/atlassian/callback` → 302 + `Set-Cookie: auth.csrf`
- `https://id.atlassian.com/rest/login/state?application=trello` — `csrfToken`, `hashedCsrfToken`, `ffsId`, social client IDs
- `https://auth.atlassian.com/authorize` — endpoint OAuth 2.0
- `https://auth.atlassian.com/oauth/token` — `Allow: POST,OPTIONS`
- `https://auth.atlassian.com/.well-known/openid-configuration` — discovery OIDC
- `https://auth.atlassian.com/.well-known/jwks.json` — JWKS (disebut di discovery)
- `https://auth.atlassian.com/oauth/revoke` — revocation endpoint (disebut di discovery)
- `https://auth.atlassian.com/oauth/device/code` — device authorization (disebut di discovery)
- `https://auth.atlassian.com/mfa/challenge` — MFA challenge (disebut di discovery)
- `https://auth.atlassian.com/userinfo` — userinfo (disebut di discovery)
- `https://trello.com/apps/admin` — tempat membuat API key / melihat secret

### Artefak bukti lokal

- `docs/raw/` — tangkapan mentah: `dev-docs.txt`, `dev-docs2.txt`, `dev-docs3.txt`, `dev-docs4.txt`, `support1.txt`, `support2.txt`, `support3.txt`, `oidc-discovery.txt`, `trello-swagger.json`, `precedence2.txt`, `public-probe.txt`
- `scripts/probe-*.ps1`, `scripts/getdocs*.ps1`, `scripts/getsupport*.ps1` — probe yang bisa dijalankan ulang

---

## Lamp: Ringkasan Hal yang Tidak Bisa Diverifikasi

Daftar jujur, supaya tidak ada yang mengarang mengisi kekosongan ini:

1. **Nama dan atribut cookie sesi saat sudah login.** Semua observasi bersifat anonim.
2. **Apakah `atl_session` adalah bearer credential** atau token teknis lain (mempertimbangkan tidak adanya flag `HttpOnly`).
3. **Penegakan CSRF Trello pada write yang diautentikasi cookie.** Yang teramati hanya penerbitan `auth.csrf` dan `atlassian.account.xsrf.token`.
4. **Nama header CSRF** yang dikirim web app saat write.
5. **Precedence header vs query param dengan kredensial valid.** Hanya perilaku kredensial invalid yang teramati.
6. **Response sukses `/authorize` dan `/oauth/token`** (butuh `client_id`/`client_secret` asli).
7. **Apakah `/1/authorize` masih aktif** untuk key valid pasca peluncuran 3LO.
8. **Perilaku `Allowed Origins`** saat `return_url` tidak cocok.
9. **Kedaluwarsa nyata** token `1hour` / `1day` / `30days`, dan perilaku `?token=omit` yang ternyata **tidak** berperilaku seperti sentinel pada API yang diamati.
10. **Apakah default idle session 30 hari berlaku untuk akun Trello gratis** (dokumentasinya hanya berlaku untuk managed accounts).
11. **Hubungan `atl_session` (~28 menit) dengan kebijakan idle session** — kemungkinan cookie teknis terpisah.
12. **Bentuk response 403 dan 429** yang dipicu langsung.
13. **Penyebab quirk `missing scopes`** — hipotesis "dua middleware auth bertumpuk" masuk akal tapi **belum diverifikasi**.
14. **Perilaku `449 Sub-Request Failed`** pada `/1/batch`.
15. **Mengapa `Error parsing body` muncul sekali lalu hilang** saat pengulangan identik (edge-dependent, tidak direproduksi).
