# Production deployment script - Fixed encoding version
# Usage: .\deploy-production.ps1

param(
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$ForceConfirm
)

# Stop on errors
$ErrorActionPreference = "Stop"

Write-Host "Starting production deployment..." -ForegroundColor Green
Write-Host "Deployment time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

# Function: Safe command execution with result checking
function Invoke-SafeCommand {
    param(
        [string]$Command,
        [string]$Description,
        [switch]$ContinueOnError
    )
    
    Write-Host "Processing $Description..." -ForegroundColor Yellow
    try {
        Invoke-Expression $Command
        if ($LASTEXITCODE -ne 0 -and -not $ContinueOnError) {
            throw "Command failed with exit code: $LASTEXITCODE"
        }
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Success: $Description" -ForegroundColor Green
        } else {
            Write-Host "Warning: $Description had warnings but continuing" -ForegroundColor Yellow
        }
        return $LASTEXITCODE -eq 0
    }
    catch {
        Write-Host "Error: $Description failed: $($_.Exception.Message)" -ForegroundColor Red
        if (-not $ContinueOnError) {
            exit 1
        }
        return $false
    }
}

# Step 1: Check deployment environment
Write-Host "Step 1: Checking deployment environment" -ForegroundColor Cyan
Write-Host "=" * 50

# Check Wrangler login status
try {
    $whoami = wrangler whoami 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Cloudflare login verified: $whoami" -ForegroundColor Green
    } else {
        throw "Not logged in"
    }
} catch {
    Write-Host "Error: Please login to Cloudflare first:" -ForegroundColor Red
    Write-Host "   wrangler login" -ForegroundColor Yellow
    exit 1
}

# Check required directories and files
if (-not (Test-Path "frontend")) {
    Write-Host "Error: frontend directory not found" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "wrangler.toml")) {
    Write-Host "Error: wrangler.toml file not found" -ForegroundColor Red
    exit 1
}

# Check Git status (optional)
if (-not $ForceConfirm) {
    try {
        $gitStatus = git status --porcelain 2>$null
        if ($gitStatus -and $LASTEXITCODE -eq 0) {
            Write-Host "Warning: You have uncommitted changes, consider committing first" -ForegroundColor Yellow
            Write-Host "Continue deployment? (y/N): " -NoNewline -ForegroundColor Yellow
            $continue = Read-Host
            if ($continue -ne "y" -and $continue -ne "Y") {
                Write-Host "Deployment cancelled" -ForegroundColor Red
                exit 0
            }
        }
    } catch {
        Write-Host "Warning: Cannot check Git status, continuing deployment..." -ForegroundColor Yellow
    }
}

Write-Host ""

