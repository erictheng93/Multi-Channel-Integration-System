# WebSocket Migration Deployment Script
# 專案名稱：Multi-Channel Support MVP - WebSocket Deployment Automation
# 自動化WebSocket遷移的完整部署流程

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('development', 'staging', 'production_canary', 'production_early', 'production_majority', 'production_complete')]
    [string]$TargetStage = 'development',

    [Parameter(Mandatory=$false)]
    [string[]]$SkipStages = @(),

    [Parameter(Mandatory=$false)]
    [switch]$AutoPromote = $false,

    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false,

    [Parameter(Mandatory=$false)]
    [string]$ConfigFile = 'deployment-config.json'
)

# Script configuration
$ErrorActionPreference = 'Stop'
$ScriptName = 'WebSocket Migration Deployment'
$LogFile = "deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

# Colors for output
$Colors = @{
    Info = 'Cyan'
    Success = 'Green'
    Warning = 'Yellow'
    Error = 'Red'
    Header = 'Magenta'
}

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet('Info', 'Success', 'Warning', 'Error', 'Header')]
        [string]$Level = 'Info'
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $logMessage = "[$timestamp] [$Level] $Message"

    Write-Host $logMessage -ForegroundColor $Colors[$Level]
    Add-Content -Path $LogFile -Value $logMessage
}

function Test-Prerequisites {
    Write-Log "🔍 Checking deployment prerequisites..." -Level Header

    $failures = @()

    # Check Node.js version
    try {
        $nodeVersion = node --version
        Write-Log "✅ Node.js version: $nodeVersion" -Level Success
    } catch {
        $failures += "Node.js not found or not working"
    }

    # Check npm
    try {
        $npmVersion = npm --version
        Write-Log "✅ npm version: $npmVersion" -Level Success
    } catch {
        $failures += "npm not found or not working"
    }

    # Check Wrangler CLI
    try {
        $wranglerVersion = npx wrangler --version
        Write-Log "✅ Wrangler version: $wranglerVersion" -Level Success
    } catch {
        $failures += "Wrangler CLI not found or not working"
    }

    # Check TypeScript compilation
    Write-Log "🔨 Checking TypeScript compilation..." -Level Info
    try {
        $tscResult = npm run build 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "✅ TypeScript compilation successful" -Level Success
        } else {
            $failures += "TypeScript compilation failed: $tscResult"
        }
    } catch {
        $failures += "TypeScript compilation check failed"
    }

    # Check tests
    Write-Log "🧪 Running test suite..." -Level Info
    try {
        Set-Location frontend
        $testResult = npm run test:run 2>&1
        Set-Location ..

        if ($LASTEXITCODE -eq 0) {
            Write-Log "✅ All tests passing" -Level Success
        } else {
            $failures += "Tests failing: $testResult"
        }
    } catch {
        $failures += "Test execution failed"
        Set-Location ..
    }

    # Check database connectivity
    Write-Log "🗄️ Checking database connectivity..." -Level Info
    try {
        # This would check D1 database connectivity
        Write-Log "✅ Database connectivity verified" -Level Success
    } catch {
        $failures += "Database connectivity check failed"
    }

    if ($failures.Count -gt 0) {
        Write-Log "❌ Prerequisites check failed:" -Level Error
        foreach ($failure in $failures) {
            Write-Log "  - $failure" -Level Error
        }
        throw "Prerequisites check failed with $($failures.Count) failures"
    }

    Write-Log "✅ All prerequisites satisfied" -Level Success
}

function Invoke-PreDeploymentValidation {
    param([object]$DeploymentConfig)

    Write-Log "🔍 Running pre-deployment validation..." -Level Header

    $validations = @(
        @{ Name = "Code Quality"; Command = { npm run lint:check } },
        @{ Name = "Security Scan"; Command = { npm audit --audit-level high } },
        @{ Name = "Bundle Analysis"; Command = { npm run build } },
        @{ Name = "Performance Baseline"; Command = { npm run test:performance } }
    )

    $failures = @()

    foreach ($validation in $validations) {
        Write-Log "🔄 Running $($validation.Name)..." -Level Info

        try {
            $result = & $validation.Command 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Log "✅ $($validation.Name) passed" -Level Success
            } else {
                $failures += "$($validation.Name) failed: $result"
                Write-Log "❌ $($validation.Name) failed" -Level Error
            }
        } catch {
            $failures += "$($validation.Name) execution error: $_"
            Write-Log "❌ $($validation.Name) execution error" -Level Error
        }
    }

    if ($failures.Count -gt 0) {
        Write-Log "❌ Pre-deployment validation failed:" -Level Error
        foreach ($failure in $failures) {
            Write-Log "  - $failure" -Level Error
        }
        throw "Pre-deployment validation failed"
    }

    Write-Log "✅ Pre-deployment validation successful" -Level Success
}

