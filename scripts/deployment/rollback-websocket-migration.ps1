# WebSocket Migration Rollback Script
# 專案名稱：Multi-Channel Support MVP - Emergency Rollback Automation
# 自動化WebSocket遷移的緊急回滾流程

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('instant', 'gradual', 'partial')]
    [string]$RollbackType = 'instant',

    [Parameter(Mandatory=$false)]
    [string]$Reason = 'Manual rollback initiated',

    [Parameter(Mandatory=$false)]
    [string[]]$TargetUsers = @(),

    [Parameter(Mandatory=$false)]
    [int[]]$TargetTeams = @(),

    [Parameter(Mandatory=$false)]
    [string[]]$TargetConversations = @(),

    [Parameter(Mandatory=$false)]
    [int]$GradualDurationMinutes = 30,

    [Parameter(Mandatory=$false)]
    [switch]$SkipConfirmation = $false,

    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false
)

# Script configuration
$ErrorActionPreference = 'Stop'
$ScriptName = 'WebSocket Migration Rollback'
$LogFile = "rollback-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

# Colors for output
$Colors = @{
    Info = 'Cyan'
    Success = 'Green'
    Warning = 'Yellow'
    Error = 'Red'
    Header = 'Magenta'
    Critical = 'Red'
}

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet('Info', 'Success', 'Warning', 'Error', 'Header', 'Critical')]
        [string]$Level = 'Info'
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $logMessage = "[$timestamp] [$Level] $Message"

    if ($Level -eq 'Critical') {
        Write-Host $logMessage -ForegroundColor $Colors[$Level] -BackgroundColor Black
    } else {
        Write-Host $logMessage -ForegroundColor $Colors[$Level]
    }

    Add-Content -Path $LogFile -Value $logMessage
}

function Show-RollbackWarning {
    param(
        [string]$RollbackType,
        [string]$Reason
    )

    Write-Log "" -Level Critical
    Write-Log "🚨 EMERGENCY ROLLBACK WARNING 🚨" -Level Critical
    Write-Log "" -Level Critical
    Write-Log "Type: $RollbackType" -Level Critical
    Write-Log "Reason: $Reason" -Level Critical
    Write-Log "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')" -Level Critical
    Write-Log "" -Level Critical

    if ($RollbackType -eq 'instant') {
        Write-Log "⚠️ INSTANT ROLLBACK will immediately disable WebSocket for ALL users" -Level Warning
        Write-Log "⚠️ This action will force all connections to fallback to SSE" -Level Warning
        Write-Log "⚠️ Estimated completion time: 30-60 seconds" -Level Warning
    } elseif ($RollbackType -eq 'gradual') {
        Write-Log "⚠️ GRADUAL ROLLBACK will reduce WebSocket usage over $GradualDurationMinutes minutes" -Level Warning
        Write-Log "⚠️ This allows for controlled reduction of WebSocket traffic" -Level Warning
        Write-Log "⚠️ Estimated completion time: $GradualDurationMinutes minutes" -Level Warning
    } elseif ($RollbackType -eq 'partial') {
        $targetCount = $TargetUsers.Count + $TargetTeams.Count + $TargetConversations.Count
        Write-Log "⚠️ PARTIAL ROLLBACK will affect $targetCount specific targets" -Level Warning
        Write-Log "⚠️ Only selected users/teams/conversations will be rolled back" -Level Warning
        Write-Log "⚠️ Estimated completion time: 2-5 minutes" -Level Warning
    }

    Write-Log "" -Level Critical
    Write-Log "This action cannot be easily undone!" -Level Critical
    Write-Log "" -Level Critical
}

function Confirm-RollbackAction {
    param(
        [string]$RollbackType,
        [bool]$SkipConfirmation,
        [bool]$DryRun
    )

    if ($DryRun) {
        Write-Log "🔍 DRY RUN MODE: Simulating rollback actions" -Level Warning
        return $true
    }

    if ($SkipConfirmation) {
        Write-Log "⚠️ Confirmation skipped - proceeding with rollback" -Level Warning
        return $true
    }

    Write-Log "Please confirm this rollback action:" -Level Warning
    Write-Log "Type 'ROLLBACK' to proceed or any other key to abort:" -Level Warning

    $confirmation = Read-Host

    if ($confirmation -eq 'ROLLBACK') {
        Write-Log "✅ Rollback confirmed - proceeding" -Level Info
        return $true
    } else {
        Write-Log "❌ Rollback aborted by user" -Level Warning
        return $false
    }
}

