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
  foreach ($l in $hl) { if ($l -match '(?i)^(content-type|allow):') { Write-Output "H: $($l.Trim())" } }
  $body = if ($parts.Count -gt 1) { ($parts[1] -replace '\s+',' ').Trim() } else { '' }
  Write-Output "BODY: $($body.Substring(0,[Math]::Min(300,$body.Length)))"
  Write-Output ""
}
$J = '-H','Content-Type: application/json'
$F = '-H','Content-Type: application/x-www-form-urlencoded'

# P: host parity — identical body on trello.com vs api.trello.com
Probe -Label "P1 POST trello.com/1/boards   json {name:probe}" -Curl @("-X","POST",$J,"-d","{`"name`":`"probe`"}","https://trello.com/1/boards")
Probe -Label "P2 POST api.trello.com/1/boards json {name:probe}" -Curl @("-X","POST",$J,"-d","{`"name`":`"probe`"}","https://api.trello.com/1/boards")
Probe -Label "P3 POST trello.com/1/boards   form name=probe"   -Curl @("-X","POST",$F,"-d","name=probe","https://trello.com/1/boards")
Probe -Label "P4 POST trello.com/1/token/exchange json {scopes:[read]}" -Curl @("-X","POST",$J,"-d","{`"scopes`":[`"read:board:trello`"]}","https://trello.com/1/token/exchange")
Probe -Label "P5 POST api.trello.com/1/token/exchange json {scopes:[read]}" -Curl @("-X","POST",$J,"-d","{`"scopes`":[`"read:board:trello`"]}","https://api.trello.com/1/token/exchange")

# Q: token/exchange scopes variants on api host
Probe -Label "Q1 {scopes:[read]}"          -Curl @("-X","POST",$J,"-d","{`"scopes`":[`"read:board:trello`"]}","https://api.trello.com/1/token/exchange")
Probe -Label "Q2 {scopes:[bogus]}"        -Curl @("-X","POST",$J,"-d","{`"scopes`":[`"bogus`"]}","https://api.trello.com/1/token/exchange")
Probe -Label "Q3 {scopes:[read,write]}"    -Curl @("-X","POST",$J,"-d","{`"scopes`":[`"read:board:trello`",`"write:board:trello`"]}","https://api.trello.com/1/token/exchange")
Probe -Label "Q4 {scopes:[123]}"          -Curl @("-X","POST",$J,"-d","{`"scopes`":[123]}","https://api.trello.com/1/token/exchange")
Probe -Label "Q5 {scopes:null}"            -Curl @("-X","POST",$J,"-d","{`"scopes`":null}","https://api.trello.com/1/token/exchange")
Probe -Label "Q6 {scopes:['']}"            -Curl @("-X","POST",$J,"-d","{`"scopes`":[``]}","https://api.trello.com/1/token/exchange")
Probe -Label "Q7 {scopes:[offline_access]}" -Curl @("-X","POST",$J,"-d","{`"scopes`":[`"offline_access`"]}","https://api.trello.com/1/token/exchange")