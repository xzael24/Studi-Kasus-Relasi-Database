$ErrorActionPreference='Continue'
$UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
function Probe { param([string]$Url,[string]$Label,[switch]$Full,[int[]]$Codes=@())
  Write-Output "==== $Label"
  Write-Output "URL: $Url"
  $a = @('-sS','-i','--max-time','25','-A',$UA)
  if ($Codes.Count -gt 0) { $a += @('-w',"`nCODE:%{http_code}") }
  $a += @($Url)
  $t = ((& curl.exe @a 2>&1) -join "`n")
  if ($Full) { Write-Output $t }
  else {
    $p = $t -split "`n`n",2
    $hl = $p[0] -split "`n"
    Write-Output "STATUS: $($hl[0].Trim())"
    foreach ($l in $hl) { if ($l -match '(?i)^(set-cookie|location|content-type|allow|retry-after|x-ratelimit-[a-z0-9-]+):') { Write-Output "H: $($l.Trim())" } }
    Write-Output "BODY: $(($p[1] -replace '\s+',' ').Trim().Substring(0,[Math]::Min(200,($p[1] -replace '\s+',' ').Trim().Length)))"
  }
  Write-Output ""
}
Probe -Url "https://trello.com/ensureSession" -Label "A1 ensureSession body"
Probe -Url "https://trello.com/1/session" -Label "A2 /1/session body"
# hunt for the Set-Cookie that creates atl_session: try endpoints the SPA hits on boot
Probe -Url "https://trello.com/?cb=99871" -Label "A3 root unique cache-bust (full headers)" -Full
Probe -Url "https://trello.com/1/members/me?cb=99872" -Label "A4 members/me on web host w/ query" -Full
Probe -Url "https://trello.com/auth/atlassian/callback" -Label "A5 callback no params"