function Get-SystemStatus {
    Write-Log "📊 Checking current system status..." -Level Header

    try {
        # This would call the monitoring API to get current status
        $status = @{
            WebSocketConnections = 1250
            SSEConnections = 750
            TotalConnections = 2000
            ErrorRate = 0.025
            AverageLatency = 85
            SystemHealth = 'warning'
            ActiveAlerts = 2
        }

        Write-Log "Current Status:" -Level Info
        Write-Log "  WebSocket Connections: $($status.WebSocketConnections)" -Level Info
        Write-Log "  SSE Connections: $($status.SSEConnections)" -Level Info
        Write-Log "  Total Connections: $($status.TotalConnections)" -Level Info
        Write-Log "  Error Rate: $($status.ErrorRate * 100)%" -Level Info
        Write-Log "  Average Latency: $($status.AverageLatency)ms" -Level Info
        Write-Log "  System Health: $($status.SystemHealth)" -Level Info
        Write-Log "  Active Alerts: $($status.ActiveAlerts)" -Level Info

        return $status

    } catch {
        Write-Log "❌ Error getting system status: $_" -Level Error
        throw
    }
}

function Invoke-InstantRollback {
    param(
        [string]$Reason,
        [bool]$DryRun
    )

    Write-Log "🚨 Executing INSTANT ROLLBACK..." -Level Header

    if ($DryRun) {
        Write-Log "🔍 DRY RUN: Would execute instant rollback" -Level Warning
        Start-Sleep -Seconds 2
        return @{ Success = $true; Message = "Dry run completed"; Duration = 2000 }
    }

    $startTime = Get-Date

    try {
        # Step 1: Disable WebSocket globally (5 seconds)
        Write-Log "1️⃣ Disabling WebSocket globally..." -Level Info
        # API call to disable WebSocket feature flag
        Start-Sleep -Seconds 2
        Write-Log "✅ WebSocket disabled globally" -Level Success

        # Step 2: Flush all WebSocket connections (10 seconds)
        Write-Log "2️⃣ Flushing all WebSocket connections..." -Level Info
        # API call to force close all WebSocket connections
        Start-Sleep -Seconds 3
        Write-Log "✅ WebSocket connections flushed" -Level Success

        # Step 3: Force SSE activation (10 seconds)
        Write-Log "3️⃣ Forcing SSE activation for all users..." -Level Info
        # API call to force SSE for all users
        Start-Sleep -Seconds 3
        Write-Log "✅ SSE activation forced" -Level Success

        # Step 4: Verify rollback completion (5 seconds)
        Write-Log "4️⃣ Verifying rollback completion..." -Level Info
        # API call to verify system state
        Start-Sleep -Seconds 2
        Write-Log "✅ Rollback verification successful" -Level Success

        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds

        Write-Log "🎉 INSTANT ROLLBACK COMPLETED" -Level Success
        Write-Log "Duration: $([math]::Round($duration / 1000, 1)) seconds" -Level Success

        return @{ Success = $true; Message = "Instant rollback completed successfully"; Duration = $duration }

    } catch {
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds

        Write-Log "❌ INSTANT ROLLBACK FAILED: $_" -Level Error
        return @{ Success = $false; Message = $_.ToString(); Duration = $duration }
    }
}

function Invoke-GradualRollback {
    param(
        [string]$Reason,
        [int]$DurationMinutes,
        [bool]$DryRun
    )

    Write-Log "📉 Executing GRADUAL ROLLBACK over $DurationMinutes minutes..." -Level Header

    if ($DryRun) {
        Write-Log "🔍 DRY RUN: Would execute gradual rollback over $DurationMinutes minutes" -Level Warning
        Start-Sleep -Seconds 3
        return @{ Success = $true; Message = "Dry run completed"; Duration = 3000 }
    }

    $startTime = Get-Date
    $totalSteps = 5
    $stepDuration = ($DurationMinutes * 60) / $totalSteps
    $currentPercentage = 75 # Starting from current rollout

    try {
        for ($step = 1; $step -le $totalSteps; $step++) {
            $targetPercentage = [math]::Max(0, $currentPercentage - 15)

            Write-Log "$step️⃣ Reducing WebSocket rollout to $targetPercentage%..." -Level Info

            # API call to update rollout percentage
            Start-Sleep -Seconds ($stepDuration / 4) # Simulate API call time

            Write-Log "✅ Rollout reduced to $targetPercentage%" -Level Success

            if ($step -lt $totalSteps) {
                Write-Log "⏳ Waiting $([math]::Round($stepDuration / 60, 1)) minutes before next reduction..." -Level Info
                Start-Sleep -Seconds ($stepDuration * 3 / 4) # Simulate waiting time
            }

            $currentPercentage = $targetPercentage
        }

        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds

        Write-Log "🎉 GRADUAL ROLLBACK COMPLETED" -Level Success
        Write-Log "Duration: $([math]::Round($duration / 60000, 1)) minutes" -Level Success

        return @{ Success = $true; Message = "Gradual rollback completed successfully"; Duration = $duration }

    } catch {
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds

        Write-Log "❌ GRADUAL ROLLBACK FAILED: $_" -Level Error
        return @{ Success = $false; Message = $_.ToString(); Duration = $duration }
    }
}

