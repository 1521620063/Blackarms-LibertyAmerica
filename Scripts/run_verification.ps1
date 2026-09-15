<#
Runs the Blackarms-LibertyAmerica verification matrix without a human in the loop.

Contract: every script below must emit exactly one of its OK/FAILED markers in the
run log. A missing marker, a FAILED marker, or a timeout fails the matrix and the
process exits non-zero. Contract scripts do not quit the editor themselves, so the
runner kills the editor after the marker appears.

Never run two UnrealEditor-Cmd processes against this project at once: the second
instance silently loses the project lock and produces empty logs.

Example:
  pwsh -File Scripts/run_verification.ps1
  pwsh -File Scripts/run_verification.ps1 -Only verify_task9_pie
#>
[CmdletBinding()]
param(
    [string]$EngineRoot = "D:\Epic Games\UE_5.8",
    [string]$Tag = (Get-Date -Format "MMdd-HHmmss"),
    [int]$TimeoutSeconds = 300,
    [int]$GraceSeconds = 8,
    [string]$Only = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$project = Join-Path $root "BlackarmsLibertyAmerica.uproject"
$scriptDir = Join-Path $root "Scripts\Editor"
$logDir = Join-Path $root "Saved\Logs"

foreach ($required in @($editor, $project, $scriptDir)) {
    if (-not (Test-Path $required)) {
        throw "Missing required path: $required"
    }
}
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$matrix = @(
    @{ Script = "verify_task2_contracts"; Marker = "BLA_TASK2_CONTRACTS_(OK|FAILED)"; FailPattern = "TASK2_CONTRACT_FAILURE" }
    @{ Script = "verify_task3_contracts"; Marker = "BLA_TASK3_CONTRACTS_(OK|FAILED)"; FailPattern = "TASK3_CONTRACT_FAILURE" }
    @{ Script = "verify_task4_contracts"; Marker = "BLA_TASK4_CONTRACTS_(OK|FAILED)"; FailPattern = "TASK4_CONTRACT_FAILURE" }
    @{ Script = "verify_task5_contracts"; Marker = "BLA_TASK5_CONTRACTS_(OK|FAILED)"; FailPattern = "TASK5_CONTRACT_FAILURE" }
    @{ Script = "verify_task6_contracts"; Marker = "BLA_TASK6_CONTRACTS_(OK|FAILED)"; FailPattern = "TASK6_CONTRACT_FAILURE" }
    @{ Script = "verify_task7_contracts"; Marker = "BLA_TASK7_CONTRACTS_(OK|FAILED)"; FailPattern = "TASK7_CONTRACT_FAILURE" }
    @{ Script = "verify_task8_contracts"; Marker = "BLA_TASK8_CONTRACTS_(OK|FAILED)"; FailPattern = "TASK8_CONTRACT_FAILURE" }
    @{ Script = "verify_task9_contracts"; Marker = "BLA_TASK9_CONTRACTS_(OK|FAILED)"; FailPattern = "TASK9_CONTRACT_FAILURE" }
    @{ Script = "verify_task10_contracts"; Marker = "BLA_TASK10_CONTRACTS_(OK|FAILED)"; FailPattern = "TASK10_CONTRACT_FAILURE" }
    @{ Script = "verify_task11_contracts"; Marker = "BLA_TASK11_CONTRACTS_(OK|FAILED)"; FailPattern = "TASK11_CONTRACT_FAILURE" }
    @{ Script = "verify_task12_contracts"; Marker = "BLA_TASK12_CONTRACTS_(OK|FAILED)"; FailPattern = "TASK12_CONTRACT_FAILURE" }
    @{ Script = "verify_bootstrap_pie"; Marker = "BLA_PIE_VERIFY_(OK|FAILED)" }
    @{ Script = "verify_task2_pie"; Marker = "BLA_TASK2_PIE_DRIVER_(OK|FAILED)" }
    @{ Script = "verify_task3_pie"; Marker = "BLA_TASK3_PIE_DRIVER_(OK|FAILED)" }
    @{ Script = "verify_task4_pie"; Marker = "BLA_TASK4_PIE_DRIVER_(OK|FAILED)" }
    @{ Script = "verify_task5_pie"; Marker = "BLA_TASK5_PIE_DRIVER_(OK|FAILED)" }
    @{ Script = "verify_task6_pie"; Marker = "BLA_TASK6_PIE_DRIVER_(OK|FAILED)" }
    @{ Script = "verify_task7_pie"; Marker = "BLA_TASK7_PIE_DRIVER_(OK|FAILED)"; Require = @("BLA_1V1_ELIMINATION_OK", "BLA_3V3_ELIMINATION_OK") }
    @{ Script = "verify_task8_pie"; Marker = "BLA_TASK8_PIE_DRIVER_(OK|FAILED)"; Require = @("BLA_1V1_ELIMINATION_OK", "BLA_3V3_ELIMINATION_OK"); EnvName = "BLA_TASK8_TEAM_SIZE"; EnvValue = "1" }
    @{ Script = "verify_task8_pie"; Marker = "BLA_TASK8_PIE_DRIVER_(OK|FAILED)"; Require = @("BLA_1V1_ELIMINATION_OK", "BLA_3V3_ELIMINATION_OK"); EnvName = "BLA_TASK8_TEAM_SIZE"; EnvValue = "2" }
    @{ Script = "verify_task8_pie"; Marker = "BLA_TASK8_PIE_DRIVER_(OK|FAILED)"; Require = @("BLA_1V1_ELIMINATION_OK", "BLA_3V3_ELIMINATION_OK"); EnvName = "BLA_TASK8_TEAM_SIZE"; EnvValue = "3" }
    @{ Script = "verify_task9_pie"; Marker = "BLA_TASK9_PIE_DRIVER_(OK|FAILED)" }
    @{ Script = "verify_task10_pie"; Marker = "BLA_TASK10_PIE_DRIVER_(OK|FAILED)" }
    @{ Script = "verify_task11_pie"; Marker = "BLA_TASK11_PIE_DRIVER_(OK|FAILED)"; Require = @("BLA_MAP_NAVIGATION_OK", "BLA_ELIMINATION_MATCH_READY") }
    @{ Script = "verify_task12_pie"; Marker = "BLA_TASK12_PIE_DRIVER_(OK|FAILED)"; Require = @("ALL_MVP_FLOWS_OK", "HARNESS_CONFIGURATION_STARTED") }
)

$results = @()
$failed = 0
foreach ($entry in $matrix) {
    if ($Only -ne "" -and $entry.Script -ne $Only) { continue }

    $label = $entry.Script
    if ($entry.EnvName) { $label = "$($entry.Script)[$($entry.EnvName.Substring($entry.EnvName.LastIndexOf('_') + 1))=$($entry.EnvValue)]" }

    Get-Process UnrealEditor-Cmd -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    $log = Join-Path $logDir ("V_" + ($label -replace "[^A-Za-z0-9_.-]", "_") + "_" + $Tag + ".log")
    if ($entry.EnvName) {
        [Environment]::SetEnvironmentVariable($entry.EnvName, $entry.EnvValue, "Process")
    } else {
        [Environment]::SetEnvironmentVariable("BLA_TASK8_TEAM_SIZE", $null, "Process")
    }

    $arguments = '"{0}" -unattended -nop4 -nosplash -nullrhi -NoSound -ExecCmds="py {1}/{2}.py" -abslog="{3}"' -f `
        $project, ($scriptDir -replace "\\", "/"), $entry.Script, $log
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    $process = Start-Process -FilePath $editor -ArgumentList $arguments -PassThru -WindowStyle Hidden

    $marker = ""
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 2
        if (Test-Path $log) {
            $match = Select-String -Path $log -Pattern $entry.Marker -AllMatches | Select-Object -Last 1
            if ($match) {
                $marker = $match.Line.Trim()
                break
            }
            if ($entry.FailPattern) {
                $failure = Select-String -Path $log -Pattern $entry.FailPattern -AllMatches | Select-Object -Last 1
                if ($failure) {
                    $marker = "FAILED " + $failure.Line.Trim()
                    break
                }
            }
        }
        if ($process.HasExited) {
            Start-Sleep -Seconds 2
            break
        }
    }
    if ($marker -eq "" -and (Test-Path $log)) {
        $match = Select-String -Path $log -Pattern $entry.Marker -AllMatches | Select-Object -Last 1
        if ($match) { $marker = $match.Line.Trim() }
    }

    $graceEnd = (Get-Date).AddSeconds($GraceSeconds)
    while ((Get-Date) -lt $graceEnd -and -not $process.HasExited) { Start-Sleep -Seconds 1 }
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    $watch.Stop()

    $missing = @()
    if ($marker -ne "" -and $marker -notmatch "FAILED" -and $entry.Require) {
        foreach ($required in $entry.Require) {
            if (-not (Select-String -Path $log -Pattern $required -Quiet)) { $missing += $required }
        }
    }
    if ($missing.Count -gt 0) {
        $marker = "FAILED missing_markers " + ($missing -join ",")
    }

    if ($marker -eq "") {
        $failed++
        $status = "NO_MARKER"
    } elseif ($marker -match "FAILED") {
        $failed++
        $status = $marker
    } else {
        $status = $marker
    }
    $line = "[{0,6:N1}s] {1} :: {2}" -f $watch.Elapsed.TotalSeconds, $label, $status
    Write-Host $line
    $results += $line
}

Get-Process UnrealEditor-Cmd -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host ("MATRIX_DONE checks={0} failed={1}" -f $results.Count, $failed)
if ($failed -gt 0) {
    Write-Host "MATRIX_FAILED"
    exit 1
}
Write-Host "MATRIX_OK"
