# 部署驗證腳本
# 驗證部署是否成功並測試所有功能

param(
    [string]$Environment = "production",
    [switch]$Verbose = $false
)

Write-Host "🔍 多渠道客服系統 - 部署驗證" -ForegroundColor Green
Write-Host "環境: $Environment" -ForegroundColor Cyan

# 獲取 Terraform 輸出
function Get-TerraformOutputs {
    Write-Host "📋 獲取部署資訊..." -ForegroundColor Yellow
    
    try {
        $outputs = terraform output -json | ConvertFrom-Json
        return $outputs
    }
    catch {
        Write-Host "  ❌ 無法獲取 Terraform 輸出" -ForegroundColor Red
        Write-Host "     請確保已成功部署" -ForegroundColor Red
        exit 1
    }
}

# 測試 API 端點
function Test-ApiEndpoint {
    param(
        [string]$Url,
        [string]$Name
    )
    
    Write-Host "  🌐 測試 $Name..." -ForegroundColor Cyan
    
    try {
        $response = Invoke-RestMethod -Uri "$Url/api/health" -Method GET -TimeoutSec 10
        
        if ($response.status -eq "healthy") {
            Write-Host "    ✅ $Name 正常運行" -ForegroundColor Green
            if ($Verbose) {
                Write-Host "    📊 版本: $($response.version)" -ForegroundColor Gray
                Write-Host "    📊 環境: $($response.environment)" -ForegroundColor Gray
                Write-Host "    📊 資料庫: $($response.database)" -ForegroundColor Gray
            }
            return $true
        } else {
            Write-Host "    ❌ $Name 健康檢查失敗" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "    ❌ $Name 無法連接: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# 測試前端應用
function Test-FrontendApp {
    param([string]$Url)
    
    Write-Host "  🎨 測試前端應用..." -ForegroundColor Cyan
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 10
        
        if ($response.StatusCode -eq 200) {
            Write-Host "    ✅ 前端應用正常載入" -ForegroundColor Green
            
            # 檢查是否包含預期內容
            if ($response.Content -match "多渠道客服系統" -or $response.Content -match "Multi-Channel Platform") {
                Write-Host "    ✅ 前端內容正確" -ForegroundColor Green
                return $true
            } else {
                Write-Host "    ⚠️  前端內容可能不正確" -ForegroundColor Yellow
                return $false
            }
        } else {
            Write-Host "    ❌ 前端應用載入失敗 (HTTP $($response.StatusCode))" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "    ❌ 前端應用無法連接: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# 測試資料庫連接
function Test-DatabaseConnection {
    param([string]$DatabaseName)
    
    Write-Host "  🗄️  測試資料庫連接..." -ForegroundColor Cyan
    
    try {
        $result = wrangler d1 execute $DatabaseName --command="SELECT COUNT(*) as count FROM users" --json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    ✅ 資料庫連接正常" -ForegroundColor Green
            
            if ($Verbose) {
                $data = $result | ConvertFrom-Json
                $userCount = $data.results[0].count
                Write-Host "    📊 用戶數量: $userCount" -ForegroundColor Gray
            }
            return $true
        } else {
            Write-Host "    ❌ 資料庫連接失敗" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "    ❌ 資料庫測試失敗: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# 測試 Webhook 端點
function Test-WebhookEndpoints {
    param([string]$BaseUrl)
    
    Write-Host "  🔗 測試 Webhook 端點..." -ForegroundColor Cyan
    
    $webhooks = @(
        @{ Name = "LINE Webhook"; Path = "/api/webhooks/line" },
        @{ Name = "Facebook Webhook"; Path = "/api/webhooks/facebook" }
    )
    
    $allPassed = $true
    
    foreach ($webhook in $webhooks) {
        try {
            # 發送 GET 請求測試端點是否存在
            $response = Invoke-WebRequest -Uri "$BaseUrl$($webhook.Path)" -Method GET -TimeoutSec 5
            
            # Webhook 端點通常會返回 405 (Method Not Allowed) 對 GET 請求
            if ($response.StatusCode -eq 405 -or $response.StatusCode -eq 200) {
                Write-Host "    ✅ $($webhook.Name) 端點存在" -ForegroundColor Green
            } else {
                Write-Host "    ⚠️  $($webhook.Name) 端點回應異常 (HTTP $($response.StatusCode))" -ForegroundColor Yellow
                $allPassed = $false
            }
        }
        catch {
            if ($_.Exception.Response.StatusCode -eq 405) {
                Write-Host "    ✅ $($webhook.Name) 端點存在" -ForegroundColor Green
            } else {
                Write-Host "    ❌ $($webhook.Name) 端點測試失敗" -ForegroundColor Red
                $allPassed = $false
            }
        }
    }
    
    return $allPassed
}

# 測試認證端點
function Test-AuthEndpoints {
    param([string]$BaseUrl)
    
    Write-Host "  🔐 測試認證端點..." -ForegroundColor Cyan
    
    try {
        # 測試登入端點 (應該返回 400 因為沒有提供憑證)
        $response = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method POST -ContentType "application/json" -Body "{}" -TimeoutSec 5
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 400) {
            Write-Host "    ✅ 登入端點正常運行" -ForegroundColor Green
            return $true
        } else {
            Write-Host "    ❌ 登入端點測試失敗" -ForegroundColor Red
            return $false
        }
    }
    
    return $false
}

# 測試檔案上傳功能
function Test-FileUpload {
    param([string]$BaseUrl)
    
    Write-Host "  📁 測試檔案上傳功能..." -ForegroundColor Cyan
    
    # 這裡只測試端點是否存在，實際上傳需要認證
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/api/conversations/1/attachments" -Method GET -TimeoutSec 5
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host "    ✅ 檔案上傳端點存在 (需要認證)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "    ❌ 檔案上傳端點測試失敗" -ForegroundColor Red
            return $false
        }
    }
    
    return $false
}

# 生成驗證報告
function Generate-ValidationReport {
    param(
        [hashtable]$Results,
        [object]$Outputs
    )
    
    Write-Host ""
    Write-Host "📊 驗證報告" -ForegroundColor Green
    Write-Host "=" * 50 -ForegroundColor Gray
    
    # 基本資訊
    Write-Host "🏷️  專案資訊:" -ForegroundColor Cyan
    Write-Host "   專案名稱: $($Outputs.project_name.value)" -ForegroundColor White
    Write-Host "   環境: $($Outputs.environment.value)" -ForegroundColor White
    Write-Host "   帳戶 ID: $($Outputs.cloudflare_account_id.value)" -ForegroundColor White
    
    Write-Host ""
    Write-Host "🌐 應用程式 URL:" -ForegroundColor Cyan
    Write-Host "   API 後端: $($Outputs.api_url.value)" -ForegroundColor White
    Write-Host "   前端應用: $($Outputs.frontend_url.value)" -ForegroundColor White
    Write-Host "   管理後台: $($Outputs.admin_dashboard_url.value)" -ForegroundColor White
    
    Write-Host ""
    Write-Host "🔗 Webhook URL:" -ForegroundColor Cyan
    Write-Host "   LINE: $($Outputs.line_webhook_url.value)" -ForegroundColor White
    Write-Host "   Facebook: $($Outputs.facebook_webhook_url.value)" -ForegroundColor White
    
    Write-Host ""
    Write-Host "✅ 功能測試結果:" -ForegroundColor Cyan
    
    $totalTests = $Results.Count
    $passedTests = ($Results.Values | Where-Object { $_ -eq $true }).Count
    $successRate = [math]::Round(($passedTests / $totalTests) * 100, 1)
    
    foreach ($test in $Results.GetEnumerator()) {
        $status = if ($test.Value) { "✅" } else { "❌" }
        $color = if ($test.Value) { "Green" } else { "Red" }
        Write-Host "   $status $($test.Key)" -ForegroundColor $color
    }
    
    Write-Host ""
    Write-Host "📈 總體成功率: $successRate% ($passedTests/$totalTests)" -ForegroundColor $(if ($successRate -ge 80) { "Green" } else { "Yellow" })
    
    if ($successRate -eq 100) {
        Write-Host ""
        Write-Host "🎉 所有測試通過！系統已準備就緒。" -ForegroundColor Green
    } elseif ($successRate -ge 80) {
        Write-Host ""
        Write-Host "⚠️  大部分功能正常，請檢查失敗的項目。" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "❌ 多個功能異常，請檢查部署配置。" -ForegroundColor Red
    }
}

# 主要執行流程
try {
    # 獲取部署資訊
    $outputs = Get-TerraformOutputs
    
    Write-Host "🧪 開始功能測試..." -ForegroundColor Yellow
    
    # 執行各項測試
    $testResults = @{}
    
    $testResults["API 健康檢查"] = Test-ApiEndpoint -Url $outputs.api_url.value -Name "API 後端"
    $testResults["前端應用"] = Test-FrontendApp -Url $outputs.frontend_url.value
    $testResults["資料庫連接"] = Test-DatabaseConnection -DatabaseName $outputs.database_name.value
    $testResults["Webhook 端點"] = Test-WebhookEndpoints -BaseUrl $outputs.api_url.value
    $testResults["認證端點"] = Test-AuthEndpoints -BaseUrl $outputs.api_url.value
    $testResults["檔案上傳"] = Test-FileUpload -BaseUrl $outputs.api_url.value
    
    # 生成報告
    Generate-ValidationReport -Results $testResults -Outputs $outputs
    
    # 顯示下一步指引
    Write-Host ""
    Write-Host "🎯 下一步操作:" -ForegroundColor Cyan
    Write-Host "1. 在 LINE Developers Console 設置 Webhook URL" -ForegroundColor White
    Write-Host "2. 訪問管理後台並使用管理員帳戶登入" -ForegroundColor White
    Write-Host "3. 測試發送和接收訊息" -ForegroundColor White
    Write-Host "4. 邀請團隊成員並設置權限" -ForegroundColor White
    Write-Host "5. 開始使用系統處理客戶對話！" -ForegroundColor White
    
}
catch {
    Write-Host "❌ 驗證過程中發生錯誤: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✨ 驗證完成" -ForegroundColor Green