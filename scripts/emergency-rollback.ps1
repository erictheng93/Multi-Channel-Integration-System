<#
.SYNOPSIS
    Emergency Rollback Script - WebSocket Deployment
    Á∑äÊÄ•Â?ÊªæËÖ≥??- WebSocket ?®ÁΩ≤

.DESCRIPTION
    Quickly rollback WebSocket deployment in case of critical issues
    ?®Âá∫?æÂö¥?çÂ?È°åÊ?Âø´ÈÄüÂ?Êª?WebSocket ?®ÁΩ≤

.PARAMETER RollbackLevel
    Level of rollback: safe, partial, or emergency
    - safe      : Rollback to previous stable percentage (50%, default)
    - partial   : Rollback to minimal WebSocket (25%)
    - emergency : Complete fallback to SSE (0%)

.EXAMPLE
    .\scripts\emergency-rollback.ps1 -RollbackLevel safe
    Rollback to previous stable percentage

.EXAMPLE
    .\scripts\emergency-rollback.ps1 -RollbackLevel emergency
    Complete SSE fallback (0% WebSocket)

.EXAMPLE
    .\scripts\emergency-rollback.ps1 -RollbackLevel partial
    Rollback to 25% WebSocket

.NOTES
    Version: 1.0.0
    Author: Claude Code
    Date: 2025-10-08
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("safe", "partial", "emergency")]
    [string]$RollbackLevel = "safe",

    [Parameter(Mandatory=$false)]
    [string]$ApiBaseUrl = "https://your-api-domain.example.com",

    [Parameter(Mandatory=$false)]
    [string]$AdminEmail = "admin@dacit.net",

    [Parameter(Mandatory=$false)]
    [string]$AdminPassword = "16011587DaC"
)

# Error handling
$ErrorActionPreference = "Stop"

# Rollback target percentages
$SAFE_ROLLBACK = 50       # Previous stable percentage
$PARTIAL_ROLLBACK = 25    # Minimal WebSocket
$EMERGENCY_ROLLBACK = 0   # Complete SSE fallback

# Log file
$LogDir = "logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}
$LogFile = Join-Path $LogDir "emergency-rollback-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

###############################################################################
# Utility Functions
###############################################################################

function Write-Log {
    param(
        [Parameter(Mandatory=$true)]
        [ValidateSet("INFO", "SUCCESS", "WARNING", "ERROR")]
        [string]$Level,

        [Parameter(Mandatory=$true)]
        [string]$Message
    )

    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"

    # Console output with colors
    switch ($Level) {
        "INFO"    { Write-Host "[INFO] $Message" -ForegroundColor Blue }
        "SUCCESS" { Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
        "WARNING" { Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
        "ERROR"   { Write-Host "[ERROR] $Message" -ForegroundColor Red }
    }

    # Log to file
    Add-Content -Path $LogFile -Value $LogMessage
}

function Confirm-Action {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Prompt
    )

    Write-Host ""
    Write-Host "?†Ô?  CONFIRMATION REQUIRED" -ForegroundColor Yellow
    Write-Host $Prompt -ForegroundColor Yellow
    Write-Host ""

    $Response = Read-Host "Type 'YES' to confirm, anything else to abort"

    if ($Response -ne "YES") {
        Write-Log -Level ERROR -Message "Rollback aborted by user"
        exit 1
    }
}

function Get-AuthToken {
    Write-Log -Level INFO -Message "Authenticating with API..."

    $LoginBody = @{
        email = $AdminEmail
        password = $AdminPassword
    } | ConvertTo-Json

    try {
        $Response = Invoke-RestMethod -Uri "$ApiBaseUrl/api/auth/login" `
            -Method Post `
            -Body $LoginBody `
            -ContentType "application/json"

        if ($Response.success -and $Response.data.token) {
            Write-Log -Level SUCCESS -Message "Authentication successful"
            return $Response.data.token
        } else {
            throw "Authentication failed: $($Response | ConvertTo-Json)"
        }
    } catch {
        Write-Log -Level ERROR -Message "Failed to authenticate: $_"
        throw
    }
}

function Get-CurrentConfig {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Token
    )

    Write-Log -Level INFO -Message "Fetching current WebSocket configuration..."

    try {
        $Headers = @{
            "Authorization" = "Bearer $Token"
        }

        $Response = Invoke-RestMethod -Uri "$ApiBaseUrl/api/websocket/dashboard/migration-config" `
            -Method Get `
            -Headers $Headers

        return $Response
    } catch {
        Write-Log -Level ERROR -Message "Failed to fetch current config: $_"
        throw
    }
}

function Update-RolloutPercentage {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Token,

        [Parameter(Mandatory=$true)]
        [int]$Percentage,

        [Parameter(Mandatory=$true)]
        [string]$Reason
    )

    Write-Log -Level INFO -Message "Updating rollout percentage to $Percentage%..."

    $UpdateBody = @{
        rolloutPercentage = $Percentage
        enableWebSocket = ($Percentage -gt 0)
        enableSSE = $true
        migrationStrategy = "gradual"
        rollbackReason = $Reason
        rollbackTimestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    } | ConvertTo-Json

    try {
        $Headers = @{
            "Authorization" = "Bearer $Token"
            "Content-Type" = "application/json"
        }

        $Response = Invoke-RestMethod -Uri "$ApiBaseUrl/api/websocket/dashboard/migration-config" `
            -Method Put `
            -Headers $Headers `
            -Body $UpdateBody

        return $Response
    } catch {
        Write-Log -Level ERROR -Message "Failed to update config: $_"
        throw
    }
}

function Test-Rollback {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Token,

        [Parameter(Mandatory=$true)]
        [int]$ExpectedPercentage
    )

    Write-Log -Level INFO -Message "Verifying rollback configuration..."

    $Config = Get-CurrentConfig -Token $Token

    if ($Config.data.rolloutPercentage -eq $ExpectedPercentage) {
        Write-Log -Level SUCCESS -Message "Rollback verified: Rollout percentage is now $($Config.data.rolloutPercentage)%"
        return $true
    } else {
        Write-Log -Level ERROR -Message "Rollback verification failed: Expected $ExpectedPercentage%, got $($Config.data.rolloutPercentage)%"
        return $false
    }
}

