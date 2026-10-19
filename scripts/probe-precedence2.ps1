$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
$tmp = [System.IO.Path]::GetTempFileName()

function Probe {
  param([string]$Url, [string]$Label, [string[]]$Extra = @())
  $a = @('-sS','-i','--max-time','25','-A',$UA) + $Extra + @($Url)
  $out = & curl.exe @a 2>&1
  $text = ($out -join "`n")
  Write-Output "==== $Label"
  $parts = $text -split "`n`n", 2
  $hdr = $parts[0]
  $body = if ($parts.Count -gt 1) { $parts[1] } else { '' }
  $status = ($hdr -split "`n")[0].Trim()
  $ct = (($hdr -split "`n") | Where-Object { $_ -match '^(?i)Content-Type:' } | Select-Object -First 1)
  $rl = (($hdr -split "`n") | Where-Object { $_ -match '^(?i)x-rate-limit' })
  Write-Output "STATUS: $status"
  if ($ct) { Write-Output "CT: $($ct.Trim())" }
  foreach ($r in $rl) { Write-Output "RL: $($r.Trim())" }
  if ($body.Length -gt 300) { $body = $body.Substring(0,300) + "...[cut]" }
  Write-Output "BODY: $($body.Trim())"
  Write-Output ""
}

Probe -Url "https://api.trello.com/1/members/me" -Label "X0 no auth"
Probe -Url "https://api.trello.com/1/members/me?key=invalidkey&token=invalidtoken" -Label "X1 bad key+token"
Probe -Url "https://api.trello.com/1/members/me?key=invalidkey&token=invalidtoken" -Label "X2 bad query + Bearer header" -Extra @('-H','Authorization: Bearer invalidtoken123')
Probe -Url "https://api.trello.com/1/members/me" -Label "X3 fake cookies" -Extra @('-H','Cookie: trello_session=abc123; JSESSIONID=xyz; atl_token=q')
Probe -Url "https://api.trello.com/1/members/me" -Label "X4 OAuth1.0 style header" -Extra @('-H','Authorization: OAuth oauth_consumer_key="invalidkey", oauth_token="invalidtoken"')
Probe -Url "https://api.trello.com/1/members/me?key=invalidkey" -Label "X5 key only" 
Probe -Url "https://api.trello.com/1/members/me?token=invalidtoken" -Label "X6 token only"
Probe -Url "https://api.trello.com/1/boards/AbCdEfGh/lists" -Label "X7 board lists no auth"
Probe -Url "https://api.trello.com/1/batch" -Label "X8 batch"
Probe -Url "https://api.trello.com/1/boards" -Label "X9 POST boards no auth" -Extra @('-X','POST')
Probe -Url "https://api.trello.com/1/members/me/boards" -Label "X10 nested members no auth"
Remove-Item $tmp -ErrorAction SilentlyContinue