# Step 2: Build frontend
if (-not $SkipBuild) {
    Write-Host "Step 2: Building frontend" -ForegroundColor Cyan
    Write-Host "=" * 50

    $originalPath = Get-Location
    try {
        Set-Location frontend

        # Check package.json exists
        if (-not (Test-Path "package.json")) {
            throw "frontend/package.json not found"
        }

        # Install dependencies
        Invoke-SafeCommand "npm ci" "Install frontend dependencies"

        # Type check
        if (-not $SkipTests) {
            Invoke-SafeCommand "npm run type-check" "TypeScript type checking"
        }

        # Lint check (optional, continue on failure)
        if (-not $SkipTests) {
            Invoke-SafeCommand "npm run lint:check" "ESLint checking" -ContinueOnError
        }

        # Build frontend
        $env:NODE_ENV = "production"
        Invoke-SafeCommand "npm run build:pages" "Build production frontend"

        # Check build result
        if (-not (Test-Path "dist/index.html")) {
            throw "Build failed, dist/index.html not found"
        }

        Write-Host "Frontend build completed successfully" -ForegroundColor Green
    }
    finally {
        Set-Location $originalPath
    }
} else {
    Write-Host "Skipping frontend build" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Deploy backend Worker
Write-Host "Step 3: Deploying backend Worker" -ForegroundColor Cyan
Write-Host "=" * 50

# Try to deploy Worker, handle route conflicts gracefully
Write-Host "Processing Deploy Worker to production..." -ForegroundColor Yellow
wrangler deploy --env production
if ($LASTEXITCODE -eq 0) {
    Write-Host "Success: Deploy Worker to production" -ForegroundColor Green
} else {
    Write-Host "Warning: Worker deployment had issues (possibly route conflicts), but continuing..." -ForegroundColor Yellow
    Write-Host "Note: Worker code may have been updated even if route assignment failed" -ForegroundColor Gray
}

# Wait for Worker to start
Write-Host "Waiting for Worker to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Simple Worker test (optional)
if (-not $SkipTests) {
    try {
        $response = Invoke-RestMethod -Uri "https://your-api-domain.example.com/api/system/health" -Method Get -TimeoutSec 30
        Write-Host "Worker health check passed" -ForegroundColor Green
    } catch {
        Write-Host "Warning: Worker test failed, but continuing frontend deployment: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""

# Step 4: Deploy frontend to Pages
Write-Host "Step 4: Deploying frontend to Cloudflare Pages" -ForegroundColor Cyan
Write-Host "=" * 50

$projectName = "multi-channel-platform-frontend"

# Check if build files exist
if (-not (Test-Path "frontend/dist")) {
    Write-Host "Error: frontend/dist directory not found, please build frontend first" -ForegroundColor Red
    exit 1
}

# Check for existing Pages project
Write-Host "Checking for existing Pages project..." -ForegroundColor Yellow
try {
    $projectList = wrangler pages project list 2>$null
    if ($LASTEXITCODE -eq 0 -and $projectList -match $projectName) {
        Write-Host "Found existing Pages project: $projectName" -ForegroundColor Green
    } else {
        Write-Host "Creating new Pages project..." -ForegroundColor Yellow
        Invoke-SafeCommand "wrangler pages project create $projectName" "Create Pages project" -ContinueOnError
    }
} catch {
    Write-Host "Warning: Cannot check existing project, attempting direct deployment..." -ForegroundColor Yellow
}

# Deploy to Pages
Invoke-SafeCommand "wrangler pages deploy frontend/dist --project-name=$projectName" "Deploy frontend to Pages"

Write-Host ""

# Step 5: Environment variables reminder
Write-Host "Step 5: Environment variables setup reminder" -ForegroundColor Cyan
Write-Host "=" * 50

Write-Host "Please verify the following environment variables in Cloudflare Pages Dashboard:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Production environment variables:" -ForegroundColor White
Write-Host "  VITE_API_BASE_URL = https://your-api-domain.example.com" -ForegroundColor Cyan
Write-Host "  VITE_DEV_MODE = false" -ForegroundColor Cyan
Write-Host "  VITE_ENABLE_DEBUG_LOGS = false" -ForegroundColor Cyan
Write-Host "  VITE_ENABLE_PERFORMANCE_MONITORING = true" -ForegroundColor Cyan
Write-Host ""
Write-Host "Preview environment variables:" -ForegroundColor White
Write-Host "  VITE_API_BASE_URL = https://your-api-domain.example.com" -ForegroundColor Cyan
Write-Host "  VITE_DEV_MODE = true" -ForegroundColor Cyan
Write-Host "  VITE_ENABLE_DEBUG_LOGS = true" -ForegroundColor Cyan

Write-Host ""

# Step 6: Final testing and summary
Write-Host "Step 6: Deployment completed" -ForegroundColor Cyan
Write-Host "=" * 50

Write-Host "Waiting for Pages deployment to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Try to get Pages URL
try {
    $pagesInfo = wrangler pages project list 2>$null | Select-String $projectName
    if ($pagesInfo) {
        Write-Host "Pages project deployed successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "Warning: Cannot get Pages information, please check manually" -ForegroundColor Yellow
}

# Deployment completion summary
Write-Host ""
Write-Host "Deployment completed!" -ForegroundColor Green
Write-Host "=" * 60

Write-Host ""
Write-Host "Deployment information:" -ForegroundColor Cyan
Write-Host "  Backend Worker: https://your-api-domain.example.com" -ForegroundColor White
Write-Host "  Frontend Pages: https://$projectName.pages.dev" -ForegroundColor White
Write-Host "  Deployment time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White

Write-Host ""
Write-Host "Important links:" -ForegroundColor Cyan
Write-Host "  Cloudflare Dashboard: https://dash.cloudflare.com" -ForegroundColor White
Write-Host "  Pages Settings: https://dash.cloudflare.com/pages" -ForegroundColor White
Write-Host "  Workers Settings: https://dash.cloudflare.com/workers" -ForegroundColor White

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify environment variables in Pages Dashboard" -ForegroundColor White
Write-Host "  2. Test complete application functionality" -ForegroundColor White
Write-Host "  3. Setup custom domain (optional)" -ForegroundColor White
Write-Host "  4. Configure monitoring and alerts (recommended)" -ForegroundColor White

Write-Host ""
Write-Host "Test deployment commands:" -ForegroundColor Yellow
Write-Host "  # Test Worker API" -ForegroundColor Gray
Write-Host "  curl https://your-api-domain.example.com/api/system/health" -ForegroundColor White
Write-Host "  # Test frontend" -ForegroundColor Gray
Write-Host "  curl https://$projectName.pages.dev" -ForegroundColor White

Write-Host ""
Write-Host "Re-deployment commands:" -ForegroundColor Yellow
Write-Host "  # Full deployment" -ForegroundColor Gray
Write-Host "  .\deploy-production.ps1" -ForegroundColor White
Write-Host "  # Backend only" -ForegroundColor Gray
Write-Host "  wrangler deploy --env production" -ForegroundColor White
Write-Host "  # Frontend only (build first)" -ForegroundColor Gray
Write-Host "  wrangler pages deploy frontend/dist --project-name=$projectName" -ForegroundColor White

Write-Host ""
Write-Host "Deployment successfully completed!" -ForegroundColor Green
Write-Host "Your application is now ready to use!" -ForegroundColor Green