function Get-SystemHealth {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Token
    )

    Write-Log -Level INFO -Message "Checking system health..."

    try {
        $Headers = @{
            "Authorization" = "Bearer $Token"
        }

        $Response = Invoke-RestMethod -Uri "$ApiBaseUrl/api/health/health" `
            -Method Get `
            -Headers $Headers

        return $Response
    } catch {
        Write-Log -Level ERROR -Message "Failed to check system health: $_"
        throw
    }
}

function Send-RollbackNotification {
    param(
        [Parameter(Mandatory=$true)]
        [string]$RollbackLevel,

        [Parameter(Mandatory=$true)]
        [int]$OldPercentage,

        [Parameter(Mandatory=$true)]
        [int]$NewPercentage,

        [Parameter(Mandatory=$true)]
        [string]$Reason
    )

    Write-Log -Level INFO -Message "Sending rollback notifications..."

    $Message = @"
?ö® EMERGENCY ROLLBACK EXECUTED ?ö®

Rollback Level: $RollbackLevel
Previous Rollout: $OldPercentage%
New Rollout: $NewPercentage%
Reason: $Reason
Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')

Action Required:
1. Monitor system health dashboard
2. Review error logs
3. Investigate root cause
4. Plan remediation steps

Dashboard: $ApiBaseUrl/websocket-monitoring
"@

    Write-Log -Level WARNING -Message $Message

    # Send to Slack/Teams/Email if configured
    # Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body (@{text=$Message} | ConvertTo-Json)
}

###############################################################################
# Rollback Execution
###############################################################################

function Invoke-Rollback {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Level
    )

    Write-Host ""
    Write-Host "?î‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚???
    Write-Host "??                                                          ??
    Write-Host "??       ?ö® EMERGENCY ROLLBACK SCRIPT ?ö®                    ??
    Write-Host "??                                                          ??
    Write-Host "?? WebSocket Deployment Rollback Tool                      ??
    Write-Host "?? Version: 1.0.0                                           ??
    Write-Host "?? Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')              ??
    Write-Host "??                                                          ??
    Write-Host "?ö‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚???
    Write-Host ""

    # Determine target percentage
    $TargetPercentage = switch ($Level) {
        "safe"      { $SAFE_ROLLBACK }
        "partial"   { $PARTIAL_ROLLBACK }
        "emergency" { $EMERGENCY_ROLLBACK }
    }

    $RollbackDescription = switch ($Level) {
        "safe"      { "Safe Rollback (Previous Stable: $SAFE_ROLLBACK%)" }
        "partial"   { "Partial Rollback (Minimal WebSocket: $PARTIAL_ROLLBACK%)" }
        "emergency" { "Emergency Rollback (Complete SSE Fallback: 0%)" }
    }

    Write-Log -Level INFO -Message "Rollback Level: $Level"
    Write-Log -Level INFO -Message "Target Percentage: $TargetPercentage%"
    Write-Log -Level INFO -Message "Description: $RollbackDescription"
    Write-Host ""

    # Get authentication token
    $Token = Get-AuthToken
    Write-Host ""

    # Get current configuration
    $CurrentConfig = Get-CurrentConfig -Token $Token
    $CurrentPercentage = $CurrentConfig.data.rolloutPercentage

    Write-Log -Level INFO -Message "Current Rollout Percentage: $CurrentPercentage%"
    Write-Host ""

    # Confirm action
    $ConfirmPrompt = @"