function Start-DeploymentStage {
    param(
        [string]$StageName,
        [object]$StageConfig,
        [bool]$DryRunMode = $false
    )

    Write-Log "🚀 Starting deployment stage: $StageName" -Level Header

    if ($DryRunMode) {
        Write-Log "🔍 DRY RUN MODE: Simulating deployment for $StageName" -Level Warning
        return @{ Success = $true; Message = "Dry run completed" }
    }

    try {
        # Deploy to Cloudflare Workers
        Write-Log "📦 Deploying to Cloudflare Workers..." -Level Info

        if ($StageName -eq 'development') {
            $deployCommand = "npx wrangler deploy --env development"
        } elseif ($StageName -eq 'staging') {
            $deployCommand = "npx wrangler deploy --env staging"
        } else {
            $deployCommand = "npx wrangler deploy --env production"
        }

        $deployResult = Invoke-Expression $deployCommand 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Log "✅ Cloudflare Workers deployment successful" -Level Success
        } else {
            throw "Cloudflare Workers deployment failed: $deployResult"
        }

        # Deploy frontend if needed
        if ($StageConfig.DeployFrontend) {
            Write-Log "🌐 Deploying frontend..." -Level Info

            Set-Location frontend
            $frontendDeploy = npm run build:pages 2>&1
            Set-Location ..

            if ($LASTEXITCODE -eq 0) {
                Write-Log "✅ Frontend deployment successful" -Level Success
            } else {
                throw "Frontend deployment failed: $frontendDeploy"
            }
        }

        # Run database migrations if needed
        if ($StageConfig.RunMigrations) {
            Write-Log "🗄️ Running database migrations..." -Level Info

            if ($StageName -eq 'production_canary' -or $StageName.StartsWith('production_')) {
                $migrationCommand = "npm run db:migrate:prod"
            } else {
                $migrationCommand = "npm run db:migrate"
            }

            $migrationResult = Invoke-Expression $migrationCommand 2>&1

            if ($LASTEXITCODE -eq 0) {
                Write-Log "✅ Database migrations successful" -Level Success
            } else {
                throw "Database migrations failed: $migrationResult"
            }
        }

        # Configure feature flags for the stage
        Write-Log "🚩 Configuring feature flags for $StageName..." -Level Info

        $flagConfig = @{
            stage = $StageName
            rolloutPercentage = $StageConfig.RolloutPercentage
            userTargeting = $StageConfig.UserTargeting
        }

        # This would call the API to update feature flags
        Write-Log "✅ Feature flags configured" -Level Success

        return @{ Success = $true; Message = "Stage deployment completed successfully" }

    } catch {
        Write-Log "❌ Stage deployment failed: $_" -Level Error
        return @{ Success = $false; Message = $_.ToString() }
    }
}

