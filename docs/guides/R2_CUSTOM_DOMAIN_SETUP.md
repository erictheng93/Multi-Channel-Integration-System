# R2 自定義域名配置指南

## 概述

本專案已配置 Cloudflare R2 存儲的自定義域名，用於檔案附件的存取。

## 域名配置

### 開發環境
- **Bucket**: `multi-channel-platform-attachments-develop`
- **自定義域名**: `s3dev.imfinethankyouandyou.com`
- **用途**: 開發和測試環境的檔案存取

### 生產環境
- **Bucket**: `multi-channel-platform-attachments-production`
- **自定義域名**: `s3.imfinethankyouandyou.com`
- **用途**: 生產環境的檔案存取

## 環境變數配置

### 開發環境 (.env)
```env
R2_PUBLIC_URL=https://s3dev.imfinethankyouandyou.com
```

### 生產環境 (.env.production)
```env
R2_PUBLIC_URL=https://s3.imfinethankyouandyou.com
```

## Wrangler 配置

在 `wrangler.toml` 中已自動配置：

```toml
# 開發環境變數
[vars]
R2_PUBLIC_URL = "https://s3dev.imfinethankyouandyou.com"

# 生產環境配置
[env.production]
vars = { 
  ENVIRONMENT = "production",
  R2_PUBLIC_URL = "https://s3.imfinethankyouandyou.com"
}

# R2 存儲綁定 - 開發環境
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "multi-channel-platform-attachments-develop"

# 生產環境 R2 綁定
[[env.production.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "multi-channel-platform-attachments-production"
```

## 檔案存取流程

1. **檔案上傳**: 檔案上傳到對應環境的 R2 bucket
2. **URL 生成**: 系統使用 `R2_PUBLIC_URL` 生成公開存取 URL
3. **檔案存取**: 前端通過自定義域名存取檔案

## 部署檢查清單

### 開發環境部署
- [ ] 確認 `.env` 中 `R2_PUBLIC_URL` 設為 `https://s3dev.imfinethankyouandyou.com`
- [ ] 執行 `bun run dev` 測試檔案上傳功能
- [ ] 驗證檔案可通過自定義域名存取

### 生產環境部署
- [ ] 確認 `wrangler.toml` 中生產環境 `R2_PUBLIC_URL` 設為 `https://s3.imfinethankyouandyou.com`
- [ ] 執行 `bun run deploy` 部署到生產環境
- [ ] 測試生產環境檔案上傳和存取功能

## 故障排除

### 檔案無法存取
1. 檢查 R2 bucket 的 CORS 設定
2. 確認自定義域名 DNS 設定正確
3. 驗證 `R2_PUBLIC_URL` 環境變數設定

### 上傳失敗
1. 檢查檔案大小是否超過限制 (預設 10MB)
2. 確認檔案類型是否在允許清單中
3. 檢查 R2 bucket 權限設定

## 相關檔案

- `wrangler.toml`: Worker 配置和 R2 綁定
- `.env.example`: 開發環境變數範例
- `.env.production.example`: 生產環境變數範例
- `src/handlers/attachment.ts`: 檔案上傳處理邏輯
- `scripts/setup-r2-storage.ts`: R2 存儲設定腳本

## 監控和維護

### 檢查 R2 使用量
```bash
# 檢查 bucket 列表
wrangler r2 bucket list

# 檢查檔案列表
wrangler r2 object list multi-channel-platform-attachments-develop
wrangler r2 object list multi-channel-platform-attachments-production
```

### 清理測試檔案
```bash
# 刪除測試檔案 (謹慎使用)
wrangler r2 object delete multi-channel-platform-attachments-develop/test/test-file.txt
```

## 成本優化

- R2 存儲前 10GB 免費
- 自定義域名無額外費用
- 建議定期清理不需要的檔案以控制成本

## 安全考量

- 自定義域名提供更好的品牌一致性
- 檔案 URL 不會暴露 Cloudflare 內部結構
- 可通過 Cloudflare 防火牆規則進一步保護存取