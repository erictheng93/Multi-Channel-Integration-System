# 創建測試用戶腳本
# 使用方法: .\create-test-users.ps1

Write-Host "🔐 創建測試用戶..." -ForegroundColor Green

# 檢查是否已登入 Cloudflare
try {
    wrangler whoami | Out-Null
    Write-Host "✅ Cloudflare 已登入" -ForegroundColor Green
} catch {
    Write-Host "❌ 請先登入 Cloudflare: wrangler login" -ForegroundColor Red
    exit 1
}

# 生成密碼哈希的 TypeScript 腳本
$hashScript = @"
import * as crypto from 'crypto';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 測試用戶密碼
const passwords: Record<string, string> = {
  'admin123': hashPassword('admin123'),
  'agent123': hashPassword('agent123'),
  'teamlead123': hashPassword('teamlead123'),
  'superadmin123': hashPassword('superadmin123')
};

console.log(JSON.stringify(passwords, null, 2));
"@

# 生成密碼哈希
Write-Host "🔑 生成密碼哈希..." -ForegroundColor Yellow
$hashScript | Out-File -FilePath "temp-hash.ts" -Encoding UTF8
$passwordHashes = npx tsx temp-hash.ts | ConvertFrom-Json
Remove-Item "temp-hash.ts"

# 創建測試用戶 SQL
$createUsersSQL = @"
-- 創建測試用戶
-- 清理現有測試用戶
DELETE FROM app_users WHERE username IN ('admin', 'agent1', 'teamlead1', 'superadmin');

-- 創建超級管理員
INSERT INTO app_users (username, email, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES (
  'superadmin',
  'superadmin@example.com',
  '$($passwordHashes.'superadmin123')',
  '超級管理員',
  'admin',
  1,
  datetime('now'),
  datetime('now')
);

-- 創建管理員
INSERT INTO app_users (username, email, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES (
  'admin',
  'admin@example.com',
  '$($passwordHashes.'admin123')',
  '系統管理員',
  'admin',
  1,
  datetime('now'),
  datetime('now')
);

-- 創建團隊主管
INSERT INTO app_users (username, email, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES (
  'teamlead1',
  'teamlead1@example.com',
  '$($passwordHashes.'teamlead123')',
  '團隊主管',
  'agent',
  1,
  datetime('now'),
  datetime('now')
);

-- 創建客服人員
INSERT INTO app_users (username, email, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES (
  'agent1',
  'dacagent@dacit.net',
  '$($passwordHashes.'agent123')',
  '客服人員',
  'agent',
  1,
  datetime('now'),
  datetime('now')
);

-- 顯示創建的用戶
SELECT 
  id,
  username,
  email,
  display_name,
  role,
  is_active,
  created_at
FROM app_users 
WHERE username IN ('admin', 'agent1', 'teamlead1', 'superadmin')
ORDER BY role DESC, username;
"@

# 將 SQL 寫入臨時文件
$createUsersSQL | Out-File -FilePath "create-test-users.sql" -Encoding UTF8

# 執行 SQL
Write-Host "👥 創建測試用戶..." -ForegroundColor Yellow
try {
    wrangler d1 execute mcis-db --file=create-test-users.sql --local
    Write-Host "✅ 本地測試用戶創建完成" -ForegroundColor Green
    
    # 也在生產環境創建（如果需要）
    Write-Host "是否也在生產環境創建測試用戶？(y/N): " -NoNewline -ForegroundColor Yellow
    $createProd = Read-Host
    
    if ($createProd -eq "y" -or $createProd -eq "Y") {
        wrangler d1 execute mcis-db --file=create-test-users.sql
        Write-Host "✅ 生產環境測試用戶創建完成" -ForegroundColor Green
    }
    
} catch {
    Write-Host "❌ 創建用戶失敗: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 清理臨時文件
Remove-Item "create-test-users.sql"

Write-Host ""
Write-Host "🎉 測試用戶創建完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 測試用戶清單:" -ForegroundColor Cyan
Write-Host "=" * 60

Write-Host "🔴 超級管理員 (最高權限)" -ForegroundColor Red
Write-Host "   用戶名: superadmin" -ForegroundColor White
Write-Host "   密碼: superadmin123" -ForegroundColor White
Write-Host "   郵箱: superadmin@example.com" -ForegroundColor White
Write-Host "   權限: 所有系統權限" -ForegroundColor White
Write-Host ""

Write-Host "🟠 系統管理員" -ForegroundColor DarkYellow
Write-Host "   用戶名: admin" -ForegroundColor White
Write-Host "   密碼: admin123" -ForegroundColor White
Write-Host "   郵箱: admin@example.com" -ForegroundColor White
Write-Host "   權限: 用戶管理、系統設定、對話管理" -ForegroundColor White
Write-Host ""

Write-Host "🟡 團隊主管" -ForegroundColor Yellow
Write-Host "   用戶名: teamlead1" -ForegroundColor White
Write-Host "   密碼: teamlead123" -ForegroundColor White
Write-Host "   郵箱: teamlead1@example.com" -ForegroundColor White
Write-Host "   權限: 團隊對話管理、訊息處理" -ForegroundColor White
Write-Host ""

Write-Host "🟢 客服人員" -ForegroundColor Green
Write-Host "   用戶名: agent1" -ForegroundColor White
Write-Host "   密碼: agent123" -ForegroundColor White
Write-Host "   郵箱: dacagent@dacit.net" -ForegroundColor White
Write-Host "   權限: 個人對話管理、訊息發送" -ForegroundColor White
Write-Host ""

Write-Host "🧪 測試登入:" -ForegroundColor Cyan
Write-Host "curl -X POST http://localhost:8787/api/auth/login \\" -ForegroundColor Gray
Write-Host "  -H 'Content-Type: application/json' \\" -ForegroundColor Gray
Write-Host "  -d '{\"username\":\"admin\",\"password\":\"admin123\"}'" -ForegroundColor Gray
Write-Host ""

Write-Host "🌐 前端登入:" -ForegroundColor Cyan
Write-Host "訪問 http://localhost:3000 並使用上述用戶名密碼登入" -ForegroundColor White
Write-Host ""

Write-Host "📝 注意事項:" -ForegroundColor Yellow
Write-Host "- 這些是測試用戶，請勿在生產環境使用弱密碼" -ForegroundColor White
Write-Host "- 密碼使用 SHA256 哈希存儲" -ForegroundColor White
Write-Host "- 可以通過管理員帳戶創建更多用戶" -ForegroundColor White