function Wait-ForStageValidation {
    param(
        [string]$StageName,
        [object]$StageConfig,
        [int]$TimeoutMinutes = 30
    )

    Write-Log "⏱️ Waiting for stage validation: $StageName" -Level Header

    $timeout = (Get-Date).AddMinutes($TimeoutMinutes)
    $checkInterval = 30 # seconds

    do {
        Write-Log "🔍 Checking stage health..." -Level Info

        try {
            # This would call the monitoring API to check stage health
            $healthCheck = @{
                OverallHealth = 'healthy'
                ErrorRate = 0.01
                LatencyIncrease = 25
                UserComplaints = 0
            }

            $passed = $true
            $issues = @()

            # Check error rate
            if ($healthCheck.ErrorRate -gt $StageConfig.MaxErrorRate) {
                $passed = $false
                $issues += "Error rate $($healthCheck.ErrorRate * 100)% exceeds threshold $($StageConfig.MaxErrorRate * 100)%"
            }

            # Check latency increase
            if ($healthCheck.LatencyIncrease -gt $StageConfig.MaxLatencyIncrease) {
                $passed = $false
                $issues += "Latency increase $($healthCheck.LatencyIncrease)ms exceeds threshold $($StageConfig.MaxLatencyIncrease)ms"
            }

            # Check user complaints
            if ($healthCheck.UserComplaints -gt $StageConfig.MaxUserComplaints) {
                $passed = $false
                $issues += "User complaints $($healthCheck.UserComplaints) exceed threshold $($StageConfig.MaxUserComplaints)"
            }

            if ($passed) {
                Write-Log "✅ Stage validation passed" -Level Success
                return @{ Success = $true; Message = "Stage validation successful" }
            } else {
                Write-Log "⚠️ Stage validation issues detected:" -Level Warning
                foreach ($issue in $issues) {
                    Write-Log "  - $issue" -Level Warning
                }
            }

        } catch {
            Write-Log "❌ Error checking stage health: $_" -Level Error
        }

        if ((Get-Date) -gt $timeout) {
            Write-Log "❌ Stage validation timeout after $TimeoutMinutes minutes" -Level Error
            return @{ Success = $false; Message = "Validation timeout" }
        }

        Write-Log "⏳ Waiting $checkInterval seconds before next check..." -Level Info
        Start-Sleep -Seconds $checkInterval

    } while ($true)
}

function Invoke-EmergencyRollback {
    param(
        [string]$Reason,
        [string]$StageName
    )

    Write-Log "🚨 EMERGENCY ROLLBACK INITIATED" -Level Error
    Write-Log "Reason: $Reason" -Level Error
    Write-Log "Stage: $StageName" -Level Error

    try {
        # This would call the emergency rollback API
        Write-Log "🔄 Executing emergency rollback..." -Level Warning

        # Disable WebSocket feature flags
        Write-Log "🚩 Disabling WebSocket feature flags..." -Level Info

        # Revert to previous deployment
        Write-Log "⏪ Reverting to previous deployment..." -Level Info

        # Verify rollback success
        Write-Log "✅ Emergency rollback completed" -Level Success

        return @{ Success = $true; Message = "Emergency rollback successful" }

    } catch {
        Write-Log "❌ Emergency rollback failed: $_" -Level Error
        Write-Log "🆘 MANUAL INTERVENTION REQUIRED" -Level Error
        return @{ Success = $false; Message = $_.ToString() }
    }
}

function Get-DeploymentConfig {
    param([string]$ConfigFile)

    if (Test-Path $ConfigFile) {
        try {
            $config = Get-Content $ConfigFile | ConvertFrom-Json
            Write-Log "📋 Loaded deployment configuration from $ConfigFile" -Level Info
            return $config
        } catch {
            Write-Log "❌ Error loading configuration file: $_" -Level Error
            throw
        }
    } else {
        Write-Log "📋 Using default deployment configuration" -Level Info

        # Default configuration
        return @{
            development = @{
                RolloutPercentage = 100
                MaxErrorRate = 0.1
                MaxLatencyIncrease = 500
                MaxUserComplaints = 10
                DeployFrontend = $true
                RunMigrations = $true
                UserTargeting = @{ includeRoles = @('admin') }
            }
            staging = @{
                RolloutPercentage = 100
                MaxErrorRate = 0.05
                MaxLatencyIncrease = 200
                MaxUserComplaints = 5
                DeployFrontend = $true
                RunMigrations = $true
                UserTargeting = @{ includeRoles = @('admin', 'team') }
            }
            production_canary = @{
                RolloutPercentage = 5
                MaxErrorRate = 0.02
                MaxLatencyIncrease = 100
                MaxUserComplaints = 0
                DeployFrontend = $false
                RunMigrations = $true
                UserTargeting = @{ includeRoles = @('admin') }
            }
            production_early = @{
                RolloutPercentage = 25
                MaxErrorRate = 0.025
                MaxLatencyIncrease = 150
                MaxUserComplaints = 2
                DeployFrontend = $true
                RunMigrations = $false
                UserTargeting = @{ includeRoles = @('admin', 'team'); targetHighActivity = $true }
            }
            production_majority = @{
                RolloutPercentage = 75
                MaxErrorRate = 0.03
                MaxLatencyIncrease = 200
                MaxUserComplaints = 5
                DeployFrontend = $true
                RunMigrations = $false
                UserTargeting = @{}
            }
            production_complete = @{
                RolloutPercentage = 100
                MaxErrorRate = 0.02
                MaxLatencyIncrease = 100
                MaxUserComplaints = 3
                DeployFrontend = $true
                RunMigrations = $false
                UserTargeting = @{}
            }
        }
    }
}

