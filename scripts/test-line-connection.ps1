#!/usr/bin/env pwsh

<#
.SYNOPSIS
    LINE OA 雙向連接測試腳本
    
.DESCRIPTION
    測試 LINE OA 與系統的完整連接狀態，包括：
    - Webhook 端點可達性
    - 事件處理功能
    - LINE API 連接
    - 推送訊息功能
    
.PARAMETER WebhookUrl
    Webhook URL (預設: https://multi-channel.imfinethankyouandyou.com/api/webhook)
    
.PARAMETER AccessToken
    LINE Channel Access Token
    
.PARAMETER ChannelSecret
    LINE Channel Secret
    
.PARAMETER TestUserId
    測試用戶 ID (用於推送訊息測試)
    
.PARAMETER Timeout
    請求超時時間 (毫秒，預設: 15000)
    
.EXAMPLE
    .\scripts\test-line-connection.ps1
    
.EXAMPLE
    .\scripts\test-line-connection.ps1 -AccessToken "your-access-token" -ChannelSecret "your-channel-secret"
    
.EXAMPLE
    .\scripts\test-line-connection.ps1 -TestUserId "U1234567890abcdef" -AccessToken "your-token"
#>

param(
    [string]$WebhookUrl = "https://multi-channel.imfinethankyouandyou.com/api/webhook",
    [string]$AccessToken = "",
    [string]$ChannelSecret = "",
    [string]$TestUserId = "",
    [int]$Timeout = 15000
)

# 顏色輸出函數
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    $colorMap = @{
        "Red" = [ConsoleColor]::Red
        "Green" = [ConsoleColor]::Green
        "Yellow" = [ConsoleColor]::Yellow
        "Blue" = [ConsoleColor]::Blue
        "Magenta" = [ConsoleColor]::Magenta
        "Cyan" = [ConsoleColor]::Cyan
        "White" = [ConsoleColor]::White
    }
    
    Write-Host $Message -ForegroundColor $colorMap[$Color]
}

# 檢查 Node.js 是否安裝
function Test-NodeJs {
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-ColorOutput "✅ Node.js 版本: $nodeVersion" "Green"
            return $true
        }
    } catch {
        Write-ColorOutput "❌ 未找到 Node.js，請先安裝 Node.js" "Red"
        return $false
    }
    return $false
}

# 檢查測試檔案是否存在
function Test-TestFile {
    $testFile = "tests/test-line-connection.ts"
    if (Test-Path $testFile) {
        Write-ColorOutput "✅ 找到測試檔案: $testFile" "Green"
        return $true
    } else {
        Write-ColorOutput "❌ 未找到測試檔案: $testFile" "Red"
        return $false
    }
}

# 從環境變數或 .env 檔案讀取設定
function Get-EnvironmentConfig {
    $envFile = ".env"
    $config = @{}
    
    # 讀取 .env 檔案
    if (Test-Path $envFile) {
        Write-ColorOutput "📄 讀取環境變數檔案: $envFile" "Blue"
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                $config[$key] = $value
            }
        }
    }
    
    # 檢查相關的環境變數
    $envVars = @(
        "LINE_CHANNEL_ACCESS_TOKEN",
        "LINE_CHANNEL_SECRET",
        "WEBHOOK_URL",
        "TEST_USER_ID"
    )
    
    foreach ($envVar in $envVars) {
        $value = [Environment]::GetEnvironmentVariable($envVar)
        if ($value) {
            $config[$envVar] = $value
        }
    }
    
    return $config
}

