# [API Name] Reference

簡短描述此 API 的用途和功能。

## 概覽

提供 API 的整體說明。

## Base URL

```
https://your-domain.com/api/v1
```

## 認證

說明如何認證API請求。

```bash
# 認證示例
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-domain.com/api/v1/endpoint
```

## 端點列表

| 方法 | 端點 | 描述 |
|------|------|------|
| GET | `/resource` | 獲取資源列表 |
| GET | `/resource/:id` | 獲取單個資源 |
| POST | `/resource` | 創建新資源 |
| PUT | `/resource/:id` | 更新資源 |
| DELETE | `/resource/:id` | 刪除資源 |

## 詳細說明

### GET /resource

獲取資源列表。

**請求參數：**

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| page | number | 否 | 頁碼（默認：1） |
| limit | number | 否 | 每頁數量（默認：10） |
| sort | string | 否 | 排序欄位 |

**請求示例：**

```bash
curl -X GET "https://your-domain.com/api/v1/resource?page=1&limit=10" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**響應示例：**

```json
{
  "success": true,
  "data": [
    {
      "id": "123",
      "name": "Example",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100
  }
}
```

**狀態碼：**

| 狀態碼 | 說明 |
|--------|------|
| 200 | 成功 |
| 401 | 未授權 |
| 500 | 服務器錯誤 |

### POST /resource

創建新資源。

**請求體：**

```json
{
  "name": "string",
  "description": "string",
  "status": "active|inactive"
}
```

**請求示例：**

```bash
curl -X POST "https://your-domain.com/api/v1/resource" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "New Resource",
       "description": "Description",
       "status": "active"
     }'
```

**響應示例：**

```json
{
  "success": true,
  "data": {
    "id": "124",
    "name": "New Resource",
    "description": "Description",
    "status": "active",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

### 其他端點

繼續記錄其他端點...

## 錯誤處理

所有錯誤響應遵循以下格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

### 常見錯誤碼

| 錯誤碼 | 說明 | 解決方案 |
|--------|------|----------|
| AUTH_REQUIRED | 缺少認證令牌 | 提供有效的 Bearer Token |
| INVALID_TOKEN | 令牌無效或過期 | 重新獲取令牌 |
| RESOURCE_NOT_FOUND | 資源不存在 | 檢查資源 ID |
| VALIDATION_ERROR | 請求數據驗證失敗 | 檢查請求參數 |

## 速率限制

API 請求受到速率限制：

- 每分鐘最多 60 次請求
- 超出限制將返回 429 狀態碼

響應頭包含限制信息：

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640000000
```

## 版本控制

API 版本通過 URL 路徑指定：

- v1: `/api/v1/...` (當前版本)
- v2: `/api/v2/...` (未來版本)

## SDK 和庫

可用的官方 SDK：

- **JavaScript/TypeScript**: [鏈接]
- **Python**: [鏈接]
- **其他語言**: [鏈接]

## 相關資源

- [主要文檔](link)
- [示例代碼](link)
- [更新日誌](link)

---

最後更新: YYYY-MM-DD
API 版本: 1.0
作者: [Your Name]
