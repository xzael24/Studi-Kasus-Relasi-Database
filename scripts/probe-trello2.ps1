$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Probe {
  param([string]$Url, [string]$Label, [string[]]$Extra = @(), [switch]$NoFollow)
  Write-Output "==================== $Label ===================="
  Write-Output "URL: $Url"
  $args = @('-sS','-i','--max-time','25','-A','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 research-probe')
  if (-not $NoFollow) { $args += @('-L','--max-redirs','5') }
  $args += $Extra
  $args += $Url
  $out = & curl.exe @args 2>&1
  $text = ($out -join "`n")
  # trim huge HTML bodies
  if ($text.Length -gt 6000) { $text = $text.Substring(0,6000) + "`n[[TRUNCATED BODY]]" }
  Write-Output $text
  Write-Output ""
}

Probe -Url "https://trello.com/" -Label "B1: trello.com root (no follow)"
Probe -Url "https://trello.com/" -Label "B2: trello.com root (follow redirects)"
Probe -Url "https://id.atlassian.com/authorize" -Label "B3: id.atlassian.com/authorize (follow)"
Probe -Url "https://api.trello.com/1/boards/AbCdEfGh" -Label "E3b: valid-format nonexistent board shortLink"
Probe -Url "https://api.trello.com/1/members/me" -Label "E1b: members/me with Authorization Bearer invalid" -Extra @('-H','Authorization: Bearer invalidtoken123')
Probe -Url "https://api.trello.com/1/boards/AbCdEfGh?key=invalidkey&token=invalidtoken" -Label "E3c: board + bad key/token"