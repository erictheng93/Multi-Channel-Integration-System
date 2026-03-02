# 驗證 Cloudflare 資源綁定腳本
# 檢查所有資源是否正確綁定到 mcis-worker

Write-Host "🔍 驗證 Cloudflare 資源綁定狀況..." -ForegroundColor Cyan
Write-Host "Worker 名稱: mcis-worker" -ForegroundColor Yellow
Write-Host ""

# 檢查函數
function Test-CloudflareResource {
    param(
        [string]$Command,
        [string]$ResourceType,
        [string]$ExpectedName = ""
    )
    
    Write-Host "檢查 $ResourceType..." -ForegroundColor White
    try {
        $result = Invoke-Expression $Command 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $ResourceType 查詢成功" -ForegroundColor Green
            if ($ExpectedName -and $result -match $ExpectedName) {
                Write-Host "✅ 找到預期的資源: $ExpectedName" -ForegroundColor Green
            }
            Write-Host $result
        } else {
            Write-Host "❌ $ResourceType 查詢失敗" -ForegroundColor Red
            Write-Host $result
        }
    } catch {
        Write-Host "❌ $ResourceType 查詢出錯: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

# 1. 檢查 D1 資料庫
Write-Host "=== D1 資料庫檢查 ===" -ForegroundColor Magenta
Test-CloudflareResource "wrangler d1 list" "D1 資料庫" "omni-channel-platform"

# 2. 檢查 KV 命名空間
Write-Host "=== KV 命名空間檢查 ===" -ForegroundColor Magenta
Test-CloudflareResource "wrangler kv:namespace list" "KV 命名空間"

# 3. 檢查 R2 存儲桶
Write-Host "=== R2 存儲桶檢查 ===" -ForegroundColor Magenta
Test-CloudflareResource "wrangler r2 bucket list" "R2 存儲桶" "omni-channel-attachments"

# 4. 檢查 Queues
Write-Host "=== Queues 檢查 ===" -ForegroundColor Magenta
Test-CloudflareResource "wrangler queues list" "Queues" "message-queue"

# 5. 檢查 Workers
Write-Host "=== Workers 檢查 ===" -ForegroundColor Magenta
Test-CloudflareResource "wrangler list" "Workers" "mcis-worker"

# 6. 檢查 wrangler.toml 配置
Write-Host "=== 配置檔案檢查 ===" -ForegroundColor Magenta
Write-Host "檢查 wrangler.toml 配置..." -ForegroundColor White

if (Test-Path "wrangler.toml") {
    $config = Get-Content "wrangler.toml" -Raw
    
    # 檢查 worker 名稱
    if ($config -match 'name\s*=\s*"mcis-worker"') {
        Write-Host "✅ Worker 名稱正確: mcis-worker" -ForegroundColor Green
    } else {
        Write-Host "❌ Worker 名稱不正確" -ForegroundColor Red
    }
    
    # 檢查 D1 綁定
    if ($config -match 'database_name\s*=\s*"omni-channel-platform"') {
        Write-Host "✅ D1 資料庫綁定正確: omni-channel-platform" -ForegroundColor Green
    } else {
        Write-Host "❌ D1 資料庫綁定不正確" -ForegroundColor Red
    }
    
    # 檢查 R2 綁定
    if ($config -match 'bucket_name\s*=\s*"omni-channel-attachments-develop"') {
        Write-Host "✅ R2 存儲桶綁定正確: omni-channel-attachments-develop" -ForegroundColor Green
    } else {
        Write-Host "❌ R2 存儲桶綁定不正確" -ForegroundColor Red
    }
    
    # 檢查 KV 綁定
    if ($config -match 'binding\s*=\s*"SESSIONS"' -and $config -match 'binding\s*=\s*"CACHE"') {
        Write-Host "✅ KV 命名空間綁定正確: SESSIONS, CACHE" -ForegroundColor Green
    } else {
        Write-Host "❌ KV 命名空間綁定不完整" -ForegroundColor Red
    }
    
    # 檢查 Queue 綁定
    if ($config -match 'binding\s*=\s*"MESSAGE_QUEUE"') {
        Write-Host "✅ Queue 綁定正確: MESSAGE_QUEUE" -ForegroundColor Green
    } else {
        Write-Host "❌ Queue 綁定不正確" -ForegroundColor Red
    }
    
} else {
    Write-Host "❌ 找不到 wrangler.toml 檔案" -ForegroundColor Red
}

Write-Host ""

# 7. 檢查延遲訊息 worker 配置
Write-Host "=== 延遲訊息 Worker 配置檢查 ===" -ForegroundColor Magenta
if (Test-Path "wrangler-delayed-message.toml") {
    $delayedConfig = Get-Content "wrangler-delayed-message.toml" -Raw
    
    if ($delayedConfig -match 'name\s*=\s*"mcis-worker-delayed"') {
        Write-Host "✅ 延遲訊息 Worker 名稱正確: mcis-worker-delayed" -ForegroundColor Green
    } else {
        Write-Host "❌ 延遲訊息 Worker 名稱不正確" -ForegroundColor Red
    }
} else {
    Write-Host "❌ 找不到 wrangler-delayed-message.toml 檔案" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== 資源綁定驗證完成 ===" -ForegroundColor Cyan

# 8. 提供修復建議
Write-Host ""
Write-Host "🔧 如果發現問題，請執行以下步驟:" -ForegroundColor Yellow
Write-Host "1. 重新登入 Cloudflare: wrangler login" -ForegroundColor White
Write-Host "2. 檢查帳戶權限: wrangler whoami" -ForegroundColor White
Write-Host "3. 創建缺失的資源: npm run setup:production" -ForegroundColor White
Write-Host "4. 重新部署 Worker: wrangler deploy" -ForegroundColor White
Write-Host ""

# 9. 檢查資源 ID 是否需要更新
Write-Host "=== 資源 ID 檢查 ===" -ForegroundColor Magenta
Write-Host "檢查 wrangler.toml 中的資源 ID 是否為佔位符..." -ForegroundColor White

$placeholderIds = @(
    "your-production-sessions-kv-id",
    "your-production-cache-kv-id",
    "your-database-id",
    "your-kv-namespace-id"
)

$configContent = Get-Content "wrangler.toml" -Raw
$hasPlaceholders = $false

foreach ($placeholder in $placeholderIds) {
    if ($configContent -match $placeholder) {
        Write-Host "⚠️  發現佔位符 ID: $placeholder" -ForegroundColor Yellow
        $hasPlaceholders = $true
    }
}

if ($hasPlaceholders) {
    Write-Host ""
    Write-Host "🔧 需要更新佔位符 ID 為實際的資源 ID" -ForegroundColor Yellow
    Write-Host "請執行 'wrangler kv:namespace list' 和 'wrangler d1 list' 獲取實際 ID" -ForegroundColor White
} else {
    Write-Host "✅ 沒有發現佔位符 ID" -ForegroundColor Green
}