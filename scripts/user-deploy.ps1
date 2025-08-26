# User One-Click Deployment Script (Infrastructure as Code)
# Complete system deployment using Terraform
# Usage: .\user-deploy.ps1 [options]

param(
    [string]$Environment = "production",
    [switch]$AutoApprove,
    [switch]$Destroy,
    [switch]$PlanOnly,
    [switch]$SkipBuild,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
🚀 User One-Click Deployment Script (Terraform-based)

Complete infrastructure deployment for end users.
Creates all Cloudflare resources, deploys code, and sets up the system.

Usage:
  .\user-deploy.ps1 [options]

Options:
  -Environment <env>   Deployment environment (development/production)
  -AutoApprove         Auto-approve Terraform changes (skip confirmation)
  -Destroy            Destroy all infrastructure (DANGEROUS!)
  -PlanOnly           Show deployment plan without applying
  -SkipBuild          Skip application build step
  -Help               Show this help

Examples:
  .\user-deploy.ps1                           # Deploy production environment
  .\user-deploy.ps1 -Environment development  # Deploy to development
  .\user-deploy.ps1 -PlanOnly                # See what would be deployed
  .\user-deploy.ps1 -AutoApprove              # Deploy without confirmation
  .\user-deploy.ps1 -Destroy                 # Destroy all resources

Prerequisites:
  1. Terraform installed (https://terraform.io)
  2. Cloudflare account and API token
  3. Node.js and npm installed
  4. Wrangler CLI installed and logged in

Environment Variables Required:
  CLOUDFLARE_API_TOKEN - Your Cloudflare API token
  TF_VAR_line_channel_access_token - LINE Channel Access Token
  TF_VAR_line_channel_secret - LINE Channel Secret
  TF_VAR_admin_email - Admin user email
  TF_VAR_admin_password - Admin user password

"@ -ForegroundColor Cyan
    exit 0
}

Write-Host "🚀 User Deployment Starting..." -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# Function to check if command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Check required tools
Write-Host "`n🔍 Checking required tools..." -ForegroundColor Yellow
$missingTools = @()

if (-not (Test-Command "terraform")) { $missingTools += "Terraform" }
if (-not (Test-Command "wrangler")) { $missingTools += "Wrangler CLI" }
if (-not (Test-Command "node")) { $missingTools += "Node.js" }
if (-not (Test-Command "npm")) { $missingTools += "npm" }

if ($missingTools.Count -gt 0) {
    Write-Host "Error: Missing required tools:" -ForegroundColor Red
    $missingTools | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host "`nPlease install missing tools and try again." -ForegroundColor Yellow
    exit 1
}
Write-Host "All required tools found" -ForegroundColor Green

# Check environment variables
Write-Host "`n🔍 Checking environment variables..." -ForegroundColor Yellow
$requiredEnvVars = @(
    "CLOUDFLARE_API_TOKEN",
    "TF_VAR_line_channel_access_token",
    "TF_VAR_line_channel_secret",
    "TF_VAR_admin_email",
    "TF_VAR_admin_password"
)

$missingVars = @()
foreach ($var in $requiredEnvVars) {
    if (-not [System.Environment]::GetEnvironmentVariable($var)) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "Error: Missing required environment variables:" -ForegroundColor Red
    $missingVars | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host "`nPlease set these environment variables and try again." -ForegroundColor Yellow
    Write-Host "See README.md for detailed setup instructions." -ForegroundColor Gray
    exit 1
}
Write-Host "All environment variables found" -ForegroundColor Green

# Check Wrangler login
Write-Host "`n🔍 Checking Wrangler login..." -ForegroundColor Yellow
wrangler whoami | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Please login to Wrangler first:" -ForegroundColor Red
    Write-Host "  wrangler login" -ForegroundColor Yellow
    exit 1
}
Write-Host "Wrangler login verified" -ForegroundColor Green

# Build applications
if (-not $SkipBuild) {
    Write-Host "`n📦 Building applications..." -ForegroundColor Cyan
    
    # Build backend
    Write-Host "Building backend..." -ForegroundColor Yellow
    npm ci
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Backend build failed" -ForegroundColor Red
        exit 1
    }
    
    # Build frontend
    Write-Host "Building frontend..." -ForegroundColor Yellow
    $originalPath = Get-Location
    try {
        Set-Location frontend
        npm ci
        npm run type-check
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend type check failed"
        }
        
        $env:NODE_ENV = "production"
        npm run build:pages
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend build failed"
        }
    }
    finally {
        Set-Location $originalPath
    }
    
    Write-Host "Applications built successfully" -ForegroundColor Green
}

