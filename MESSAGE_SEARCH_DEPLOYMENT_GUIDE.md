# 消息搜索功能部署指南

## 📚 快速導航

- [部署前準備](#部署前準備)
- [本地測試部署](#本地測試部署)
- [生產環境部署](#生產環境部署)
- [部署後驗證](#部署後驗證)
- [監控與維護](#監控與維護)
- [故障排除](#故障排除)

---

## 🎯 部署前準備

### 1. 環境要求

**Node.js 環境**:
```bash
node --version   # 需要 >= 18.0.0
npm --version    # 需要 >= 9.0.0
```

**瀏覽器支持**:
- Chrome 120+
- Firefox 120+
- Safari 17+
- Edge 120+

**必需功能**:
- Web Worker 支持
- IndexedDB 支持
- localStorage 支持

### 2. 依賴檢查

```bash
cd frontend

# 檢查 lunr 依賴
npm list lunr
# 應顯示: lunr@2.3.9

# 檢查類型定義
npm list @types/lunr
# 應顯示: @types/lunr@2.3.7
```

### 3. 代碼完整性檢查

```bash
# TypeScript 類型檢查
npm run type-check
# ✓ 應無錯誤

# ESLint 檢查
npm run lint:check
# ✓ 應無嚴重錯誤

# 生產構建測試
npm run build
# ✓ 應成功生成 dist/
```

---

## 🧪 本地測試部署

### Step 1: 清理環境

```bash
cd frontend

# 清理舊構建
rm -rf dist node_modules/.vite

# 可選: 完全重裝依賴
rm -rf node_modules package-lock.json
npm install
```

### Step 2: 啟動開發服務器

```bash
npm run dev
```

訪問: http://localhost:3000

### Step 3: 執行基礎測試

打開瀏覽器控制台，執行：

```javascript
// 1. 檢查索引服務
import { messageIndexService } from '@/services/messageIndexService'
console.log('索引狀態:', messageIndexService.getStats())

// 2. 檢查緩存服務
import { indexedDBCache } from '@/services/indexedDBCache'
indexedDBCache.getStats().then(stats => console.log('緩存統計:', stats))

// 3. 檢查性能監控
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'
console.log('性能統計:', searchPerformanceMonitor.getStats())

// 4. 檢查搜索歷史
import { searchHistoryService } from '@/services/searchHistoryService'
console.log('歷史統計:', searchHistoryService.getStats())
```

### Step 4: 功能測試

參考 `MESSAGE_SEARCH_TEST_CASES.md` 執行：

- [ ] 基礎搜索功能
- [ ] 高級搜索功能
- [ ] 性能驗證
- [ ] UI/UX 測試

---

## 🚀 生產環境部署

### Step 1: 構建生產版本

```bash
cd frontend

# 完整構建（包含類型檢查）
npm run build

# 或僅構建（已通過類型檢查）
npx vite build
```

**構建輸出**:
```
dist/
├─ index.html
├─ assets/
│  ├─ MessageSearch-*.js      (11.48 KB, gzipped: 4.38 KB)
│  ├─ MessageSearch-*.css     (5.99 KB, gzipped: 1.24 KB)
│  └─ ... (其他資源)
```

### Step 2: 部署到 Cloudflare Pages

#### 方法 A: 使用腳本自動部署

```bash
npm run build:pages
npm run deploy:pages
```

#### 方法 B: 手動部署

```bash
# 1. 構建
npm run build

# 2. 複製配置
npm run copy-pages-config

# 3. 部署
npx wrangler pages deploy dist --project-name=multi-channel-frontend
```

#### 方法 C: Git 自動部署

```bash
git add .
git commit -m "feat: add message search optimization (Phase 1-3)"
git push origin main

# Cloudflare Pages 自動構建和部署
```

### Step 3: 環境變量配置

確保以下環境變量已設置：

```env
# .env.production
VITE_API_BASE_URL=https://your-api.workers.dev
VITE_ENABLE_SEARCH_CACHE=true
VITE_SEARCH_DEBUG=false
```

---

## ✅ 部署後驗證

### 1. 煙霧測試（Smoke Test）

訪問生產 URL，執行以下檢查：

- [ ] 頁面正常載入
- [ ] 搜索按鈕可見
- [ ] 執行基礎搜索
- [ ] 瀏覽器控制台無錯誤

### 2. 功能驗證

```javascript
// 在生產環境控制台執行

// 檢查 bundle 載入
console.log('Lunr loaded:', typeof lunr !== 'undefined')

// 檢查服務可用性
console.log('Services:', {
  indexService: !!messageIndexService,
  cacheService: !!indexedDBCache,
  perfMonitor: !!searchPerformanceMonitor,
  historyService: !!searchHistoryService
})
```

### 3. 性能基準驗證

在生產環境執行搜索，驗證性能：

```
預期指標:
- 索引構建 (1000條): <10ms
- 基礎搜索: <10ms
- 高級搜索: <15ms
- 緩存加載: <5ms
```

### 4. 瀏覽器兼容性測試

在以下瀏覽器測試：
- [ ] Chrome (桌面 + 移動)
- [ ] Firefox
- [ ] Safari (桌面 + iOS)
- [ ] Edge

---

## 📊 監控與維護

### 性能監控

#### 查看搜索性能

```javascript
// 獲取性能報告
const report = searchPerformanceMonitor.getPerformanceReport()
console.log(report)

// 導出指標
const metricsJSON = searchPerformanceMonitor.exportMetrics()
console.log(metricsJSON)
```

#### 查看緩存統計

```javascript
const stats = await indexedDBCache.getStats()
console.log('緩存信息:', {
  hasCache: stats.hasCache,
  messageCount: stats.messageCount,
  cacheAge: Math.floor(stats.cacheAge / 1000) + '秒',
  cacheSize: Math.floor(stats.cacheSize / 1024) + 'KB'
})
```

### 定期維護任務

#### 每週任務:
```javascript
// 清理過期緩存
await indexedDBCache.clearCache()

// 重置性能監控
searchPerformanceMonitor.clearMetrics()
```

#### 每月任務:
- 檢查搜索歷史大小
- 分析慢查詢模式
- 優化索引配置

---

## 🔧 故障排除

### 問題 1: 搜索返回空結果

**症狀**: 明明有匹配的消息，但搜索返回空

**排查步驟**:
```javascript
// 1. 檢查索引狀態
const stats = messageIndexService.getStats()
console.log('索引就緒:', stats.isReady)
console.log('消息數量:', stats.messageCount)

// 2. 重建索引
messageIndexService.clearIndex()
messageIndexService.buildIndex(messages)

// 3. 測試搜索
const results = messageIndexService.search('測試')
console.log('結果:', results.length)
```

### 問題 2: 性能下降

**症狀**: 搜索變慢 (>50ms)

**排查步驟**:
```javascript
// 1. 查看慢查詢
const slowQueries = searchPerformanceMonitor.getSlowQueries()
console.log('慢查詢:', slowQueries)

// 2. 檢查緩存
const cacheStats = await indexedDBCache.getStats()
if (!cacheStats.hasCache) {
  console.warn('緩存未命中，需要重建索引')
}

// 3. 清理並重建
await indexedDBCache.clearCache()
location.reload()
```

### 問題 3: Worker 錯誤

**症狀**: 控制台顯示 Worker 相關錯誤

**排查步驟**:
```javascript
// 檢查瀏覽器支持
if (typeof Worker === 'undefined') {
  console.error('瀏覽器不支持 Web Worker')
  // 降級到主線程索引
}

// 檢查 Worker 文件
fetch('/workers/messageIndexWorker.js')
  .then(r => console.log('Worker 文件存在:', r.ok))
  .catch(e => console.error('Worker 文件缺失:', e))
```

### 問題 4: IndexedDB 錯誤

**症狀**: 緩存保存/載入失敗

**排查步驟**:
```javascript
// 1. 檢查 IndexedDB 可用性
if ('indexedDB' in window) {
  console.log('IndexedDB 可用')
} else {
  console.error('IndexedDB 不可用（私密模式？）')
}

// 2. 手動清理
indexedDB.deleteDatabase('MessageIndexCache')

// 3. 刷新頁面
location.reload()
```

---

## 🔄 回滾計劃

如果部署後發現嚴重問題，按以下步驟回滾：

### 方法 A: Git 回滾

```bash
# 1. 回滾 commit
git revert HEAD

# 2. 推送
git push origin main

# 3. Cloudflare Pages 自動重新部署
```

### 方法 B: Cloudflare Pages 控制台回滾

1. 登入 Cloudflare Dashboard
2. 選擇 Pages 項目
3. 在「Deployments」找到上一個穩定版本
4. 點擊「Rollback」

### 方法 C: 漸進式回滾

如果只是特定功能有問題，可以通過特性開關關閉：

```javascript
// 在代碼中添加開關
const ENABLE_ADVANCED_SEARCH = false
const ENABLE_CACHE = false
const ENABLE_WORKER = false
```

---

## 📝 部署檢查清單

### 部署前
- [ ] 代碼通過 TypeScript 檢查
- [ ] 代碼通過 ESLint 檢查
- [ ] 本地測試全部通過
- [ ] 生產構建成功
- [ ] 依賴版本確認

### 部署中
- [ ] 備份當前版本
- [ ] 執行構建
- [ ] 上傳到伺服器/CDN
- [ ] 驗證文件上傳完整

### 部署後
- [ ] 煙霧測試通過
- [ ] 功能測試通過
- [ ] 性能指標達標
- [ ] 多瀏覽器測試通過
- [ ] 監控系統正常

---

## 📞 支持資源

**文檔**:
- 部署檢查清單: `MESSAGE_SEARCH_DEPLOYMENT_CHECKLIST.md`
- 測試案例: `MESSAGE_SEARCH_TEST_CASES.md`
- 用戶指南: `MESSAGE_SEARCH_USER_GUIDE.md` (待創建)

**技術支持**:
- GitHub Issues: [項目地址]
- 項目文檔: `CLAUDE.md`

**性能基準**:
- 索引構建: <25ms (10k 消息)
- 搜索執行: <15ms
- 緩存加載: <5ms
- UI 響應: 即時 (<100ms)

---

## 🎉 部署成功確認

完成以下所有項目即表示部署成功：

✅ **代碼質量**
- TypeScript 0 錯誤
- ESLint 通過
- 構建成功

✅ **功能完整性**
- 14 個核心功能全部可用
- 測試案例通過率 >90%
- 無關鍵 Bug

✅ **性能達標**
- 索引構建 <25ms
- 搜索執行 <15ms
- UI 流暢無阻塞

✅ **用戶體驗**
- 搜索響應快速
- 高亮正確顯示
- 建議智能推薦
- 歷史記錄保存

✅ **監控就緒**
- 性能監控運行
- 緩存統計可查
- 錯誤日誌正常

---

**部署日期**: _______________
**部署人員**: _______________
**版本號**: Phase 1-3 Complete
**簽字確認**: _______________
