# 一鍵部署腳本
# 自動化整個部署流程

param(
    [string]$Environment = "production",
    [switch]$SkipBuild = $false,
    [switch]$AutoApprove = $false,
    [switch]$Destroy = $false,
    [switch]$Help = $false
)

# 顯示幫助資訊
if ($Help) {
    Write-Host @"
🚀 多渠道客服系統 - 一鍵部署腳本

用法:
  .\quick-deploy.ps1 [選項]

選項:
  -Environment <env>    部署環境 (development/staging/production)
  -SkipBuild           跳過建置步驟
  -AutoApprove         自動批准 Terraform 變更
  -Destroy             銷毀所有資源
  -Help                顯示此幫助資訊

範例:
  .\quick-deploy.ps1                           # 部署到生產環境
  .\quick-deploy.ps1 -Environment staging      # 部署到測試環境
  .\quick-deploy.ps1 -AutoApprove             # 自動批准變更
  .\quick-deploy.ps1 -Destroy                 # 銷毀所有資源

"@ -ForegroundColor Cyan
    exit 0
}

Write-Host "🚀 多渠道客服系統 - 一鍵部署開始" -ForegroundColor Green
Write-Host "環境: $Environment" -ForegroundColor Cyan

# 檢查必要工具
function Test-RequiredTools {
    Write-Host "🔍 檢查必要工具..." -ForegroundColor Yellow
    
    $tools = @(
        @{ Name = "terraform"; Command = "terraform version" },
        @{ Name = "wrangler"; Command = "wrangler --version" },
        @{ Name = "node"; Command = "node --version" },
        @{ Name = "npm"; Command = "npm --version" }
    )
    
    foreach ($tool in $tools) {
        try {
            $null = Invoke-Expression $tool.Command
            Write-Host "  ✅ $($tool.Name) 已安裝" -ForegroundColor Green
        }
        catch {
            Write-Host "  ❌ $($tool.Name) 未安裝或不在 PATH 中" -ForegroundColor Red
            Write-Host "     請安裝 $($tool.Name) 後重試" -ForegroundColor Red
            exit 1
        }
    }
}

# 檢查 Cloudflare 登入狀態
function Test-CloudflareAuth {
    Write-Host "🔐 檢查 Cloudflare 認證..." -ForegroundColor Yellow
    
    try {
        $whoami = wrangler whoami 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Cloudflare 已登入" -ForegroundColor Green
        } else {
            Write-Host "  ❌ 請先登入 Cloudflare: wrangler login" -ForegroundColor Red
            exit 1
        }
    }
    catch {
        Write-Host "  ❌ 無法檢查 Cloudflare 登入狀態" -ForegroundColor Red
        exit 1
    }
}

# 檢查配置檔案
function Test-Configuration {
    Write-Host "📋 檢查配置檔案..." -ForegroundColor Yellow
    
    if (-not (Test-Path "terraform.tfvars")) {
        if (Test-Path "terraform.tfvars.example") {
            Write-Host "  ⚠️  terraform.tfvars 不存在，正在從範例建立..." -ForegroundColor Yellow
            Copy-Item "terraform.tfvars.example" "terraform.tfvars"
            Write-Host "  📝 請編輯 terraform.tfvars 並填入實際值" -ForegroundColor Red
            Write-Host "     特別是以下必填項目:" -ForegroundColor Red
            Write-Host "     - cloudflare_account_id" -ForegroundColor Red
            Write-Host "     - line_channel_access_token" -ForegroundColor Red
            Write-Host "     - line_channel_secret" -ForegroundColor Red
            Write-Host "     - admin_email" -ForegroundColor Red
            Write-Host "     - admin_password" -ForegroundColor Red
            exit 1
        } else {
            Write-Host "  ❌ terraform.tfvars 和 terraform.tfvars.example 都不存在" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host "  ✅ terraform.tfvars 存在" -ForegroundColor Green
}

# 建置應用程式
function Build-Application {
    if ($SkipBuild) {
        Write-Host "⏭️  跳過建置步驟" -ForegroundColor Yellow
        return
    }
    
    Write-Host "🔨 建置應用程式..." -ForegroundColor Yellow
    
    # 安裝後端依賴
    Write-Host "  📦 安裝後端依賴..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ 後端依賴安裝失敗" -ForegroundColor Red
        exit 1
    }
    
    # 建置後端
    Write-Host "  🔨 建置後端..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ 後端建置失敗" -ForegroundColor Red
        exit 1
    }
    
    # 安裝前端依賴
    Write-Host "  📦 安裝前端依賴..." -ForegroundColor Cyan
    Set-Location frontend
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ 前端依賴安裝失敗" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    
    # 建置前端
    Write-Host "  🔨 建置前端..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ 前端建置失敗" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    
    Set-Location ..
    Write-Host "  ✅ 應用程式建置完成" -ForegroundColor Green
}

