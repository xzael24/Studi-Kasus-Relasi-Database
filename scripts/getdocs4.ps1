$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

function GetDoc {
  param([string]$Url)
  Write-Output "############ $Url"
  $raw = & curl.exe -sS -L --max-time 30 -A $UA $Url 2>&1
  $html = ($raw -join "`n")
  $html = [regex]::Replace($html, '(?s)<script.*?</script>', ' ')
  $html = [regex]::Replace($html, '(?s)<style.*?</style>', ' ')
  $m = [regex]::Match($html, '(?s)<main.*?</main>')
  if ($m.Success) { $html = $m.Value }
  $t = [regex]::Replace($html, '(?s)<!--.*?-->', ' ')
  $t = $t -replace '(?s)<(h[1-6])[^>]*>', "`n`n### "
  $t = $t -replace '(?s)<li[^>]*>', "`n- "
  $t = $t -replace '(?s)<t[dh][^>]*>', ' | '
  $t = $t -replace '(?s)<tr[^>]*>', "`n"
  $t = $t -replace '(?s)<p[^>]*>', "`n"
  $t = $t -replace '(?s)<br[^>]*>', "`n"
  $t = [regex]::Replace($t, '(?s)<[^>]+>', ' ')
  $t = [System.Net.WebUtility]::HtmlDecode($t)
  $t = $t -replace '[ \t]+', ' '
  $t = ($t -split "`n" | Where-Object { $_.Trim() -ne '' }) -join "`n"
  if ($t.Length -gt 22000) { $t = $t.Substring(0,22000) + "`n[[TRUNCATED]]" }
  Write-Output $t
  Write-Output ""
}

GetDoc "https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/"
GetDoc "https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/"
GetDoc "https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-getting-started/"