# 主要執行函數
function Invoke-LineConnectionTest {
    Write-ColorOutput "🚀 LINE OA 雙向連接測試" "Cyan"
    Write-ColorOutput "=" * 50 "Cyan"
    
    # 檢查先決條件
    if (-not (Test-NodeJs)) {
        exit 1
    }
    
    if (-not (Test-TestFile)) {
        exit 1
    }
    
    # 獲取環境設定
    $envConfig = Get-EnvironmentConfig()
    
    # 使用參數或環境變數
    $finalWebhookUrl = if ($WebhookUrl) { $WebhookUrl } else { $envConfig["WEBHOOK_URL"] }
    $finalAccessToken = if ($AccessToken) { $AccessToken } else { $envConfig["LINE_CHANNEL_ACCESS_TOKEN"] }
    $finalChannelSecret = if ($ChannelSecret) { $ChannelSecret } else { $envConfig["LINE_CHANNEL_SECRET"] }
    $finalTestUserId = if ($TestUserId) { $TestUserId } else { $envConfig["TEST_USER_ID"] }
    
    if (-not $finalWebhookUrl) {
        $finalWebhookUrl = "https://multi-channel.imfinethankyouandyou.com/api/webhook"
    }
    
    # 顯示測試配置
    Write-ColorOutput "`n📋 測試配置:" "Yellow"
    Write-ColorOutput "   Webhook URL: $finalWebhookUrl" "White"
    Write-ColorOutput "   Access Token: $(if ($finalAccessToken) { '已設定 (' + $finalAccessToken.Substring(0, [Math]::Min(10, $finalAccessToken.Length)) + '...)' } else { '未設定' })" "White"
    Write-ColorOutput "   Channel Secret: $(if ($finalChannelSecret) { '已設定' } else { '未設定' })" "White"
    Write-ColorOutput "   Test User ID: $(if ($finalTestUserId) { $finalTestUserId.Substring(0, [Math]::Min(8, $finalTestUserId.Length)) + '...' } else { '未設定' })" "White"
    Write-ColorOutput "   Timeout: $Timeout ms" "White"
    
    # 建構命令參數
    $args = @($finalWebhookUrl)
    if ($finalAccessToken) { $args += $finalAccessToken }
    if ($finalChannelSecret) { $args += $finalChannelSecret }
    if ($finalTestUserId) { $args += $finalTestUserId }
    $args += $Timeout.ToString()
    
    Write-ColorOutput "`n🔄 執行測試..." "Blue"
    
    try {
        # 執行測試
        $process = Start-Process -FilePath "node" -ArgumentList @("--loader", "tsx", "tests/test-line-connection.ts") + $args -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-ColorOutput "`n✅ 測試執行完成" "Green"
            
            # 檢查是否有生成報告
            $reportFile = "line-connection-test-report.json"
            if (Test-Path $reportFile) {
                Write-ColorOutput "📄 測試報告已生成: $reportFile" "Green"
                
                # 顯示報告摘要
                try {
                    $report = Get-Content $reportFile | ConvertFrom-Json
                    Write-ColorOutput "`n📊 測試摘要:" "Yellow"
                    Write-ColorOutput "   總測試數: $($report.summary.total)" "White"
                    Write-ColorOutput "   成功: $($report.summary.successful)" "Green"
                    Write-ColorOutput "   失敗: $($report.summary.failed)" "Red"
                    $successRate = [Math]::Round(($report.summary.successful / $report.summary.total) * 100, 1)
                    Write-ColorOutput "   成功率: $successRate%" "White"
                } catch {
                    Write-ColorOutput "⚠️ 無法解析測試報告" "Yellow"
                }
            }
        } else {
            Write-ColorOutput "❌ 測試執行失敗 (退出碼: $($process.ExitCode))" "Red"
            exit $process.ExitCode
        }
    } catch {
        Write-ColorOutput "❌ 執行測試時發生錯誤: $($_.Exception.Message)" "Red"
        exit 1
    }
}

# 顯示幫助資訊
function Show-Help {
    Write-ColorOutput @"
LINE OA 雙向連接測試工具

用法:
    .\scripts\test-line-connection.ps1 [選項]

選項:
    -WebhookUrl <url>      Webhook URL (預設: https://multi-channel.imfinethankyouandyou.com/api/webhook)
    -AccessToken <token>   LINE Channel Access Token
    -ChannelSecret <secret> LINE Channel Secret  
    -TestUserId <userId>   測試用戶 ID (用於推送訊息測試)
    -Timeout <ms>          請求超時時間 (預設: 15000ms)
    -Help                  顯示此幫助資訊

範例:
    # 基本測試 (只測試 Webhook 可達性)
    .\scripts\test-line-connection.ps1
    
    # 完整測試 (包含 LINE API 功能)
    .\scripts\test-line-connection.ps1 -AccessToken "your-token" -ChannelSecret "your-secret"
    
    # 包含推送訊息測試
    .\scripts\test-line-connection.ps1 -AccessToken "your-token" -TestUserId "U1234567890abcdef"

環境變數:
    也可以透過環境變數或 .env 檔案設定：
    - LINE_CHANNEL_ACCESS_TOKEN
    - LINE_CHANNEL_SECRET  
    - WEBHOOK_URL
    - TEST_USER_ID

測試項目:
    ✅ 系統健康狀態檢查
    ✅ Webhook 端點可達性測試
    ✅ Webhook 事件處理測試
    ✅ LINE API 連接測試 (需要 Access Token)
    ✅ 推送訊息功能測試 (需要 Access Token 和 User ID)
"@ "White"
}

# 檢查是否要顯示幫助
if ($args -contains "-Help" -or $args -contains "--help" -or $args -contains "-h") {
    Show-Help
    exit 0
}

# 執行主要功能
Invoke-LineConnectionTest