# 初始化 Terraform
function Initialize-Terraform {
    Write-Host "🏗️  初始化 Terraform..." -ForegroundColor Yellow
    
    terraform init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Terraform 初始化失敗" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✅ Terraform 初始化完成" -ForegroundColor Green
}

# 驗證 Terraform 配置
function Test-TerraformConfiguration {
    Write-Host "✅ 驗證 Terraform 配置..." -ForegroundColor Yellow
    
    terraform validate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Terraform 配置驗證失敗" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✅ Terraform 配置驗證通過" -ForegroundColor Green
}

# 規劃部署
function Plan-Deployment {
    Write-Host "📋 規劃部署變更..." -ForegroundColor Yellow
    
    $planArgs = @("-var", "environment=$Environment")
    if ($AutoApprove) {
        terraform plan @planArgs -out=tfplan
    } else {
        terraform plan @planArgs
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Terraform 規劃失敗" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✅ 部署規劃完成" -ForegroundColor Green
}

# 執行部署
function Deploy-Infrastructure {
    Write-Host "🚀 執行部署..." -ForegroundColor Yellow
    
    $applyArgs = @("-var", "environment=$Environment")
    
    if ($AutoApprove) {
        if (Test-Path "tfplan") {
            terraform apply tfplan
        } else {
            terraform apply @applyArgs -auto-approve
        }
    } else {
        terraform apply @applyArgs
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ 部署失敗" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✅ 基礎設施部署完成" -ForegroundColor Green
}

# 銷毀資源
function Destroy-Infrastructure {
    Write-Host "💥 銷毀所有資源..." -ForegroundColor Red
    Write-Host "⚠️  這將刪除所有資料，請確認！" -ForegroundColor Yellow
    
    if (-not $AutoApprove) {
        $confirm = Read-Host "輸入 'yes' 確認銷毀所有資源"
        if ($confirm -ne "yes") {
            Write-Host "取消銷毀操作" -ForegroundColor Yellow
            exit 0
        }
    }
    
    terraform destroy -var "environment=$Environment" -auto-approve
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ 資源銷毀失敗" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✅ 所有資源已銷毀" -ForegroundColor Green
}

# 顯示部署結果
function Show-DeploymentResults {
    Write-Host "📊 部署結果:" -ForegroundColor Green
    terraform output
}

# 清理臨時檔案
function Clean-TempFiles {
    if (Test-Path "tfplan") {
        Remove-Item "tfplan"
    }
    if (Test-Path "create_admin.sql") {
        Remove-Item "create_admin.sql"
    }
}

# 主要執行流程
try {
    if ($Destroy) {
        Test-RequiredTools
        Test-CloudflareAuth
        Initialize-Terraform
        Destroy-Infrastructure
    } else {
        Test-RequiredTools
        Test-CloudflareAuth
        Test-Configuration
        Build-Application
        Initialize-Terraform
        Test-TerraformConfiguration
        Plan-Deployment
        Deploy-Infrastructure
        Show-DeploymentResults
        
        Write-Host ""
        Write-Host "🎉 部署完成！" -ForegroundColor Green
        Write-Host "請查看上方的輸出資訊，包含重要的 URL 和下一步操作指引。" -ForegroundColor Cyan
    }
}
catch {
    Write-Host "❌ 部署過程中發生錯誤: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Clean-TempFiles
}

Write-Host ""
Write-Host "✨ 腳本執行完成" -ForegroundColor Green