# עיצובישי — התקנת סוכן ההדפסה (S-209). מריצים פעם אחת במחשב שליד המדפסת:
#   Win+R → מדביקים את הפקודה מהסטודיו (אדמין → 🖨️ שרשרת הדפסה) → Enter
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Base = Join-Path $env:LOCALAPPDATA 'Itzuvishi'
New-Item -ItemType Directory -Force -Path $Base | Out-Null
Write-Host ''
Write-Host '=== Itzuvishi print agent / סוכן ההדפסה של עיצובישי ===' -ForegroundColor Cyan
$token = (Read-Host 'Paste the computer code from the studio / הדביקו את קוד המחשב מהסטודיו').Trim()
if ($token -notmatch '^[A-Za-z0-9_-]{24,100}$') { Write-Host 'The code is not valid / הקוד לא תקין' -ForegroundColor Red; Read-Host 'Enter'; exit 1 }
$folder = 'C:\Itzuvishi\print'
$cfg = [ordered]@{ token = $token; folder = $folder; sumatra = '' } | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $Base 'print-agent.json'), $cfg, (New-Object Text.UTF8Encoding $false))
Invoke-WebRequest -Uri 'https://www.hoshaya.co.il/tools/print-agent/print-agent.ps1' -OutFile (Join-Path $Base 'print-agent.ps1') -UseBasicParsing
$haveSumatra = (Test-Path "$env:LOCALAPPDATA\SumatraPDF\SumatraPDF.exe") -or (Test-Path "$env:ProgramFiles\SumatraPDF\SumatraPDF.exe")
if (-not $haveSumatra) {
  Write-Host 'Installing SumatraPDF (free PDF reader used for printing)...'
  try { winget install --id SumatraPDF.SumatraPDF -e --silent --accept-package-agreements --accept-source-agreements | Out-Null }
  catch { Write-Host 'Could not install SumatraPDF automatically - install it from sumatrapdfreader.org' -ForegroundColor Yellow }
}
$script = Join-Path $Base 'print-agent.ps1'
$act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $script)
$trg = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Itzuvishi Print Agent' -Action $act -Trigger $trg -Settings $set -Force | Out-Null
Start-ScheduledTask -TaskName 'Itzuvishi Print Agent'
Write-Host ''
Write-Host 'Done! The agent runs in the background and starts with Windows.' -ForegroundColor Green
Write-Host 'מוכן! בסטודיו יופיע: מחובר. קבצים יורדים ל- C:\Itzuvishi\print'
Read-Host 'Enter'
