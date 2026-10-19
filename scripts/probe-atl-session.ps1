$ErrorActionPreference='Continue'
$UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
function Probe { param([string]$Url,[string]$Label,[string[]]$Extra=@())
  Write-Output "==== $Label"
  $a = @('-sS','-i','--max-time','25','-A',$UA) + $Extra + @($Url)
  $t = ((& curl.exe @a 2>&1) -join "`n")
  $p = $t -split "`n`n",2
  $hl = $p[0] -split "`n"
  Write-Output "STATUS: $($hl[0].Trim())"
  foreach ($l in $hl) { if ($l -match '^(?i)(set-cookie|content-type|location|x-cache|cache-control):') { Write-Output "H: $($l.Trim())" } }
  Write-Output ""
}
# cache-bust to force origin
Probe -Url "https://trello.com/?cb=1" -Label "Z1 trello.com cache-bust"
Probe -Url "https://trello.com/1/members/me?cb=1" -Label "Z2 trello.com/1 cache-bust"
Probe -Url "https://trello.com/1/session" -Label "Z3 /1/session"
Probe -Url "https://trello.com/ensureSession" -Label "Z4 ensureSession"
Probe -Url "https://api.trello.com/1/members/me?cb=1" -Label "Z5 api host cache-bust"