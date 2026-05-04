# LIFF 設置指南 - QR Code 團隊精確綁定

## 概述

本指南說明如何設置 LINE LIFF (LINE Front-end Framework) 以實現 QR Code 掃描後的精確團隊綁定。

### 為什麼需要 LIFF？

LINE 的標準 QR Code 加好友連結 (`https://line.me/R/ti/p/{botId}?ref={token}`) 中的 `ref` 參數**不會**被傳遞到 follow 事件中。這是 LINE 平台的限制，導致無法精確識別用戶是從哪個團隊的 QR Code 加入的。

LIFF 方案通過中間頁面解決這個問題：

```
用戶掃描 QR Code → 打開 LIFF 頁面（帶 token）→ LIFF 獲取用戶資訊 → 精確綁定到團隊
```

## 設置步驟

### 1. 創建 LIFF 應用

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇你的 LINE Official Account 對應的 Provider
3. 選擇或創建一個 LINE Login Channel
4. 在左側選單點擊「LIFF」
5. 點擊「Add」創建新的 LIFF 應用

### 2. 配置 LIFF 應用

填寫以下資訊：

| 欄位 | 值 | 說明 |
|------|-----|------|
| LIFF app name | Multi-Channel QR Bind | 應用名稱 |
| Size | Full | 全螢幕顯示 |
| Endpoint URL | `https://your-frontend-domain.com/liff` | 前端 LIFF 頁面 URL |
| Scope | `profile` | 需要獲取用戶資料 |
| Bot link feature | Aggressive | 自動提示加好友 |

### 3. 獲取 LIFF ID

創建完成後，你會獲得一個 LIFF ID，格式類似：`1234567890-abcdefgh`

### 4. 配置環境變數

#### 後端 (wrangler.toml)

```toml
[vars]
# 前端 URL（用於 QR Code 指向 LIFF 頁面）
FRONTEND_URL = "https://your-frontend-domain.com"
```

#### 前端 (.env.local)

```bash
# LIFF ID
VITE_LIFF_ID=1234567890-abcdefgh

# API URL
VITE_API_URL=https://your-backend-domain.com
```

### 5. 部署

1. 部署後端：`bun run deploy`
2. 部署前端：`cd frontend && bun run build && bun run deploy:pages`

## 流程說明

### QR Code 生成

當團隊生成 QR Code 時：
1. 系統生成唯一的追蹤 token
2. QR Code 指向 LIFF 頁面：`https://frontend-url/liff?token={token}`

### 用戶掃描流程

1. 用戶掃描 QR Code
2. 在 LINE 內開啟 LIFF 頁面
3. LIFF 頁面驗證 token 有效性
4. 如果用戶未登入，自動跳轉 LINE 登入
5. 獲取用戶 LINE Profile（userId, displayName, pictureUrl）
6. 發送到後端 `/api/liff/bind-team` 完成綁定
7. 顯示成功訊息並關閉 LIFF

### API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/liff/verify-token` | POST | 驗證 QR Code token |
| `/api/liff/bind-team` | POST | 綁定用戶到團隊 |

## 故障排除

### LIFF 初始化失敗

- 確認 LIFF ID 正確
- 確認 Endpoint URL 與實際部署 URL 一致
- 確認在 LINE 應用內開啟（非外部瀏覽器）

### Token 驗證失敗

- 確認 QR Code 未過期
- 確認 QR Code 未達使用上限
- 確認 QR Code 未被停用

### 綁定失敗

- 檢查後端日誌
- 確認資料庫連接正常
- 確認 CORS 設置允許前端域名

## 回退機制

如果 LIFF 方案無法使用（例如 LIFF ID 未配置），系統會回退到原有的 5 分鐘窗口匹配機制。但這種方式不可靠，建議正式環境務必配置 LIFF。
