# 設置延遲發送訊息功能的腳本
# PowerShell script to setup delayed messaging feature

Write-Host "🚀 設置延遲發送訊息功能..." -ForegroundColor Green

# 1. 執行資料庫遷移
Write-Host "📊 執行資料庫遷移..." -ForegroundColor Yellow
try {
    npx wrangler d1 execute mcis-db --file=database/migrations/001_add_delayed_messages.sql
    Write-Host "✅ 資料庫遷移完成" -ForegroundColor Green
} catch {
    Write-Host "❌ 資料庫遷移失敗: $_" -ForegroundColor Red
    exit 1
}

# 2. 創建 KV 命名空間（如果不存在）
Write-Host "🗄️ 檢查 KV 命名空間..." -ForegroundColor Yellow
try {
    $kvList = npx wrangler kv:namespace list | ConvertFrom-Json
    $kvExists = $kvList | Where-Object { $_.title -eq "mcis-kv" }
    
    if (-not $kvExists) {
        Write-Host "創建 KV 命名空間..." -ForegroundColor Yellow
        npx wrangler kv:namespace create "mcis-kv"
        npx wrangler kv:namespace create "mcis-kv" --preview
    } else {
        Write-Host "✅ KV 命名空間已存在" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ KV 命名空間設置失敗: $_" -ForegroundColor Red
    exit 1
}

# 3. 創建 Queue（如果不存在）
Write-Host "📬 檢查 Queue..." -ForegroundColor Yellow
try {
    $queueList = npx wrangler queues list | ConvertFrom-Json
    $queueExists = $queueList | Where-Object { $_.queue_name -eq "delayed-messages" }
    
    if (-not $queueExists) {
        Write-Host "創建 Queue..." -ForegroundColor Yellow
        npx wrangler queues create delayed-messages
    } else {
        Write-Host "✅ Queue 已存在" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Queue 設置失敗: $_" -ForegroundColor Red
    exit 1
}

# 4. 部署 Queue Consumer
Write-Host "🔄 部署 Queue Consumer..." -ForegroundColor Yellow
try {
    # 創建 Queue Consumer 的 wrangler.toml
    $consumerConfig = @"
name = "delayed-message-consumer"
main = "src/queue-consumer.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "development"

[[d1_databases]]
binding = "DB"
database_name = "mcis-db"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"

[[queues.consumers]]
queue = "delayed-messages"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3
dead_letter_queue = "delayed-messages-dlq"
"@

    $consumerConfig | Out-File -FilePath "wrangler-consumer.toml" -Encoding UTF8
    
    npx wrangler deploy --config wrangler-consumer.toml
    Write-Host "✅ Queue Consumer 部署完成" -ForegroundColor Green
} catch {
    Write-Host "❌ Queue Consumer 部署失敗: $_" -ForegroundColor Red
    exit 1
}

# 5. 測試延遲發送功能
Write-Host "🧪 測試延遲發送功能..." -ForegroundColor Yellow
try {
    # 創建測試腳本
    $testScript = @"
// 測試延遲發送功能
interface DelayedMessageRequest {
  conversationId: number;
  content: string;
  delaySeconds: number;
}

const testDelayedMessage = async (): Promise<void> => {
  const requestBody: DelayedMessageRequest = {
    conversationId: 1,
    content: '這是一個測試延遲發送訊息',
    delaySeconds: 10
  };

  const response = await fetch('http://localhost:8787/api/messages/delayed/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TEST_TOKEN'
    },
    body: JSON.stringify(requestBody)
  });
  
  const result = await response.json();
  console.log('延遲發送測試結果:', result);
};

testDelayedMessage();
"@

    $testScript | Out-File -FilePath "test-delayed-message.ts" -Encoding UTF8
    Write-Host "✅ 測試腳本已創建: test-delayed-message.ts" -ForegroundColor Green
} catch {
    Write-Host "❌ 測試腳本創建失敗: $_" -ForegroundColor Red
}

# 6. 更新前端依賴
Write-Host "📦 更新前端依賴..." -ForegroundColor Yellow
try {
    Set-Location frontend
    npm install
    Set-Location ..
    Write-Host "✅ 前端依賴更新完成" -ForegroundColor Green
} catch {
    Write-Host "❌ 前端依賴更新失敗: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 延遲發送訊息功能設置完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 接下來的步驟:" -ForegroundColor Cyan
Write-Host "1. 更新 wrangler.toml 中的 KV 和 Queue ID" -ForegroundColor White
Write-Host "2. 設置環境變數 (LINE_CHANNEL_ACCESS_TOKEN, FB_PAGE_ACCESS_TOKEN 等)" -ForegroundColor White
Write-Host "3. 部署應用程式: npm run deploy" -ForegroundColor White
Write-Host "4. 在前端整合 DelayedMessageSender 元件" -ForegroundColor White
Write-Host ""
Write-Host "🔧 配置檔案:" -ForegroundColor Cyan
Write-Host "- wrangler-delayed-message.toml: Worker 配置" -ForegroundColor White
Write-Host "- wrangler-consumer.toml: Queue Consumer 配置" -ForegroundColor White
Write-Host "- database/migrations/001_add_delayed_messages.sql: 資料庫遷移" -ForegroundColor White
Write-Host ""
Write-Host "📚 使用方式:" -ForegroundColor Cyan
Write-Host "- 前端: 使用 DelayedMessageSender 元件" -ForegroundColor White
Write-Host "- API: POST /api/messages/delayed/send" -ForegroundColor White
Write-Host "- 撤回: POST /api/messages/delayed/recall" -ForegroundColor White