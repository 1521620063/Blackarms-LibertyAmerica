[CmdletBinding()]
param(
    [string]$EngineRoot = "D:\Epic Games\UE_5.8",
    [string]$ArchiveDir = "D:\dev\BLA-Packaged",
    [string]$ExePath = "D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe",
    [string]$Tag = (Get-Date -Format "MMdd-HHmmss"),
    [int]$TimeoutSeconds = 180,
    [switch]$SkipCook
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$uat = Join-Path $EngineRoot "Engine\Build\BatchFiles\RunUAT.bat"
$project = Join-Path $root "BlackarmsLibertyAmerica.uproject"
$logDir = Join-Path $root "Saved\Logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

function Stop-BLA {
    Get-Process BlackarmsLibertyAmerica -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

function Get-BLAMatching([string]$Needle) {
    Get-CimInstance Win32_Process -Filter "Name='BlackarmsLibertyAmerica.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($Needle) }
}

function Stop-BLAMatching([string]$Needle) {
    Get-BLAMatching $Needle | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Test-BLAMatching([string]$Needle) {
    return @(Get-BLAMatching $Needle).Count -gt 0
}

function Wait-Marker([string]$LogPath, [string]$Pattern, [int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 2
        if ((Test-Path $LogPath) -and (Select-String -Path $LogPath -Pattern $Pattern -Quiet)) {
            return (Select-String -Path $LogPath -Pattern $Pattern | Select-Object -Last 1).Line.Trim()
        }
    }
    throw "NO_MARKER $Pattern log=$LogPath"
}

Stop-BLA
Get-Process UnrealEditor-Cmd -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

if (-not $SkipCook) {
    & $uat BuildCookRun -project="$project" -noP4 -platform=Win64 -clientconfig=Development -cook "-map=+/Game/BLA/Maps/Graybox/L_TestBootstrap+/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination+/Game/BLA/Maps/Final/L_BLA_ZeroFacility" -build -stage -pak -archive "-archivedirectory=$ArchiveDir" -utf8output -nocompileeditor
    if ($LASTEXITCODE -ne 0) { throw "COOK_FAILED exit=$LASTEXITCODE" }
}

if (-not (Test-Path $ExePath)) { throw "Missing packaged exe $ExePath" }

$hostLog = Join-Path $logDir ("LAN_HOST_" + $Tag + ".log")
$clientLog = Join-Path $logDir ("LAN_CLIENT_" + $Tag + ".log")
$hostArgs = '-BLALanHost -BLALanMode=Elimination -BLALanTeamSize=2 -BLALanAutoStart=5 -nullrhi -nosound -unattended -abslog="{0}"' -f $hostLog
$clientArgs = '-BLALanJoin=127.0.0.1 -BLALanTeam=Defenders -nullrhi -nosound -unattended -abslog="{0}"' -f $clientLog

$hostProc = Start-Process -FilePath $ExePath -ArgumentList $hostArgs -PassThru -WindowStyle Hidden
Wait-Marker $hostLog "BLA_LAN_PACKAGED_HOST_WAITING" 60
$clientProc = Start-Process -FilePath $ExePath -ArgumentList $clientArgs -PassThru -WindowStyle Hidden
Wait-Marker $clientLog "BLA_LAN_PACKAGED_CLIENT_JOINED" 60
Wait-Marker $clientLog "BLA_LAN_PACKAGED_TEAM" 30
Wait-Marker $hostLog "BLA_LAN_PACKAGED_STARTED" 30
Wait-Marker $clientLog "BLA_LAN_PACKAGED_STARTED" 30
$hostState = Wait-Marker $hostLog "BLA_LAN_PACKAGED_STATE" 30
$clientState = Wait-Marker $clientLog "BLA_LAN_PACKAGED_STATE" 30
if ($hostState -notmatch "phase=" -or $clientState -notmatch "phase=") { throw "STATE_MISSING" }

Stop-BLAMatching ([IO.Path]::GetFileName($clientLog))
Start-Sleep -Seconds 3
if (-not (Test-BLAMatching ([IO.Path]::GetFileName($hostLog)))) { throw "HOST_DIED_AFTER_CLIENT_KILL" }
if (Select-String -Path $hostLog -Pattern "BLA_LAN_PACKAGED_MENU" -Quiet) { throw "HOST_RETURNED_TO_MENU_AFTER_CLIENT_LEAVE" }
Stop-BLA

$hostLog2 = Join-Path $logDir ("LAN_HOST2_" + $Tag + ".log")
$clientLog2 = Join-Path $logDir ("LAN_CLIENT2_" + $Tag + ".log")
$hostArgs2 = '-BLALanHost -BLALanMode=Elimination -BLALanTeamSize=2 -nullrhi -nosound -unattended -abslog="{0}"' -f $hostLog2
$clientArgs2 = '-BLALanJoin=127.0.0.1 -BLALanTeam=Defenders -nullrhi -nosound -unattended -abslog="{0}"' -f $clientLog2
$hostProc = Start-Process -FilePath $ExePath -ArgumentList $hostArgs2 -PassThru -WindowStyle Hidden
Wait-Marker $hostLog2 "BLA_LAN_PACKAGED_HOST_WAITING" 60
$clientProc = Start-Process -FilePath $ExePath -ArgumentList $clientArgs2 -PassThru -WindowStyle Hidden
Wait-Marker $clientLog2 "BLA_LAN_PACKAGED_CLIENT_JOINED" 60
Stop-BLAMatching ([IO.Path]::GetFileName($hostLog2))
Start-Sleep -Seconds 2
Wait-Marker $clientLog2 "FLOW_LAN_HOST_LEFT" 90
Wait-Marker $clientLog2 "BLA_LAN_PACKAGED_MENU" 30
Stop-BLA
Write-Host "BLA_LAN_PACKAGED_SMOKE_OK tag=$Tag"
