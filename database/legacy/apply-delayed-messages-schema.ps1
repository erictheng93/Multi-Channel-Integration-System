# 套用延遲訊息功能的資料庫結構
# Apply Delayed Messages Database Schema

Write-Host "Applying delayed messages schema to local D1 database..." -ForegroundColor Green

# 檢查是否存在 schema 檔案
$schemaFile = ".\delayed-messages-schema.sql"
if (-not (Test-Path $schemaFile)) {
    Write-Host "Schema file not found: $schemaFile" -ForegroundColor Red
    exit 1
}

try {
    # 套用 schema 到本地 D1 資料庫
    wrangler d1 execute omni-channel-platform --local --file=$schemaFile
    
    Write-Host "✅ Delayed messages schema applied successfully!" -ForegroundColor Green
    
    # 檢查表是否創建成功
    Write-Host "`nVerifying tables..." -ForegroundColor Yellow
    
    $checkQuery = @"
SELECT name FROM sqlite_master 
WHERE type='table' 
AND name IN ('pending_messages', 'message_recall_logs');
"@
    
    echo $checkQuery | wrangler d1 execute omni-channel-platform --local
    
    Write-Host "`n✅ Database schema verification complete!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Error applying schema: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Run tests: npm run test" -ForegroundColor White
Write-Host "2. Start dev server: npm run dev" -ForegroundColor White
Write-Host "3. Test delayed message API endpoints" -ForegroundColor White