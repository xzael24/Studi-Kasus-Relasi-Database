$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

function Probe {
  param([string]$Url, [string]$Label, [string[]]$Extra = @())
  Write-Output "==== $Label"
  $a = @('-sS','-i','--max-time','25','-A',$UA) + $Extra + @($Url)
  $out = & curl.exe @a 2>&1
  $text = ($out -join "`n")
  $parts = $text -split "`n`n", 2
  $hdr = $parts[0]
  $body = if ($parts.Count -gt 1) { $parts[1] } else { '' }
  $hl = $hdr -split "`n"
  Write-Output "STATUS: $($hl[0].Trim())"
  foreach ($l in $hl) { if ($l -match '^(?i)(content-type|set-cookie|location|x-rate-limit-api-key|x-rate-limit-api-token|retry-after|access-control-|www-authenticate|strict-transport|x-trello-|x-cache|allow):') { Write-Output "H: $($l.Trim())" } }
  if ($body.Length -gt 220) { $body = $body.Substring(0,220) + "...[cut]" }
  Write-Output "BODY: $($body.Trim())"
  Write-Output ""
}

Probe -Url "https://api.trello.com/1/boards/5abbe4b7ddc1b351ef961414?fields=id,name,url" -Label "Y1 public board no auth"
Probe -Url "https://api.trello.com/1/members/trello?fields=id,username,fullName" -Label "Y2 public member no auth"
Probe -Url "https://api.trello.com/1/boards/5abbe4b7ddc1b351ef961414/cards" -Label "Y3 public board cards no auth"
Probe -Url "https://api.trello.com/1/boards/5abbe4b7ddc1b351ef961414/cards" -Label "Y4 POST card no auth" -Extra @('-X','POST')
Probe -Url "https://api.trello.com/1/members/me/boards?key=badkey&token=badtoken" -Label "Y5 me/boards bad auth"
Probe -Url "https://api.trello.com/1/boards/5abbe4b7ddc1b351ef961414/cards" -Label "Y6 OPTIONS preflight" -Extra @('-X','OPTIONS')
Probe -Url "https://trello.com/1/members/me" -Label "Y7 trello.com/1 host variant"
Probe -Url "https://api.trello.com/1/swagger.json" -Label "Y8 swagger path"
Probe -Url "https://api.trello.com/1/token/exchange" -Label "Y9 token exchange no auth" -Extra @('-X','POST','-H','Content-Type: application/json','-d','{"scopes":["read:board:trello"]}')