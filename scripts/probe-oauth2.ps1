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
  foreach ($l in $hl) { if ($l -match '(?i)^(set-cookie|location|content-type|allow|www-authenticate|retry-after):') { Write-Output "H: $($l.Trim())" } }
  $body = if ($parts.Count -gt 1) { ($parts[1] -replace '\s+',' ').Trim() } else { '' }
  Write-Output "BODY: $($body.Substring(0,[Math]::Min(400,$body.Length)))"
  Write-Output ""
}
$FAKE32 = '0123456789abcdef0123456789abcdef'
$FAKE64 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

# --- D: token/exchange content-type / verb matrix
Probe -Label "D1 POST /1/token/exchange form-encoded" -Curl @(
  "-X","POST","-H","Content-Type: application/x-www-form-urlencoded",
  "-d","grant_type=authorization_code&code=bogus&client_id=$FAKE32&client_secret=$FAKE64",
  "https://api.trello.com/1/token/exchange"
)
Probe -Label "D2 POST /1/token/exchange no body at all" -Curl @("-X","POST","https://api.trello.com/1/token/exchange")
Probe -Label "D3 GET /1/token/exchange" -Curl @("https://api.trello.com/1/token/exchange")
Probe -Label "D4 DELETE /1/token/exchange" -Curl @("-X","DELETE","https://api.trello.com/1/token/exchange")
Probe -Label "D5 POST /1/token/exchange JSON client_credentials grant" -Curl @(
  "-X","POST","-H","Content-Type: application/json",
  "-d","{`"grant_type`":`"client_credentials`",`"client_id`":`"$FAKE32`",`"client_secret`":`"$FAKE64`"}",
  "https://api.trello.com/1/token/exchange"
)
# --- E: auth.atlassian.com token endpoint semantics
Probe -Label "E1 POST /oauth/token client_credentials (fake)" -Curl @(
  "-X","POST","-H","Content-Type: application/json",
  "-d","{`"grant_type`":`"client_credentials`",`"client_id`":`"$FAKE32`",`"client_secret`":`"$FAKE64`"}",
  "https://auth.atlassian.com/oauth/token"
)
Probe -Label "E2 POST /oauth/token refresh_token (fake)" -Curl @(
  "-X","POST","-H","Content-Type: application/json",
  "-d","{`"grant_type`":`"refresh_token`",`"client_id`":`"$FAKE32`",`"client_secret`":`"$FAKE64`",`"refresh_token`":`"bogus`"}",
  "https://auth.atlassian.com/oauth/token"
)
Probe -Label "E3 POST /oauth/token bad client_secret only" -Curl @(
  "-X","POST","-H","Content-Type: application/json",
  "-d","{`"grant_type`":`"authorization_code`",`"client_id`":`"$FAKE32`",`"client_secret`":`"wrong`",`"code`":`"bogus`",`"redirect_uri`":`"https://example.com/cb`"}",
  "https://auth.atlassian.com/oauth/token"
)
Probe -Label "E4 GET auth.atlassian.com/authorize no params" -Curl @("https://auth.atlassian.com/authorize")
Probe -Label "E5 OPTIONS auth.atlassian.com/authorize" -Curl @("-X","OPTIONS","https://auth.atlassian.com/authorize")
Probe -Label "E6 GET auth.atlassian.com/.well-known/openid-configuration" -Curl @("https://auth.atlassian.com/.well-known/openid-configuration")
# --- F: does the web app expose any CSRF header/token on /1/ writes?
Probe -Label "F1 POST /1/boards (web host, cookie-ish UA, no creds)" -Curl @(
  "-X","POST","-H","Content-Type: application/json","-d","{`"name`":`"probe`"}","https://trello.com/1/boards"
)
Probe -Label "F2 GET /1/members/me with X-Atlassian-Token style headers (no creds)" -Curl @(
  "-H","X-Atlassian-Token: no-check","-H","X-Requested-With: XMLHttpRequest","https://trello.com/1/members/me"
)
# --- G: auth.csrf cookie path scope
Probe -Label "G1 GET /auth/atlassian/callback?traceId=x (auth.csrf reissue)" -Curl @("https://trello.com/auth/atlassian/callback?traceId=abc")
Probe -Label "G2 GET /auth/callback (legacy path?)" -Curl @("https://trello.com/auth/callback")