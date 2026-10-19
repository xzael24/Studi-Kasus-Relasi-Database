$ErrorActionPreference='Continue'
$UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
function Probe {
  param([string]$Label,[string[]]$Curl)
  Write-Output "==== $Label"
  $a = @('-sS','-i','--max-time','25','-A',$UA) + $Curl
  $t = ((& curl.exe @a 2>&1) -join "`n")
  $parts = $t -split "`r?`n`r?`n",2
  $hl = $parts[0] -split "`r?`n"
  Write-Output "STATUS: $($hl[0].Trim())"
  foreach ($l in $hl) { if ($l -match '(?i)^(set-cookie|location|content-type|allow|www-authenticate|retry-after|x-ratelimit-[a-z0-9-]+):') { Write-Output "H: $($l.Trim())" } }
  $body = if ($parts.Count -gt 1) { ($parts[1] -replace '\s+',' ').Trim() } else { '' }
  Write-Output "BODY: $($body.Substring(0,[Math]::Min(400,$body.Length)))"
  Write-Output ""
}
$FAKE32 = '0123456789abcdef0123456789abcdef'
$FAKE64 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

# --- C1: legacy /1/authorize with a syntactically valid but fake key
Probe -Label "C1 GET /1/authorize (fake 32-hex key, response_type=token)" -Curl @(
  "https://trello.com/1/authorize?expiration=never&name=Probe&scope=read&response_type=token&return_url=https%3A%2F%2Fexample.com%2Fcb&key=$FAKE32"
)
# --- C2: /1/authorize with malformed key
Probe -Label "C2 GET /1/authorize (malformed key)" -Curl @(
  "https://trello.com/1/authorize?expiration=never&name=Probe&scope=read&response_type=token&return_url=https%3A%2F%2Fexample.com%2Fcb&key=nothex"
)
# --- C3: OAuth 1.0a legacy endpoints
Probe -Label "C3 GET /1/OAuthGetRequestToken" -Curl @(
  "https://trello.com/1/OAuthGetRequestToken?oauth_callback=oob&oauth_consumer_key=$FAKE32&oauth_nonce=abc123&oauth_signature_method=HMAC-SHA1&oauth_timestamp=1790833000&oauth_version=1.0"
)
Probe -Label "C4 GET /1/OAuthGetAccessToken" -Curl @(
  "https://trello.com/1/OAuthGetAccessToken?oauth_token=faketoken&oauth_consumer_key=$FAKE32&oauth_nonce=abc123&oauth_signature_method=HMAC-SHA1&oauth_timestamp=1790833000&oauth_version=1.0"
)
# --- C5/C6: OAuth 2.0 3LO endpoints on auth.atlassian.com
Probe -Label "C5 GET auth.atlassian.com/authorize (fake client_id)" -Curl @(
  "https://auth.atlassian.com/authorize?audience=api.trello.com&client_id=$FAKE32&scope=read%3Aboard%3Atrello&redirect_uri=https%3A%2F%2Fexample.com%2Fcb&state=xyz&response_type=code&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256"
)
Probe -Label "C6 POST auth.atlassian.com/oauth/token (fake creds, no code)" -Curl @(
  "-X","POST","-H","Content-Type: application/json",
  "-d","{`"grant_type`":`"authorization_code`",`"client_id`":`"$FAKE32`",`"client_secret`":`"$FAKE64`",`"code`":`"bogus`",`"code_verifier`":`"dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`",`"redirect_uri`":`"https://example.com/cb`"}",
  "https://auth.atlassian.com/oauth/token"
)
Probe -Label "C7 POST auth.atlassian.com/oauth/token (empty body)" -Curl @(
  "-X","POST","-H","Content-Type: application/json","-d","{}","https://auth.atlassian.com/oauth/token"
)
# --- C8: /1/token/exchange with valid-shaped JSON
Probe -Label "C8 POST api.trello.com/1/token/exchange (well-formed JSON, bogus grant)" -Curl @(
  "-X","POST","-H","Content-Type: application/json",
  "-d","{`"grant_type`":`"authorization_code`",`"code`":`"bogus`",`"client_id`":`"$FAKE32`",`"client_secret`":`"$FAKE64`",`"redirect_uri`":`"https://example.com/cb`",`"code_verifier`":`"dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`"}",
  "https://api.trello.com/1/token/exchange"
)
# --- C9: OPTIONS on the 2LO endpoints (method/verb surface)
Probe -Label "C9 OPTIONS auth.atlassian.com/oauth/token" -Curl @("-X","OPTIONS","https://auth.atlassian.com/oauth/token")
Probe -Label "C10 OPTIONS api.trello.com/1/token/exchange" -Curl @("-X","OPTIONS","https://api.trello.com/1/token/exchange")