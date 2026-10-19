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

# L: request body encoding matrix on a write endpoint
Probe -Label "L1 POST /1/boards  form  name=probe"        -Curl @("-X","POST",$F,"-d","name=probe","https://api.trello.com/1/boards")
Probe -Label "L2 POST /1/boards  json  {name:probe}"      -Curl @("-X","POST",$J,"-d","{`"name`":`"probe`"}","https://api.trello.com/1/boards")
Probe -Label "L3 POST /1/boards  json  {} "               -Curl @("-X","POST",$J,"-d","{}","https://api.trello.com/1/boards")
Probe -Label "L4 POST /1/boards  form  (empty)"           -Curl @("-X","POST",$F,"-d","","https://api.trello.com/1/boards")
Probe -Label "L5 POST /1/boards  no content-type, raw"    -Curl @("-X","POST","-d","name=probe","https://api.trello.com/1/boards")
Probe -Label "L6 POST /1/boards  json array []"           -Curl @("-X","POST",$J,"-d","[]","https://api.trello.com/1/boards")

# M: token/exchange body schema probing
Probe -Label "M1 POST /1/token/exchange json {foo:bar}"        -Curl @("-X","POST",$J,"-d","{`"foo`":`"bar`"}","https://api.trello.com/1/token/exchange")
Probe -Label "M2 POST /1/token/exchange json {scopes:[]}"      -Curl @("-X","POST",$J,"-d","{`"scopes`":[]}","https://api.trello.com/1/token/exchange")
Probe -Label "M3 POST /1/token/exchange json {scopes:str}"     -Curl @("-X","POST",$J,"-d","{`"scopes`":`"read:board:trello`"}","https://api.trello.com/1/token/exchange")
Probe -Label "M4 POST /1/token/exchange form scopes (csv)"     -Curl @("-X","POST",$F,"-d","scopes=read:board:trello","https://api.trello.com/1/token/exchange")
Probe -Label "M5 POST /1/token/exchange json {idOrganization}" -Curl @("-X","POST",$J,"-d","{`"idOrganization`":`"538627f73cbb44d1bfbb58f0`"}","https://api.trello.com/1/token/exchange")

# N: batch body encoding
Probe -Label "N1 POST /1/batch form urls=/1/members/trello" -Curl @("-X","POST",$F,"-d","urls=/1/members/trello","https://api.trello.com/1/batch")
Probe -Label "N2 POST /1/batch json {urls:[...]}"          -Curl @("-X","POST",$J,"-d","{`"urls`":[`"/1/members/trello`"]}","https://api.trello.com/1/batch")
Probe -Label "N3 GET  /1/batch?urls=/1/members/trello&fields=name" -Curl @("https://api.trello.com/1/batch?urls=/1/members/trello&fields=name")