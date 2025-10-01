# 🔄 數據庫自動同步系統使用指南

> **Multi-Channel Integration System - Database Synchronization Guide**

## 📋 目錄

1. [系統概覽](#系統概覽)
2. [快速開始](#快速開始)
3. [使用場景](#使用場景)
4. [配置說明](#配置說明)
5. [監控與告警](#監控與告警)
6. [故障排除](#故障排除)
7. [最佳實踐](#最佳實踐)

---

## 🎯 系統概覽

### 核心功能
- ✅ **自動化同步**: 定期將生產環境數據同步到開發環境
- ✅ **智能衝突解決**: 自動處理數據衝突和外鍵約束
- ✅ **安全性保護**: 敏感數據過濾和加密支持
- ✅ **實時監控**: 健康檢查和異常告警
- ✅ **備份恢復**: 自動備份和點對點恢復

### 架構圖

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   生產數據庫    │───→│   同步引擎      │───→│   開發數據庫    │
│                 │    │                 │    │                 │
│ • 23 個表       │    │ • 結構同步      │    │ • 23 個表       │
│ • 完整數據      │    │ • 數據同步      │    │ • 測試數據      │
│ • 高可用性      │    │ • 衝突解決      │    │ • 安全隔離      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   自動備份      │    │   監控告警      │    │   報告系統      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🚀 快速開始

### 1. 確認表結構同步

```bash
# 檢查當前同步狀態
npm run sync:db -- --schema-only

# 結果示例：
# ✅ 本地數據庫: 23 個表
# ✅ 遠端數據庫: 23 個表
# ✅ 表結構一致: 100%
```

### 2. 執行首次數據同步

```bash
# 乾運行模式 (推薦首次使用)
npm run sync:db:to-local

# 實際執行同步
npm run sync:db:live
```

### 3. 啟動自動同步調度器

```bash
# 啟動調度器
npm run sync:scheduler:start

# 檢查狀態
npm run sync:scheduler:status
```

---

## 🎨 使用場景

### 場景一：開發環境數據更新

**需求**: 開發團隊需要最新的生產數據來測試新功能

**解決方案**:
```bash
# 1. 停止本地開發服務
npm run dev:stop

# 2. 同步最新數據 (排除敏感信息)
npm run sync:db:to-local

# 3. 重啟開發服務
npm run dev
```

**預期結果**:
```
📊 同步完成統計:
├── agents: 3 → 3 (已同步)
├── customers: 0 → 3 (新增 3 條)
├── conversations: 0 → 3 (新增 3 條)
└── messages: 0 → 5 (新增 5 條)

⏱️ 總用時: 2.5 秒
💾 備份位置: ./backups/2025-09-25T10-30-00/
```

### 場景二：定期自動同步

**需求**: 每天凌晨自動將生產數據同步到開發環境

**配置**:
```json
{
  "schedule": {
    "enabled": true,
    "interval": 1440,
    "timeWindow": {
      "start": "02:00",
      "end": "04:00"
    }
  }
}
```

**執行**:
```bash
# 啟動調度器服務
npm run sync:scheduler:start

# 服務將在後台運行，每天凌晨2-4點執行同步
```

### 場景三：緊急數據恢復

**需求**: 開發環境數據損壞，需要快速恢復

**解決方案**:
```bash
# 1. 從最近的備份恢復
npm run db:restore -- --from-backup ./backups/latest/

# 2. 或者從生產環境重新同步
npm run sync:db:full -- --no-dry-run
```

---

## ⚙️ 配置說明

### sync.config.json 配置文件

```json
{
  "environments": {
    "development": {
      "sync": {
        "source": "production",       // 數據來源
        "target": "local",            // 同步目標
        "mode": "incremental",        // 同步模式
        "excludeSensitive": true,     // 排除敏感數據
        "tables": [                   // 同步表列表
          "customers",
          "conversations",
          "messages"
        ]
      },
      "schedule": {
        "enabled": true,              // 啟用定時同步
        "interval": 120,              // 間隔（分鐘）
        "timeWindow": {               // 執行時間窗口
          "start": "02:00",
          "end": "06:00"
        }
      }
    }
  }
}
```

### 同步模式說明

```
┌─────────────────┬─────────────────────────────────────┐
│    模式         │                說明                 │
├─────────────────┼─────────────────────────────────────┤
│ schema-only     │ 僅同步表結構，不同步數據            │
│ data-only       │ 僅同步數據，不改變表結構            │
│ incremental     │ 增量同步，僅同步新增和變更數據      │
│ full           │ 完整同步，清空目標後重新同步        │
└─────────────────┴─────────────────────────────────────┘
```

### 安全設置

```json
{
  "security": {
    "sensitiveFields": {
      "agents": ["password_hash", "email"],
      "system_settings": ["*"]
    },
    "encryption": {
      "enabled": true,
      "algorithm": "AES-256-GCM"
    }
  }
}
```

---

## 📊 監控與告警

### 健康檢查面板

```bash
# 檢查系統健康狀態
npm run sync:scheduler:status
```

**輸出示例**:
```json
{
  "status": "healthy",
  "uptime": "2 days 14 hours",
  "lastSync": "2025-09-25T02:15:30Z",
  "nextSync": "2025-09-26T02:00:00Z",
  "databases": {
    "local": "✅ 連接正常",
    "production": "✅ 連接正常"
  },
  "metrics": {
    "totalSyncs": 48,
    "successfulSyncs": 47,
    "failedSyncs": 1,
    "averageSyncTime": "3.2 seconds"
  }
}
```

### 告警配置

```json
{
  "notifications": {
    "channels": {
      "slack": {
        "enabled": true,
        "webhook": "${SLACK_WEBHOOK}",
        "channel": "#database-alerts"
      }
    },
    "triggers": {
      "onError": ["slack"],
      "onWarning": ["slack"]
    }
  }
}
```

---

## 🔧 故障排除

### 常見問題

#### 1. 同步失敗: 外鍵約束錯誤

**錯誤信息**:
```
❌ 同步失敗: FOREIGN KEY constraint failed
```

**解決方案**:
```bash
# 1. 檢查表依賴關係
npm run db:check-dependencies

# 2. 使用依賴順序同步
npm run sync:db -- --respect-dependencies
```

#### 2. 數據量過大導致超時

**錯誤信息**:
```
❌ 同步超時: 操作超過 5 分鐘
```

**解決方案**:
```bash
# 增加超時時間和批次大小
npm run sync:db -- --timeout=1800 --batch-size=500
```

#### 3. 敏感數據洩露風險

**警告信息**:
```
⚠️ 檢測到敏感字段: agents.password_hash
```

**解決方案**:
```bash
# 確保排除敏感數據
npm run sync:db -- --exclude-sensitive
```

### 故障恢復步驟

```
1. 停止同步服務
   npm run sync:scheduler:stop

2. 檢查錯誤日誌
   tail -f logs/sync-scheduler.log

3. 恢復數據庫備份
   npm run db:restore -- --from-backup ./backups/latest/

4. 重新啟動同步
   npm run sync:scheduler:start
```

---

## 🌟 最佳實踐

### 1. 同步前準備

```bash
# ✅ 檢查系統狀態
npm run health:check:all

# ✅ 確認磁碟空間
df -h

# ✅ 備份當前數據
npm run db:backup
```

### 2. 安全性最佳實踐

```json
{
  "security": {
    "bestPractices": [
      "始終排除敏感數據字段",
      "使用加密傳輸和存儲",
      "定期輪換訪問憑證",
      "監控所有同步操作",
      "保留完整的審計日誌"
    ]
  }
}
```

### 3. 性能優化建議

```json
{
  "performance": {
    "recommendations": [
      "使用增量同步減少傳輸量",
      "在低峰期執行同步操作",
      "適當調整批次大小",
      "啟用壓縮減少網絡傳輸",
      "監控系統資源使用"
    ]
  }
}
```

### 4. 監控設置

```bash
# 設置日誌輪轉
logrotate -f /path/to/sync-logs.conf

# 設置磁碟使用告警
echo "90" > /tmp/disk_threshold

# 設置健康檢查
crontab -e
# */5 * * * * /usr/local/bin/sync-health-check.sh
```

---

## 🔗 相關鏈接

- [Database Schema 文檔](./src/db/schema.ts)
- [Migration 管理指南](./migrations/README.md)
- [API 文檔](./API_DOCUMENTATION.md)
- [故障排除手冊](./TROUBLESHOOTING.md)

---

## 📞 技術支持

如果遇到問題，請按以下步驟尋求支持：

1. **查看日誌**: `tail -f logs/sync-scheduler.log`
2. **檢查配置**: `npm run sync:scheduler:status`
3. **運行診斷**: `npm run sync:scheduler:test`
4. **提交問題**: 在 GitHub Issues 中詳細描述問題

---

**最後更新**: 2025-09-25
**版本**: 1.0.0
**維護者**: Multi-Channel Platform Team