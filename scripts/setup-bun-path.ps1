<#
.SYNOPSIS
Checks whether Bun is available on PATH and optionally adds the standard Bun
install directory to the current user's PATH.

.DESCRIPTION
By default this script is read-only. It reports the detected Bun executable,
the expected Windows Bun install directory, and the exact action needed to fix
PATH when Bun is installed but not discoverable.

Use -Apply to update the current user's PATH. The script does not modify the
machine PATH and does not install Bun.

.EXAMPLE
.\scripts\setup-bun-path.ps1

.EXAMPLE
.\scripts\setup-bun-path.ps1 -Apply
#>

param(
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'

function Write-Info {
    param([string]$Message)
    Write-Host "[info] $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[ok] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[warn] $Message" -ForegroundColor Yellow
}

function Split-PathList {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return @()
    }

    return $Value.Split([System.IO.Path]::PathSeparator) |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
}

function Test-PathListContains {
    param(
        [string[]]$PathList,
        [string]$TargetPath
    )

    $targetFullPath = [System.IO.Path]::GetFullPath($TargetPath).TrimEnd('\')

    foreach ($item in $PathList) {
        try {
            $itemFullPath = [System.IO.Path]::GetFullPath(
                [Environment]::ExpandEnvironmentVariables($item)
            ).TrimEnd('\')

            if ([string]::Equals($itemFullPath, $targetFullPath, [StringComparison]::OrdinalIgnoreCase)) {
                return $true
            }
        } catch {
            if ([string]::Equals($item.TrimEnd('\'), $TargetPath.TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) {
                return $true
            }
        }
    }

    return $false
}

$bunCommand = Get-Command bun -ErrorAction SilentlyContinue
$bunDir = Join-Path $env:USERPROFILE '.bun\bin'
$bunExe = Join-Path $bunDir 'bun.exe'
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$userPathEntries = @(Split-PathList $userPath)
$processPathEntries = @(Split-PathList $env:PATH)
$bunDirInUserPath = Test-PathListContains -PathList $userPathEntries -TargetPath $bunDir
$bunDirInProcessPath = Test-PathListContains -PathList $processPathEntries -TargetPath $bunDir
$bunInstalledAtDefaultPath = Test-Path -LiteralPath $bunExe

Write-Info 'Checking Bun PATH configuration...'

if ($bunCommand) {
    Write-Ok "bun resolves to: $($bunCommand.Source)"
    try {
        $bunVersion = & $bunCommand.Source --version
        Write-Ok "Bun version: $bunVersion"
    } catch {
        Write-Warn "bun was found but version check failed: $($_.Exception.Message)"
    }
} else {
    Write-Warn 'bun is not currently resolvable from PATH.'
}

Write-Info "Expected Windows Bun directory: $bunDir"

if (-not $bunInstalledAtDefaultPath) {
    Write-Warn "Bun was not found at $bunExe"
    Write-Host ''
    Write-Host 'Install Bun first:' -ForegroundColor White
    Write-Host '  powershell -c "irm bun.sh/install.ps1|iex"' -ForegroundColor White
    exit 1
}

Write-Ok "Bun executable exists at: $bunExe"

if ($bunDirInUserPath) {
    Write-Ok 'The Bun directory is already present in the current user PATH.'
} else {
    Write-Warn 'The Bun directory is not present in the current user PATH.'
}

if ($bunDirInProcessPath) {
    Write-Ok 'The Bun directory is present in this PowerShell process PATH.'
} else {
    Write-Warn 'The Bun directory is not present in this PowerShell process PATH.'
}

if ($bunCommand -and $bunDirInUserPath) {
    Write-Ok 'No PATH update is needed.'
    exit 0
}

if (-not $Apply) {
    Write-Host ''
    Write-Info 'Dry run only. No environment variables were modified.'
    Write-Host 'To add Bun to the current user PATH, run:' -ForegroundColor White
    Write-Host '  .\scripts\setup-bun-path.ps1 -Apply' -ForegroundColor White
    Write-Host ''
    Write-Host 'After applying, open a new terminal before running bun commands.' -ForegroundColor White
    exit 0
}

if ($bunDirInUserPath) {
    Write-Ok 'User PATH already contains the Bun directory.'
} else {
    $newUserPathEntries = @($userPathEntries + $bunDir)
    $newUserPath = [string]::Join([System.IO.Path]::PathSeparator, $newUserPathEntries)
    [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
    Write-Ok 'Added the Bun directory to the current user PATH.'
}

if (-not $bunDirInProcessPath) {
    $env:PATH = "$bunDir$([System.IO.Path]::PathSeparator)$env:PATH"
    Write-Ok 'Added the Bun directory to this PowerShell process PATH.'
}

Write-Host ''
Write-Ok 'Bun PATH bootstrap completed.'
Write-Host 'Open a new terminal to pick up the persistent User PATH change.' -ForegroundColor White
