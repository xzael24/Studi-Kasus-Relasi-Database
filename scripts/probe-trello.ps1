$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Probe {
  param([string]$Url, [string]$Label, [string[]]$Extra = @())
  Write-Output "==================== $Label ===================="
  Write-Output "URL: $Url"
  $out = & curl.exe -sS -i -L --max-redirs 5 --max-time 25 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) research-probe" @Extra $Url 2>&1
  $text = ($out -join "`n")
  Write-Output $text
  Write-Output ""
}

Probe -Url "https://api.trello.com/1/members/me" -Label "A: members/me no auth"
Probe -Url "https://api.trello.com/1/members/me?key=invalidkey&token=invalidtoken" -Label "E2: members/me bad auth"
Probe -Url "https://api.trello.com/1/boards/doesnotexist" -Label "E3: board not found"
Probe -Url "https://api.trello.com/1/nonexistent-path" -Label "E4: bad route"