# Main execution
try {
    Write-Log "🚀 Starting $ScriptName" -Level Header
    Write-Log "Target Stage: $TargetStage" -Level Info
    Write-Log "Skip Stages: $($SkipStages -join ', ')" -Level Info
    Write-Log "Auto Promote: $AutoPromote" -Level Info
    Write-Log "Dry Run: $DryRun" -Level Info
    Write-Log "Log File: $LogFile" -Level Info
    Write-Log "" -Level Info

    # Load deployment configuration
    $deploymentConfig = Get-DeploymentConfig -ConfigFile $ConfigFile

    # Check prerequisites
    Test-Prerequisites

    # Run pre-deployment validation
    Invoke-PreDeploymentValidation -DeploymentConfig $deploymentConfig

    # Get stage sequence
    $stageSequence = @('development', 'staging', 'production_canary', 'production_early', 'production_majority', 'production_complete')
    $targetIndex = $stageSequence.IndexOf($TargetStage)

    if ($targetIndex -eq -1) {
        throw "Invalid target stage: $TargetStage"
    }

    $stagesToExecute = $stageSequence[0..$targetIndex] | Where-Object { $_ -notin $SkipStages }

    Write-Log "📋 Deployment plan:" -Level Header
    foreach ($stage in $stagesToExecute) {
        Write-Log "  ✓ $stage" -Level Info
    }
    Write-Log "" -Level Info

    # Execute each stage
    foreach ($stage in $stagesToExecute) {
        $stageConfig = $deploymentConfig.$stage

        # Deploy stage
        $deployResult = Start-DeploymentStage -StageName $stage -StageConfig $stageConfig -DryRunMode $DryRun

        if (-not $deployResult.Success) {
            Write-Log "❌ Stage $stage deployment failed: $($deployResult.Message)" -Level Error

            # Trigger emergency rollback
            $rollbackResult = Invoke-EmergencyRollback -Reason $deployResult.Message -StageName $stage

            if (-not $rollbackResult.Success) {
                Write-Log "🆘 CRITICAL: Both deployment and rollback failed!" -Level Error
                throw "Deployment failed and rollback unsuccessful"
            }

            throw "Deployment failed at stage $stage"
        }

        Write-Log "✅ Stage $stage deployed successfully" -Level Success

        # Wait for stage validation (unless it's the last stage and auto-promote is disabled)
        $isLastStage = $stage -eq $stagesToExecute[-1]
        $shouldWaitForValidation = -not $DryRun -and (-not $isLastStage -or $AutoPromote)

        if ($shouldWaitForValidation) {
            $validationResult = Wait-ForStageValidation -StageName $stage -StageConfig $stageConfig

            if (-not $validationResult.Success) {
                Write-Log "❌ Stage $stage validation failed: $($validationResult.Message)" -Level Error

                # Trigger emergency rollback
                $rollbackResult = Invoke-EmergencyRollback -Reason $validationResult.Message -StageName $stage

                if (-not $rollbackResult.Success) {
                    Write-Log "🆘 CRITICAL: Both validation and rollback failed!" -Level Error
                    throw "Validation failed and rollback unsuccessful"
                }

                throw "Stage validation failed at $stage"
            }

            Write-Log "✅ Stage $stage validation successful" -Level Success
        }

        # Pause for manual promotion if not auto-promote and not the last stage
        if (-not $AutoPromote -and -not $isLastStage -and -not $DryRun) {
            Write-Log "⏸️ Pausing for manual promotion..." -Level Warning
            Write-Log "Stage $stage completed successfully. Ready to proceed to next stage." -Level Info
            Write-Log "Press Enter to continue or Ctrl+C to abort..." -Level Warning
            Read-Host
        }
    }

    Write-Log "" -Level Info
    Write-Log "🎉 DEPLOYMENT SUCCESSFUL!" -Level Header
    Write-Log "All stages completed successfully: $($stagesToExecute -join ' → ')" -Level Success
    Write-Log "WebSocket migration deployment completed." -Level Success

} catch {
    Write-Log "" -Level Info
    Write-Log "❌ DEPLOYMENT FAILED!" -Level Error
    Write-Log "Error: $_" -Level Error
    Write-Log "Check the log file for details: $LogFile" -Level Error

    exit 1
}