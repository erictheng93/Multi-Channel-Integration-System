# WebSocket 100% 遷移腳本 (PowerShell 版本)
# 自動化執行從 50% → 75% → 100% 的遷移流程

param(
    [string]$ApiBase = "https://multi-channel.imfinethankyouandyou.com",
    [string]$AdminToken = $env:ADMIN_TOKEN
)

Write-Host "🚀 WebSocket 遷移到 100% 自動化腳本" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 檢查 token
if (-not $AdminToken) {
    Write-Host "❌ 錯誤: 未設置 ADMIN_TOKEN 環境變數" -ForegroundColor Red
    Write-Host ""
    Write-Host "請先獲取管理員 token:" -ForegroundColor Yellow
    Write-Host "1. 登入 https://multi-channel.imfinethankyouandyou.com" -ForegroundColor Yellow
    Write-Host "2. 開啟 DevTools (F12) → Application → Local Storage" -ForegroundColor Yellow
    Write-Host "3. 複製 'auth_token' 的值" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "然後運行:" -ForegroundColor Yellow
    Write-Host '  $env:ADMIN_TOKEN = "your-token-here"' -ForegroundColor White
    Write-Host "  .\scripts\migrate-to-100-percent.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "或參考: GET_ADMIN_TOKEN_GUIDE.md" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Token 已設置" -ForegroundColor Green
Write-Host ""

# 函數: 檢查當前狀態
function Check-Status {
    Write-Host "📊 檢查當前遷移狀態..." -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "$ApiBase/api/websocket/migration-status" -Method Get
        $rollout = $response.rolloutPercentage
        Write-Host "當前 Rollout: $rollout%" -ForegroundColor Green
        Write-Host ""
        return $rollout
    } catch {
        Write-Host "❌ 無法獲取狀態: $_" -ForegroundColor Red
        throw
    }
}

# 函數: 更新 rollout
function Update-Rollout {
    param([int]$Target)

    Write-Host "⚡ 提升 Rollout 到 $Target%..." -ForegroundColor Yellow

    try {
        $headers = @{
            "Authorization" = "Bearer $AdminToken"
            "Content-Type" = "application/json"
        }
        $body = @{
            rolloutPercentage = $Target
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$ApiBase/api/websocket/migration-config" `
            -Method Post `
            -Headers $headers `
            -Body $body

        Write-Host "✅ 成功提升到 $Target%" -ForegroundColor Green
        Write-Host ""
        return $true
    } catch {
        Write-Host "❌ 更新失敗: $_" -ForegroundColor Red
        Write-Host $_.Exception.Response.StatusCode -ForegroundColor Red
        return $false
    }
}

# 函數: 驗證健康狀態
function Check-Health {
    Write-Host "🏥 檢查系統健康狀態..." -ForegroundColor Cyan
    try {
        $health = Invoke-RestMethod -Uri "$ApiBase/api/websocket/health" -Method Get
        $status = $health.status

        if ($status -ne "healthy") {
            Write-Host "⚠️  警告: 系統狀態不健康: $status" -ForegroundColor Yellow
            $health | ConvertTo-Json -Depth 10 | Write-Host
            return $false
        }

        Write-Host "✅ 系統健康" -ForegroundColor Green
        Write-Host ""
        return $true
    } catch {
        Write-Host "⚠️  健康檢查失敗: $_" -ForegroundColor Yellow
        return $false
    }
}

# 函數: 等待並監控
function Monitor {
    param([int]$Duration)

    Write-Host "⏳ 監控 $Duration 秒..." -ForegroundColor Cyan
    for ($i = 1; $i -le $Duration; $i++) {
        if ($i % 10 -eq 0) {
            Write-Host "  ⏱  $i/$Duration 秒..." -ForegroundColor Gray
            if (-not (Check-Health)) {
                Write-Host "  ⚠️  健康檢查失敗" -ForegroundColor Yellow
            }
        }
        Start-Sleep -Seconds 1
    }
    Write-Host "✅ 監控完成" -ForegroundColor Green
    Write-Host ""
}

# ============================================
# 主執行流程
# ============================================

Write-Host "階段 1: 驗證初始狀態" -ForegroundColor Magenta
Write-Host "--------------------------------------------" -ForegroundColor Gray
$currentRollout = Check-Status
Check-Health | Out-Null

# 決策邏輯
if ($currentRollout -eq 50) {
    Write-Host "階段 2: 提升到 75%" -ForegroundColor Magenta
    Write-Host "--------------------------------------------" -ForegroundColor Gray

    if (Update-Rollout -Target 75) {
        Monitor -Duration 30  # 監控 30 秒

        Write-Host "階段 3: 提升到 100%" -ForegroundColor Magenta
        Write-Host "--------------------------------------------" -ForegroundColor Gray
        Write-Host "⚠️  準備全量遷移..." -ForegroundColor Yellow
        Write-Host "按 Enter 繼續，或 Ctrl+C 取消" -ForegroundColor Yellow
        Read-Host

        Update-Rollout -Target 100 | Out-Null
    }
}
elseif ($currentRollout -eq 75) {
    Write-Host "階段 2: 提升到 100%（跳過 75%）" -ForegroundColor Magenta
    Write-Host "--------------------------------------------" -ForegroundColor Gray
    Write-Host "⚠️  準備全量遷移..." -ForegroundColor Yellow
    Write-Host "按 Enter 繼續，或 Ctrl+C 取消" -ForegroundColor Yellow
    Read-Host

    Update-Rollout -Target 100 | Out-Null
}
elseif ($currentRollout -eq 100) {
    Write-Host "✅ 已經是 100% Rollout" -ForegroundColor Green
    Write-Host ""
}
else {
    Write-Host "❌ 未知的 Rollout 狀態: $currentRollout%" -ForegroundColor Red
    exit 1
}

Write-Host "階段 4: 驗證最終狀態" -ForegroundColor Magenta
Write-Host "--------------------------------------------" -ForegroundColor Gray
$finalRollout = Check-Status
Check-Health | Out-Null

# 顯示最終配置
Write-Host "📋 最終配置:" -ForegroundColor Cyan
$finalConfig = Invoke-RestMethod -Uri "$ApiBase/api/websocket/migration-status" -Method Get
$finalConfig | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🎉 遷移完成！" -ForegroundColor Green
Write-Host ""
Write-Host "下一步:" -ForegroundColor Yellow
Write-Host "1. 持續監控 24-48 小時" -ForegroundColor White
Write-Host "2. 確認所有用戶使用 WebSocket" -ForegroundColor White
Write-Host "3. 執行 SSE 代碼清理" -ForegroundColor White
Write-Host ""
Write-Host "監控命令:" -ForegroundColor Yellow
Write-Host "  Invoke-RestMethod -Uri $ApiBase/api/websocket/health | ConvertTo-Json" -ForegroundColor White
Write-Host "  Invoke-RestMethod -Uri $ApiBase/api/websocket/migration-status | ConvertTo-Json" -ForegroundColor White
Write-Host ""