About to execute $RollbackDescription

This will:
  - Change WebSocket rollout from $CurrentPercentage% to $TargetPercentage%
  - $(if ($TargetPercentage -eq 0) { "Disable WebSocket completely" } else { "Reduce WebSocket usage" })
  - Enable SSE fallback for affected users
  - Log the rollback event

This action CANNOT be undone automatically.
"@

    Confirm-Action -Prompt $ConfirmPrompt

    Write-Host ""
    Write-Log -Level INFO -Message "Rollback confirmed. Executing..."
    Write-Host ""

    # Execute rollback
    $RollbackReason = "Emergency rollback from $CurrentPercentage% to $TargetPercentage% - Manual intervention via emergency-rollback.ps1"

    $Result = Update-RolloutPercentage -Token $Token -Percentage $TargetPercentage -Reason $RollbackReason

    if ($Result.success) {
        Write-Log -Level SUCCESS -Message "Rollback configuration updated"
    } else {
        Write-Log -Level ERROR -Message "Failed to update rollback configuration"
        throw "Rollback failed"
    }

    Write-Host ""

    # Verify rollback
    if (Test-Rollback -Token $Token -ExpectedPercentage $TargetPercentage) {
        Write-Log -Level SUCCESS -Message "Rollback verification passed"
    } else {
        Write-Log -Level ERROR -Message "Rollback verification failed"
        throw "Verification failed"
    }

    Write-Host ""

    # Check system health
    $Health = Get-SystemHealth -Token $Token
    Write-Log -Level INFO -Message "System Health Status:"
    Write-Host ($Health | ConvertTo-Json -Depth 5)

    Write-Host ""

    # Send notifications
    Send-RollbackNotification -RollbackLevel $Level `
        -OldPercentage $CurrentPercentage `
        -NewPercentage $TargetPercentage `
        -Reason $RollbackReason

    Write-Host ""
    Write-Host "?î‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚???
    Write-Host "??                                                          ??
    Write-Host "??       ??ROLLBACK COMPLETED SUCCESSFULLY ??             ??
    Write-Host "??                                                          ??
    Write-Host "?ö‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚???
    Write-Host ""

    Write-Log -Level SUCCESS -Message "Rollback Summary:"
    Write-Log -Level SUCCESS -Message "  - Rollout changed from $CurrentPercentage% ??$TargetPercentage%"
    Write-Log -Level SUCCESS -Message "  - WebSocket: $(if ($TargetPercentage -gt 0) { "Enabled ($TargetPercentage%)" } else { "Disabled" })"
    Write-Log -Level SUCCESS -Message "  - SSE Fallback: Enabled"
    Write-Log -Level SUCCESS -Message "  - Log file: $LogFile"
    Write-Host ""

    Write-Log -Level WARNING -Message "Next Steps:"
    Write-Log -Level WARNING -Message "  1. Monitor WebSocket Dashboard: $ApiBaseUrl/websocket-monitoring"
    Write-Log -Level WARNING -Message "  2. Review error logs and metrics"
    Write-Log -Level WARNING -Message "  3. Investigate root cause of issues"
    Write-Log -Level WARNING -Message "  4. Test fixes in staging environment"
    Write-Log -Level WARNING -Message "  5. Plan gradual re-rollout when ready"
    Write-Host ""
}

###############################################################################
# Pre-flight Checks
###############################################################################

function Test-PreflightChecks {
    Write-Log -Level INFO -Message "Running pre-flight checks..."

    # Check if API is accessible
    try {
        $Response = Invoke-WebRequest -Uri "$ApiBaseUrl/api/health/health" -UseBasicParsing -TimeoutSec 10
        if ($Response.StatusCode -eq 200) {
            Write-Log -Level SUCCESS -Message "API is accessible"
        }
    } catch {
        Write-Log -Level ERROR -Message "API is not accessible at $ApiBaseUrl"
        throw
    }

    Write-Log -Level SUCCESS -Message "Pre-flight checks passed"
    Write-Host ""
}

###############################################################################
# Main Execution
###############################################################################

try {
    Test-PreflightChecks
    Invoke-Rollback -Level $RollbackLevel
} catch {
    Write-Log -Level ERROR -Message "Rollback script failed: $_"
    Write-Host ""
    Write-Host "??Rollback failed. Check the log file for details: $LogFile" -ForegroundColor Red
    exit 1
}
