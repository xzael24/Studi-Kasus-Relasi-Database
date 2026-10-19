$ErrorActionPreference='Continue'
$UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
function Probe {
  param([string]$Label,[string[]]$Curl)
  $a = @('-sS','-i','--max-time','25','-A',$UA) + $Curl
  $t = ((& curl.exe @a 2>&1) -join "`n")
  $parts = $t -split "`r?`n`r?`n",2
  $hl = $parts[0] -split "`r?`n"
  $body = if ($parts.Count -gt 1) { ($parts[1] -replace '\s+',' ').Trim() } else { '' }
  Write-Output "$Label => $($hl[0].Trim()) | $body"
}
$J = '-H','Content-Type: application/json'
Write-Output "--- reproducibility of 'Error parsing body' (5x identical JSON to /1/token/exchange)"
1..5 | ForEach-Object { Probe -Label "run$_" -Curl @("-X","POST",$J,"-d","{`"scopes`":[`"read:board:trello`"]}","https://api.trello.com/1/token/exchange") }
Write-Output "--- POST /1/boards with no Content-Type (5x)"
1..5 | ForEach-Object { Probe -Label "run$_" -Curl @("-X","POST","-d","name=probe","https://api.trello.com/1/boards") }
Write-Output "--- POST /1/boards with Content-Type: text/plain (2x)"
Probe -Label "text/plain" -Curl @("-X","POST","-H","Content-Type: text/plain","-d","name=probe","https://api.trello.com/1/boards")
Probe -Label "text/plain+json" -Curl @("-X","POST","-H","Content-Type: text/plain","-d","{`"name`":`"probe`"}","https://api.trello.com/1/boards")
Write-Output "--- GET /1/members/me variants"
Probe -Label "no params" -Curl @("https://api.trello.com/1/members/me")
Probe -Label "token=omit" -Curl @("https://api.trello.com/1/members/me?token=omit")
Probe -Label "key only" -Curl @("https://api.trello.com/1/members/me?key=0123456789abcdef0123456789abcdef")