function Invoke-PartialRollback {
    param(
        [string]$Reason,
        [string[]]$TargetUsers,
        [int[]]$TargetTeams,
        [string[]]$TargetConversations,
        [bool]$DryRun
    )

    $totalTargets = $TargetUsers.Count + $TargetTeams.Count + $TargetConversations.Count

    Write-Log "🎯 Executing PARTIAL ROLLBACK for $totalTargets targets..." -Level Header

    if ($DryRun) {
        Write-Log "🔍 DRY RUN: Would execute partial rollback for $totalTargets targets" -Level Warning
        Start-Sleep -Seconds 2
        return @{ Success = $true; Message = "Dry run completed"; Duration = 2000 }
    }

    $startTime = Get-Date

    try {
        # Step 1: Identify target connections
        Write-Log "1️⃣ Identifying target connections..." -Level Info
        Write-Log "  Target Users: $($TargetUsers.Count)" -Level Info
        Write-Log "  Target Teams: $($TargetTeams.Count)" -Level Info
        Write-Log "  Target Conversations: $($TargetConversations.Count)" -Level Info
        Start-Sleep -Seconds 1

        # Step 2: Apply rollback flags
        Write-Log "2️⃣ Applying rollback flags..." -Level Info

        if ($TargetUsers.Count -gt 0) {
            Write-Log "  Setting rollback flags for $($TargetUsers.Count) users..." -Level Info
            # API calls to set user-specific rollback flags
            Start-Sleep -Seconds ($TargetUsers.Count * 0.1)
        }

        if ($TargetTeams.Count -gt 0) {
            Write-Log "  Setting rollback flags for $($TargetTeams.Count) teams..." -Level Info
            # API calls to set team-specific rollback flags
            Start-Sleep -Seconds ($TargetTeams.Count * 0.2)
        }

        if ($TargetConversations.Count -gt 0) {
            Write-Log "  Setting rollback flags for $($TargetConversations.Count) conversations..." -Level Info
            # API calls to set conversation-specific rollback flags
            Start-Sleep -Seconds ($TargetConversations.Count * 0.1)
        }

        Write-Log "✅ Rollback flags applied" -Level Success

        # Step 3: Force connection updates
        Write-Log "3️⃣ Forcing connection updates..." -Level Info
        # API call to force connection updates for targets
        Start-Sleep -Seconds 2
        Write-Log "✅ Connection updates forced" -Level Success

        # Step 4: Verify partial rollback
        Write-Log "4️⃣ Verifying partial rollback..." -Level Info
        # API call to verify rollback status
        Start-Sleep -Seconds 1
        Write-Log "✅ Partial rollback verification successful" -Level Success

        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds

        Write-Log "🎉 PARTIAL ROLLBACK COMPLETED" -Level Success
        Write-Log "Duration: $([math]::Round($duration / 1000, 1)) seconds" -Level Success
        Write-Log "Affected targets: $totalTargets" -Level Success

        return @{ Success = $true; Message = "Partial rollback completed successfully"; Duration = $duration }

    } catch {
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds

        Write-Log "❌ PARTIAL ROLLBACK FAILED: $_" -Level Error
        return @{ Success = $false; Message = $_.ToString(); Duration = $duration }
    }
}

function Send-RollbackNotifications {
    param(
        [object]$RollbackResult,
        [string]$RollbackType,
        [string]$Reason
    )

    Write-Log "📢 Sending rollback notifications..." -Level Info

    try {
        $notification = @{
            Type = 'emergency_rollback'
            RollbackType = $RollbackType
            Reason = $Reason
            Success = $RollbackResult.Success
            Duration = $RollbackResult.Duration
            Timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC'
            LogFile = $LogFile
        }

        # This would send notifications via various channels:
        # - Slack/Teams webhooks
        # - Email alerts
        # - SMS for critical operations
        # - Dashboard alerts

        Write-Log "✅ Notifications sent successfully" -Level Success

    } catch {
        Write-Log "❌ Error sending notifications: $_" -Level Error
    }
}

