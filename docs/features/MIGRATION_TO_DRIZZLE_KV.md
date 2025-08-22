# 遷移到 Drizzle ORM + KV 指南

## 概述

本指南將幫助你從現有的系統遷移到使用 Drizzle ORM 和 Cloudflare KV 的新架構。

## 🔄 遷移步驟

### 1. 備份現有資料

```bash
# 備份 D1 資料庫
wrangler d1 export omni-channel-platform --output backup-$(date +%Y%m%d).sql

# 備份重要配置
cp wrangler.toml wrangler.toml.backup
cp package.json package.json.backup
```

### 2. 更新依賴

```bash
# 安裝 Drizzle ORM 相關依賴
npm install drizzle-orm@^0.36.4
npm install -D drizzle-kit@^0.30.0

# 確認現有依賴
npm list
```

### 3. 建立 KV Namespaces

```bash
# 建立 Sessions KV
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "SESSIONS" --preview

# 建立 Cache KV
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview

# 記錄返回的 namespace IDs
```

### 4. 更新 wrangler.toml

```toml
# 更新主入口點
main = "src/index-drizzle.ts"

# 添加 KV bindings
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-sessions-kv-id"
preview_id = "your-sessions-kv-preview-id"

[[kv_namespaces]]
binding = "CACHE"
id = "your-cache-kv-id"
preview_id = "your-cache-kv-preview-id"
```

### 5. 建立 Drizzle 配置

```bash
# 建立 drizzle.config.ts (已提供)
# 設定環境變數
echo "CLOUDFLARE_ACCOUNT_ID=your-account-id" >> .env
echo "CLOUDFLARE_DATABASE_ID=37537e1f-625e-4cf9-be60-a01b5c063772" >> .env
echo "CLOUDFLARE_D1_TOKEN=your-d1-token" >> .env
```

### 6. 生成和應用 Schema

```bash
# 生成 Drizzle 遷移
npm run db:generate

# 檢查生成的遷移檔案
ls database/migrations/

# 應用到開發環境
npm run db:migrate

# 應用到生產環境
npm run db:migrate:prod
```

### 7. 資料遷移

```bash
# 使用遷移腳本遷移現有資料
# 注意：這會在開發環境中執行遷移邏輯
wrangler dev --local

# 在另一個終端調用遷移端點
curl -X POST http://localhost:8787/migrate-data
```

### 8. 測試新系統

```bash
# 啟動新的 Drizzle 版本
npm run dev

# 測試認證 API
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 測試對話 API
curl -X GET http://localhost:8787/api/conversations \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## 🔍 驗證遷移

### 1. 資料完整性檢查

```sql
-- 檢查用戶數量
SELECT COUNT(*) FROM users;

-- 檢查對話數量
SELECT COUNT(*) FROM conversations;

-- 檢查訊息數量
SELECT COUNT(*) FROM messages;

-- 檢查客服數量
SELECT COUNT(*) FROM agents;
```

### 2. 功能測試

```bash
# 測試 KV Session
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 測試快取功能
curl -X GET http://localhost:8787/api/conversations/conv-123

# 測試延遲訊息
curl -X POST http://localhost:8787/api/delayed-messages/send \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"conv-123","content":"Test","delaySeconds":30}'
```

### 3. 效能驗證

```bash
# 使用 Drizzle Studio 檢查資料庫
npm run db:studio

# 檢查 KV 使用情況
wrangler kv:key list --namespace-id=your-sessions-kv-id
wrangler kv:key list --namespace-id=your-cache-kv-id
```

## 🚨 回滾計劃

如果遷移過程中遇到問題，可以快速回滾：

### 1. 快速回滾

```bash
# 恢復原始配置
cp wrangler.toml.backup wrangler.toml
cp package.json.backup package.json

# 重新安裝原始依賴
npm install

# 恢復原始入口點
# 在 wrangler.toml 中設置 main = "src/index.ts"
```

### 2. 資料恢復

```bash
# 如果需要恢復資料庫
wrangler d1 execute omni-channel-platform --file=backup-YYYYMMDD.sql
```

## 📊 遷移後的優勢

### 1. 效能提升

- **查詢效能**: Drizzle ORM 的查詢最佳化
- **快取命中率**: KV 智能快取減少資料庫查詢
- **Session 效能**: KV 基礎的快速 session 查詢

### 2. 開發體驗

- **型別安全**: 完整的 TypeScript 型別推導
- **IDE 支援**: 優秀的自動完成和錯誤檢測
- **資料庫工具**: Drizzle Studio 視覺化管理

### 3. 維護性

- **清晰架構**: 分層設計，職責分離
- **錯誤處理**: 統一的錯誤處理機制
- **日誌記錄**: 完整的操作日誌

## 🔧 故障排除

### 常見問題

1. **KV Namespace 創建失敗**
   ```bash
   # 檢查 Cloudflare 權限
   wrangler whoami
   
   # 重新創建
   wrangler kv:namespace create "SESSIONS" --force
   ```

2. **Drizzle 遷移失敗**
   ```bash
   # 檢查配置
   cat drizzle.config.ts
   
   # 重新生成
   npm run db:generate -- --force
   ```

3. **Session 認證失敗**
   ```bash
   # 檢查 KV binding
   wrangler kv:key list --namespace-id=your-sessions-kv-id
   
   # 清除所有 session
   wrangler kv:key delete --namespace-id=your-sessions-kv-id session-key
   ```

4. **快取不生效**
   ```bash
   # 檢查 KV 狀態
   wrangler kv:key list --namespace-id=your-cache-kv-id
   
   # 手動清除快取
   wrangler kv:key delete --namespace-id=your-cache-kv-id cache-key
   ```

### 調試技巧

1. **使用 Drizzle Studio**
   ```bash
   npm run db:studio
   # 訪問 https://local.drizzle.studio
   ```

2. **KV 調試**
   ```bash
   # 查看所有 KV keys
   wrangler kv:key list --namespace-id=your-kv-id
   
   # 查看特定 key 的值
   wrangler kv:key get --namespace-id=your-kv-id "session:token"
   ```

3. **日誌監控**
   ```bash
   # 實時查看 Worker 日誌
   wrangler tail --format pretty
   
   # 過濾特定日誌
   wrangler tail --search "Drizzle"
   ```

## 📈 監控和維護

### 1. 效能監控

- 監控 KV 使用量和命中率
- 追蹤資料庫查詢效能
- 監控 session 過期和清理

### 2. 定期維護

```bash
# 清理過期的 KV 資料
# KV 會自動過期，但可以手動清理

# 檢查資料庫統計
npm run db:studio

# 更新 Drizzle 依賴
npm update drizzle-orm drizzle-kit
```

## 🎉 遷移完成

恭喜！你已經成功遷移到 Drizzle ORM + KV 架構。現在你的系統具備：

- ✅ 型別安全的資料庫操作
- ✅ 高效能的 KV 快取
- ✅ 現代化的開發體驗
- ✅ 企業級的擴展性

## 📚 後續學習

- [Drizzle ORM 文檔](https://orm.drizzle.team/)
- [Cloudflare KV 文檔](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [專案完整文檔](./DRIZZLE_KV_INTEGRATION.md)

---

**遷移版本**: 2.0.0  
**最後更新**: 2025-01-11