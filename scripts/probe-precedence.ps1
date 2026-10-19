$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

function Probe {
  param([string]$Url, [string]$Label, [string[]]$Extra = @())
  Write-Output "==== $Label"
  $a = @('-sS','-i','--max-time','25','-A',$UA) + $Extra + @($Url)
  $out = & curl.exe @a 2>&1
  $text = ($out -join "`n")
  # only keep status line + a few relevant headers + body
  $lines = $text -split "`n"
  $keep = @()
  foreach ($l in $lines) {
    if ($l -match '^(HTTP/|Set-Cookie:|Location:|WWW-Authenticate:|Content-Type:|x-rate-limit|Retry-After|x-amzn-waf)') { $keep += $l.TrimEnd() }
  }
  $bodyIdx = $text.IndexOf("`r`n`r`n")
  $body = if ($bodyIdx -ge 0) { $text.Substring($bodyIdx+4) } else { $text }
  if ($body.Length -gt 400) { $body = $body.Substring(0,400) + " ...[cut]" }
  Write-Output ($keep -join "`n")
  Write-Output "BODY: $body"
  Write-Output ""
}

# precedence tests
Probe -Url "https://api.trello.com/1/members/me?key=invalidkey&token=invalidtoken" -Label "P1 query only" -Extra @('-H','Authorization: Bearer invalidtoken123')
Probe -Url "https://api.trello.com/1/members/me" -Label "P2 cookie only (fake trello_session)" -Extra @('-H','Cookie: trello_session=abc123; JSESSIONID=xyz; atl_token=q')
Probe -Url "https://api.trello.com/1/members/me" -Label "P3 header OAuth 1.0 style" -Extra @('-H','Authorization: OAuth oauth_consumer_key="invalidkey", oauth_token="invalidtoken"')
Probe -Url "https://api.trello.com/1/members/me" -Label "P4 only key, no token" -Extra @('-H','X-Probe: 1')
Probe -Url "https://api.trello.com/1/members/me?key=invalidkey" -Label "P5 key only"
Probe -Url "https://api.trello.com/1/members/me?token=invalidtoken" -Label "P6 token only"
Probe -Url "https://api.trello.com/1/boards/AbCdEfGh/lists" -Label "P7 public-ish read no auth"
Probe -Url "https://api.trello.com/1/tokens/000000000000000000000000" -Label "P8 DELETE token route (GET)"
Probe -Url "https://api.trello.com/1/batch" -Label "P9 GET batch"