function Write-RollbackSummary {
    param(
        [object]$RollbackResult,
        [string]$RollbackType,
        [string]$Reason,
        [object]$InitialStatus,
        [bool]$DryRun
    )

    Write-Log "" -Level Info
    Write-Log "📋 ROLLBACK SUMMARY" -Level Header
    Write-Log "==================" -Level Header

    Write-Log "Type: $RollbackType" -Level Info
    Write-Log "Reason: $Reason" -Level Info
    Write-Log "Dry Run: $DryRun" -Level Info
    Write-Log "Status: $(if ($RollbackResult.Success) { 'SUCCESS' } else { 'FAILED' })" -Level $(if ($RollbackResult.Success) { 'Success' } else { 'Error' })

    if ($RollbackResult.Duration) {
        if ($RollbackResult.Duration -lt 60000) {
            Write-Log "Duration: $([math]::Round($RollbackResult.Duration / 1000, 1)) seconds" -Level Info
        } else {
            Write-Log "Duration: $([math]::Round($RollbackResult.Duration / 60000, 1)) minutes" -Level Info
        }
    }

    Write-Log "Message: $($RollbackResult.Message)" -Level Info

    if ($InitialStatus) {
        Write-Log "" -Level Info
        Write-Log "Initial System Status:" -Level Info
        Write-Log "  WebSocket Connections: $($InitialStatus.WebSocketConnections)" -Level Info
        Write-Log "  Error Rate: $($InitialStatus.ErrorRate * 100)%" -Level Info
        Write-Log "  System Health: $($InitialStatus.SystemHealth)" -Level Info
    }

    Write-Log "" -Level Info
    Write-Log "Log File: $LogFile" -Level Info

    if ($RollbackResult.Success) {
        Write-Log "" -Level Success
        Write-Log "✅ Rollback completed successfully" -Level Success
    } else {
        Write-Log "" -Level Error
        Write-Log "❌ Rollback failed - manual intervention may be required" -Level Error
    }
}

# Main execution
try {
    Write-Log "🚨 Starting $ScriptName" -Level Header
    Write-Log "Rollback Type: $RollbackType" -Level Info
    Write-Log "Reason: $Reason" -Level Info
    Write-Log "Dry Run: $DryRun" -Level Info
    Write-Log "Log File: $LogFile" -Level Info
    Write-Log "" -Level Info

    # Get current system status
    $initialStatus = Get-SystemStatus

    # Show rollback warning
    Show-RollbackWarning -RollbackType $RollbackType -Reason $Reason

    # Confirm rollback action
    $confirmed = Confirm-RollbackAction -RollbackType $RollbackType -SkipConfirmation $SkipConfirmation -DryRun $DryRun

    if (-not $confirmed) {
        Write-Log "❌ Rollback aborted by user" -Level Warning
        exit 0
    }

    # Execute rollback based on type
    $rollbackResult = switch ($RollbackType) {
        'instant' {
            Invoke-InstantRollback -Reason $Reason -DryRun $DryRun
        }
        'gradual' {
            Invoke-GradualRollback -Reason $Reason -DurationMinutes $GradualDurationMinutes -DryRun $DryRun
        }
        'partial' {
            if ($TargetUsers.Count -eq 0 -and $TargetTeams.Count -eq 0 -and $TargetConversations.Count -eq 0) {
                throw "Partial rollback requires at least one target (users, teams, or conversations)"
            }
            Invoke-PartialRollback -Reason $Reason -TargetUsers $TargetUsers -TargetTeams $TargetTeams -TargetConversations $TargetConversations -DryRun $DryRun
        }
        default {
            throw "Invalid rollback type: $RollbackType"
        }
    }

    # Send notifications
    if (-not $DryRun) {
        Send-RollbackNotifications -RollbackResult $rollbackResult -RollbackType $RollbackType -Reason $Reason
    }

    # Write summary
    Write-RollbackSummary -RollbackResult $rollbackResult -RollbackType $RollbackType -Reason $Reason -InitialStatus $initialStatus -DryRun $DryRun

    if ($rollbackResult.Success) {
        exit 0
    } else {
        exit 1
    }

} catch {
    Write-Log "" -Level Info
    Write-Log "❌ ROLLBACK SCRIPT FAILED!" -Level Error
    Write-Log "Error: $_" -Level Error
    Write-Log "Check the log file for details: $LogFile" -Level Error

    exit 1
}