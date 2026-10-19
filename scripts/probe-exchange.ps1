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
  foreach ($l in $hl) { if ($l -match '(?i)^(set-cookie|location|content-type|allow|retry-after|x-ratelimit-[a-z0-9-]+):') { Write-Output "H: $($l.Trim())" } }
  $body = if ($parts.Count -gt 1) { ($parts[1] -replace '\s+',' ').Trim() } else { '' }
  Write-Output "BODY: $($body.Substring(0,[Math]::Min(400,$body.Length)))"
  Write-Output ""
}
$FAKE32 = '0123456789abcdef0123456789abcdef'

# H: is "Error parsing body" a schema error that precedes auth?
Probe -Label "H1 POST /1/token/exchange JSON with scopes array, no auth" -Curl @(
  "-X","POST","-H","Content-Type: application/json",
  "-d","{`"scopes`":[`"read:board:trello`",`"write:board:trello`"]}",
  "https://api.trello.com/1/token/exchange"
)
Probe -Label "H2 POST /1/token/exchange JSON scopes + fake key/token in query" -Curl @(
  "-X","POST","-H","Content-Type: application/json",
  "-d","{`"scopes`":[`"read:board:trello`"]}",
  "https://api.trello.com/1/token/exchange?key=$FAKE32&token=0123456789abcdef0123456789abcdef"
)
Probe -Label "H3 POST /1/token/exchange JSON scopes + OAuth header" -Curl @(
  "-X","POST","-H","Content-Type: application/json",
  "-H","Authorization: OAuth oauth_consumer_key=`"$FAKE32`", oauth_token=`"0123456789abcdef0123456789abcdef`"",
  "-d","{`"scopes`":[`"read:board:trello`"]}",
  "https://api.trello.com/1/token/exchange"
)
Probe -Label "H4 POST /1/token/exchange JSON empty object {}" -Curl @(
  "-X","POST","-H","Content-Type: application/json","-d","{}","https://api.trello.com/1/token/exchange"
)
Probe -Label "H5 POST /1/token/exchange JSON malformed (truncated)" -Curl @(
  "-X","POST","-H","Content-Type: application/json","-d","{`"scopes`":[","https://api.trello.com/1/token/exchange"
)
# I: /1/batch contract + special-rate-limit routes
Probe -Label "I1 GET /1/batch (no auth)" -Curl @("https://api.trello.com/1/batch?urls=/1/members/trello")
Probe -Label "I2 POST /1/batch valid urls, no auth" -Curl @(
  "-X","POST","-H","Content-Type: application/json","-d","{`"urls`":[`"/1/members/trello`"]}","https://api.trello.com/1/batch"
)
Probe -Label "I3 GET /1/members (special rate-limit route, no auth)" -Curl @("https://api.trello.com/1/members")
Probe -Label "I4 GET /1/membersSearch (special route, no auth)" -Curl @("https://api.trello.com/1/membersSearch?query=trello")
Probe -Label "I5 GET /1/search (special route, no auth)" -Curl @("https://api.trello.com/1/search?query=trello&idBoards=5abbe4b7ddc1b351ef961414")
# J: is a public board readable with a *bad* key supplied? (does key gate public reads)
Probe -Label "J1 GET public board with bad key+token" -Curl @("https://api.trello.com/1/boards/5abbe4b7ddc1b351ef961414?key=$FAKE32&token=0123456789abcdef0123456789abcdef&fields=name")
Probe -Label "J2 GET public board with bad key only" -Curl @("https://api.trello.com/1/boards/5abbe4b7ddc1b351ef961414?key=$FAKE32&fields=name")
Probe -Label "J3 GET public board with Bearer bad token" -Curl @("-H","Authorization: Bearer 0123456789abcdef0123456789abcdef","https://api.trello.com/1/boards/5abbe4b7ddc1b351ef961414?fields=name")
# K: scope introspection / member token listing
Probe -Label "K1 GET /1/tokens (list my tokens, no auth)" -Curl @("https://api.trello.com/1/tokens")
Probe -Label "K2 GET /1/members/me/tokens (no auth)" -Curl @("https://api.trello.com/1/members/me/tokens")