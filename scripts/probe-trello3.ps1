$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

function Probe {
  param([string]$Url, [string]$Label, [string[]]$Extra = @(), [switch]$NoFollow, [int]$Head = 0)
  Write-Output "==================== $Label ===================="
  Write-Output "URL: $Url"
  $a = @('-sS','-i','--max-time','25','-A',$UA)
  if (-not $NoFollow) { $a += @('-L','--max-redirs','5') }
  $a += $Extra
  $a += $Url
  $out = & curl.exe @a 2>&1
  $text = ($out -join "`n")
  if ($Head -gt 0 -and $text.Length -gt $Head) { $text = $text.Substring(0,$Head) + "`n[[TRUNCATED len=" + $text.Length + "]]" }
  Write-Output $text
  Write-Output ""
}

# --- session cookies on login surfaces ---
Probe -Url "https://trello.com/login" -Label "C1: trello.com/login (no follow)" -NoFollow -Head 4000
Probe -Url "https://trello.com/login" -Label "C2: trello.com/login (follow)" -Head 5000
Probe -Url "https://id.atlassian.com/login" -Label "C3: id.atlassian.com/login" -Head 4000
Probe -Url "https://trello.com/atlassian/authorize" -Label "C4: trello.com/atlassian/authorize" -Head 3000

# --- CSRF probe: state-changing request with no auth, no csrf header ---
Probe -Url "https://api.trello.com/1/boards" -Label "D1: POST /1/boards no auth" -Extra @('-X','POST')
Probe -Url "https://api.trello.com/1/boards/AbCdEfGh/stars" -Label "D2: POST star no auth" -Extra @('-X','POST')

# --- OAuth authorize endpoint on Trello ---
Probe -Url "https://api.trello.com/1/authorize?expiration=never&scope=read&return_url=https%3A%2F%2Fexample.com%2Fcb&name=TestApp&key=invalidkey" -Label "O1: api.trello.com/1/authorize" -Head 3000
Probe -Url "https://trello.com/1/authorize?expiration=never&scope=read&return_url=https%3A%2F%2Fexample.com%2Fcb&name=TestApp&key=invalidkey" -Label "O2: trello.com/1/authorize" -Head 3000