# Terraform operations
Write-Host "`n🏗️  Infrastructure deployment with Terraform..." -ForegroundColor Cyan

# Initialize Terraform
Write-Host "Initializing Terraform..." -ForegroundColor Yellow
terraform init
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Terraform initialization failed" -ForegroundColor Red
    exit 1
}

# Select or create workspace
Write-Host "Setting up Terraform workspace..." -ForegroundColor Yellow
terraform workspace select $Environment 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating new workspace: $Environment" -ForegroundColor Gray
    terraform workspace new $Environment
}

# Plan
Write-Host "Creating deployment plan..." -ForegroundColor Yellow
if ($Destroy) {
    terraform plan -destroy -var="environment=$Environment" -out="tfplan"
} else {
    terraform plan -var="environment=$Environment" -out="tfplan"
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Terraform planning failed" -ForegroundColor Red
    exit 1
}

if ($PlanOnly) {
    Write-Host "`n📋 Plan-only mode: Review the plan above" -ForegroundColor Green
    Write-Host "To apply: .\user-deploy.ps1 -Environment $Environment -AutoApprove" -ForegroundColor Yellow
    exit 0
}

# Confirmation
if (-not $AutoApprove) {
    Write-Host "`n⚠️  Ready to apply changes. Continue? (y/N): " -NoNewline -ForegroundColor Yellow
    $confirm = Read-Host
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Deployment cancelled by user" -ForegroundColor Red
        exit 0
    }
}

# Apply
Write-Host "`n🚀 Applying infrastructure changes..." -ForegroundColor Yellow
terraform apply "tfplan"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Terraform apply failed" -ForegroundColor Red
    exit 1
}

# Post-deployment verification
if (-not $Destroy) {
    Write-Host "`n🧪 Verifying deployment..." -ForegroundColor Cyan
    
    # Get outputs
    Write-Host "Getting deployment outputs..." -ForegroundColor Yellow
    $outputs = terraform output -json | ConvertFrom-Json
    
    if ($outputs.worker_url) {
        $workerUrl = $outputs.worker_url.value
        Write-Host "Testing backend API..." -ForegroundColor Yellow
        try {
            $response = Invoke-RestMethod -Uri "$workerUrl/api/system/health" -Method Get -TimeoutSec 30
            Write-Host "Backend health check: OK" -ForegroundColor Green
        } catch {
            Write-Host "Warning: Backend health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    
    if ($outputs.frontend_url) {
        $frontendUrl = $outputs.frontend_url.value
        Write-Host "Testing frontend..." -ForegroundColor Yellow
        try {
            Invoke-RestMethod -Uri $frontendUrl -Method Head -TimeoutSec 30 | Out-Null
            Write-Host "Frontend accessibility: OK" -ForegroundColor Green
        } catch {
            Write-Host "Warning: Frontend test failed: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

# Summary
Write-Host "`n🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "=" * 50

if ($Destroy) {
    Write-Host "All resources have been destroyed" -ForegroundColor Yellow
} else {
    Write-Host "Infrastructure deployed successfully to: $Environment" -ForegroundColor Cyan
    
    # Show important URLs
    try {
        $outputs = terraform output -json | ConvertFrom-Json
        if ($outputs.worker_url) {
            Write-Host "🔧 Backend API: $($outputs.worker_url.value)" -ForegroundColor White
        }
        if ($outputs.frontend_url) {
            Write-Host "🌐 Frontend App: $($outputs.frontend_url.value)" -ForegroundColor White
        }
        if ($outputs.admin_login_url) {
            Write-Host "👤 Admin Panel: $($outputs.admin_login_url.value)" -ForegroundColor White
        }
    } catch {
        Write-Host "Backend:  Check Cloudflare Dashboard for URLs" -ForegroundColor Gray
        Write-Host "Frontend: Check Cloudflare Pages Dashboard" -ForegroundColor Gray
    }
    
    Write-Host "`n📝 Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Test the application thoroughly" -ForegroundColor White
    Write-Host "2. Configure LINE/Facebook webhook URLs" -ForegroundColor White
    Write-Host "3. Set up monitoring and alerts" -ForegroundColor White
    Write-Host "4. Review security settings" -ForegroundColor White
}

Write-Host "`n✨ Completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green