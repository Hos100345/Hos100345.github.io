# עיצובישי — סוכן ההדפסה (S-209). רץ ברקע במחשב שליד מדפסת הסובלימציה (Windows, PowerShell 5+).
# כל ~20 שנ' שואל את השרת (Edge Function print-queue) אם יש עבודה מאושרת. יש → מוריד את ה-PDF לתיקייה של היום,
# ואם "הדפסה אמיתית" דלוקה בסטודיו — מדפיס דרך SumatraPDF למדפסת שנבחרה בסטודיו, בהגדרות הקבועות של הדרייבר
# (גודל נייר, סוג חומר/פרופיל, Printer Manages Colors). בשבת השרת לא נותן עבודות. יומן: %LOCALAPPDATA%\Itzuvishi\print-agent.log
param([switch]$Once)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Base = Join-Path $env:LOCALAPPDATA 'Itzuvishi'
$Cfg = Get-Content -Path (Join-Path $Base 'print-agent.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$EP = 'https://sccivxenkyzxolpraexf.supabase.co/functions/v1/print-queue'
$KEY = 'sb_publishable_Ctloh48bIY2Lxm_YmTiSGA_1ADr5FDz'
$VER = '1'
$LogFile = Join-Path $Base 'print-agent.log'

function Write-Log([string]$m) {
  $line = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $m
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch {}
  Write-Host $line
}
function Invoke-Queue($body) {
  $json = $body | ConvertTo-Json -Compress -Depth 6
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  return Invoke-RestMethod -Method Post -Uri $EP -Headers @{ apikey = $KEY; 'x-print-token' = $Cfg.token } -ContentType 'application/json; charset=utf-8' -Body $bytes -TimeoutSec 60
}
function Find-Sumatra {
  $c = @($Cfg.sumatra, "$env:LOCALAPPDATA\SumatraPDF\SumatraPDF.exe", "$env:ProgramFiles\SumatraPDF\SumatraPDF.exe", "${env:ProgramFiles(x86)}\SumatraPDF\SumatraPDF.exe")
  foreach ($p in $c) { if ($p -and (Test-Path $p)) { return $p } }
  return $null
}

New-Item -ItemType Directory -Force -Path $Cfg.folder | Out-Null
Write-Log "start ver $VER · folder $($Cfg.folder)"
$lastHold = ''
while ($true) {
  $wait = 20; $job = $null
  try {
    $printers = @()
    try { $printers = @(Get-Printer | Select-Object -ExpandProperty Name) } catch {}
    $r = Invoke-Queue @{ action = 'poll'; info = @{ printers = $printers; host = $env:COMPUTERNAME; ver = $VER } }
    if ($r.hold) {
      if ($r.hold -ne $lastHold) { Write-Log "hold: $($r.hold) $($r.until)" }
      $lastHold = $r.hold
      if ($r.hold -eq 'shabbat') { $wait = 300 }
    }
    elseif ($r.job) {
      $lastHold = ''
      $job = $r.job
      $day = Join-Path $Cfg.folder (Get-Date -Format 'yyyy-MM-dd')
      New-Item -ItemType Directory -Force -Path $day | Out-Null
      $file = Join-Path $day ('{0}-{1}-{2}' -f $job.code, $job.id.Substring(0, 8), $job.file)
      Invoke-WebRequest -Uri $r.url -OutFile $file -UseBasicParsing -TimeoutSec 300
      if ($r.dry_run) {
        Invoke-Queue @{ action = 'report'; id = $job.id; status = 'downloaded' } | Out-Null
        Write-Log "downloaded (no print): $file"
      }
      else {
        $s = Find-Sumatra
        if (-not $s) { throw 'SumatraPDF not installed' }
        $args2 = @('-print-to', ('"{0}"' -f $r.printer), '-print-settings', ('"noscale,{0}x"' -f $job.copies), '-silent', ('"{0}"' -f $file))
        $p = Start-Process -FilePath $s -ArgumentList $args2 -PassThru -Wait -WindowStyle Hidden
        if ($p.ExitCode -eq 0) {
          Invoke-Queue @{ action = 'report'; id = $job.id; status = 'printed' } | Out-Null
          Write-Log "printed x$($job.copies): $file -> $($r.printer)"
        }
        else { throw "SumatraPDF exit code $($p.ExitCode)" }
      }
      $wait = 2
    }
    else { $lastHold = '' }
  }
  catch {
    $msg = $_.Exception.Message
    Write-Log "error: $msg"
    if ($job -and $job.id) { try { Invoke-Queue @{ action = 'report'; id = $job.id; status = 'failed'; error = $msg } | Out-Null } catch {} }
    $wait = 60
  }
  if ($Once) { break }
  Start-Sleep -Seconds $wait
}
