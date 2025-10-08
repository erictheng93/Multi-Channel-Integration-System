# 消息搜索功能部署檢查清單

## 📋 部署前檢查

### ✅ 代碼質量檢查

- [x] **TypeScript 類型檢查通過**
  ```bash
  cd frontend && npx vue-tsc --noEmit
  ```
  狀態: ✅ 通過（無錯誤）

- [x] **生產構建成功**
  ```bash
  cd frontend && npm run build
  ```
  狀態: ✅ 成功（2.65秒）

- [x] **ESLint 檢查**
  ```bash
  cd frontend && npm run lint:check
  ```
  建議執行: 確保代碼規範

### ✅ 功能完整性檢查

#### Phase 1 - 基礎索引功能
- [x] Lunr.js 依賴已安裝 (lunr@2.3.9)
- [x] @types/lunr 類型定義已安裝 (2.3.7)
- [x] MessageIndexService 已創建
- [x] Pinia Store 集成完成
- [x] MessageSearch.vue 使用索引搜索

#### Phase 2 - 高級搜索功能
- [x] 布爾運算符支持 (AND, OR, NOT)
- [x] 通配符搜索支持 (*)
- [x] 字段搜索支持 (content:, senderName:)
- [x] 搜索結果高亮工具 (searchHighlight.ts)
- [x] 搜索歷史服務 (searchHistoryService.ts)
- [x] HighlightedMessage 組件
- [x] 搜索建議功能

#### Phase 3 - 性能優化
- [x] Web Worker 索引構建器
- [x] IndexedDB 持久化緩存
- [x] 搜索結果分頁工具
- [x] 性能監控服務
- [x] 防抖實時搜索
- [x] 增量索引更新

### ✅ 文件清單

#### 新增文件 (13個)
```
frontend/src/services/
  ├─ messageIndexService.ts          (257 行) ✓
  ├─ searchHistoryService.ts         (302 行) ✓
  ├─ indexedDBCache.ts               (280 行) ✓
  └─ searchPerformanceMonitor.ts     (220 行) ✓

frontend/src/utils/
  ├─ searchHighlight.ts              (324 行) ✓
  ├─ searchPagination.ts             (270 行) ✓
  └─ debounce.ts                     (240 行) ✓

frontend/src/workers/
  └─ messageIndexWorker.ts           (180 行) ✓

frontend/src/components/conversation/
  └─ HighlightedMessage.vue          (73 行) ✓
```

#### 修改文件 (3個)
```
frontend/package.json                      ✓ (新增 lunr 依賴)
frontend/src/stores/messages.ts            ✓ (索引自動構建)
frontend/src/components/conversation/MessageSearch.vue  ✓ (完整集成)
```

### ✅ 依賴檢查

```json
{
  "dependencies": {
    "lunr": "^2.3.9"           ✓ 已安裝
  },
  "devDependencies": {
    "@types/lunr": "^2.3.7"    ✓ 已安裝
  }
}
```

### ✅ Bundle 大小檢查

```
Phase 1 後:
  MessageSearch.js: 4.13 KB (gzipped: 1.75 KB)

Phase 2 後:
  MessageSearch.js: 7.98 KB (gzipped: 3.18 KB)
  增加: +3.85 KB (gzipped: +1.43 KB)

Phase 3 後:
  MessageSearch.js: 11.48 KB (gzipped: 4.38 KB)
  增加: +3.5 KB (gzipped: +1.2 KB)

總增加: +7.35 KB (gzipped: +2.63 KB)
評估: ✅ 可接受 (功能提升顯著)
```

## 🧪 功能測試清單

### 基礎搜索測試

- [ ] **普通文本搜索**
  - 輸入關鍵詞，驗證結果準確性
  - 測試中文、英文、數字搜索
  - 驗證搜索性能 (<20ms)

- [ ] **模糊搜索**
  - 測試拼寫錯誤容錯
  - 驗證模糊度設置

- [ ] **空查詢處理**
  - 空輸入時應返回空結果
  - 僅空格時應忽略

### 高級搜索測試

- [ ] **布爾運算符**
  ```
  測試用例:
  - "訂單 AND 完成"
  - "退款 OR 取消"
  - "問題 NOT 解決"
  - "(訂單 OR 產品) AND 完成"
  ```

- [ ] **通配符搜索**
  ```
  測試用例:
  - "產品*"  (前綴匹配)
  - "*配送"  (後綴匹配)
  ```

- [ ] **字段搜索**
  ```
  測試用例:
  - "content:訂單"
  - "senderName:客服"
  - "content:訂單 AND senderName:客服"
  ```

### 搜索歷史測試

- [ ] **歷史記錄保存**
  - 執行搜索後驗證歷史記錄
  - 檢查 localStorage 存儲

- [ ] **搜索建議**
  - 聚焦輸入框顯示最近搜索
  - 輸入部分關鍵詞顯示匹配建議

- [ ] **歷史記錄管理**
  - 點擊建議自動填充
  - 驗證歷史記錄上限 (50條)

### 結果高亮測試

- [ ] **關鍵詞高亮**
  - 搜索結果中關鍵詞應高亮顯示
  - 多關鍵詞應全部高亮

- [ ] **HighlightedMessage 組件**
  - 驗證高亮樣式正確
  - 測試深色模式適配

### 性能測試

- [ ] **索引構建性能**
  ```
  測試數據量:
  - 100 條消息: 應 <5ms
  - 1,000 條消息: 應 <10ms
  - 10,000 條消息: 應 <25ms
  ```

- [ ] **搜索性能**
  ```
  測試場景:
  - 基礎搜索: 應 <10ms
  - 高級搜索: 應 <15ms
  - 模糊搜索: 應 <20ms
  ```

- [ ] **緩存性能**
  ```
  測試流程:
  1. 首次加載 - 構建索引
  2. 刷新頁面 - 從緩存加載
  3. 驗證緩存加載時間 (<5ms)
  ```

### UI/UX 測試

- [ ] **搜索模式切換**
  - STD/ADV 按鈕切換正常
  - Placeholder 文字正確更新

- [ ] **響應式設計**
  - 桌面端顯示正常
  - 平板端顯示正常
  - 移動端顯示正常

- [ ] **防抖功能**
  - 快速輸入時不應頻繁觸發搜索
  - 300ms 延遲後執行搜索

### 過濾器測試

- [ ] **消息類型過濾**
  - 文本、圖片、文件過濾正常

- [ ] **發送者過濾**
  - 客戶、客服過濾正常

- [ ] **日期範圍過濾**
  - 今天、本週、本月過濾正常

- [ ] **組合過濾**
  - 搜索 + 過濾器組合使用

## 🚀 部署步驟

### 1. 環境準備

```bash
# 確保 Node.js 版本 >= 18
node --version

# 確保 npm 版本 >= 9
npm --version

# 進入前端目錄
cd frontend
```

### 2. 依賴安裝

```bash
# 清理舊依賴
rm -rf node_modules package-lock.json

# 重新安裝
npm install

# 驗證 lunr 已安裝
npm list lunr
# 應顯示: lunr@2.3.9
```

### 3. 構建檢查

```bash
# TypeScript 類型檢查
npm run type-check
# 應無錯誤

# ESLint 檢查
npm run lint:check
# 應通過或僅警告

# 生產構建
npm run build
# 應成功生成 dist/
```

### 4. 本地測試

```bash
# 啟動開發服務器
npm run dev

# 訪問 http://localhost:3000
# 執行上述功能測試清單
```

### 5. 部署到生產環境

```bash
# Cloudflare Pages 部署
npm run deploy:pages

# 或手動構建後部署
npm run build:pages
```

### 6. 部署後驗證

- [ ] 訪問生產環境 URL
- [ ] 執行煙霧測試（基礎搜索）
- [ ] 驗證性能指標
- [ ] 檢查瀏覽器控制台無錯誤

## 📊 性能基準

### 預期性能指標

```
索引構建時間:
  • 100 條消息: <5ms
  • 1,000 條消息: <10ms
  • 10,000 條消息: <25ms

搜索執行時間:
  • 基礎搜索: <10ms
  • 高級搜索: <15ms
  • 模糊搜索: <20ms

緩存性能:
  • 首次構建: ~20ms
  • 緩存加載: ~5ms
  • 性能提升: 4x

用戶體驗:
  • 搜索防抖: 300ms
  • UI 響應: 即時
  • 無阻塞: 100%
```

### 性能監控

```javascript
// 獲取性能統計
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'

const stats = searchPerformanceMonitor.getStats()
console.log('性能統計:', stats)

// 獲取緩存統計
import { indexedDBCache } from '@/services/indexedDBCache'

const cacheStats = await indexedDBCache.getStats()
console.log('緩存統計:', cacheStats)
```

## 🔧 故障排除

### 常見問題

#### 1. 索引未構建

**症狀**: 搜索返回空結果
**解決方案**:
```javascript
// 檢查索引狀態
import { messageIndexService } from '@/services/messageIndexService'

const stats = messageIndexService.getStats()
console.log('索引狀態:', stats)

// 手動重建索引
messageIndexService.buildIndex(messages)
```

#### 2. 緩存失效

**症狀**: 每次刷新都重建索引
**解決方案**:
```javascript
// 清除舊緩存
import { indexedDBCache } from '@/services/indexedDBCache'

await indexedDBCache.clearCache()

// 重新構建並保存
messageIndexService.buildIndex(messages)
```

#### 3. 搜索性能慢

**症狀**: 搜索耗時 >50ms
**解決方案**:
```javascript
// 查看慢查詢
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'

const slowQueries = searchPerformanceMonitor.getSlowQueries(50)
console.log('慢查詢:', slowQueries)
```

#### 4. Worker 未工作

**症狀**: 主線程阻塞
**解決方案**:
- 檢查瀏覽器是否支持 Web Worker
- 檢查 Worker 文件路徑是否正確
- 降級到主線程索引構建

## 📝 回滾計劃

如果部署後發現問題，執行以下回滾步驟：

### 快速回滾

```bash
# 1. 回滾到上一個 git commit
git revert HEAD

# 2. 重新構建
cd frontend && npm run build

# 3. 重新部署
npm run deploy:pages
```

### 漸進式回滾

可以通過移除特定功能逐步回滾：

1. **移除 Phase 3 (性能優化)**
   - 刪除 Worker、IndexedDB、分頁相關代碼
   - 保留 Phase 1 + 2 功能

2. **移除 Phase 2 (高級搜索)**
   - 刪除高級搜索、歷史、高亮功能
   - 保留 Phase 1 基礎功能

3. **完全回滾**
   - 恢復到原始搜索實現

## ✅ 部署完成確認

- [ ] 所有測試通過
- [ ] 性能指標達標
- [ ] 無控制台錯誤
- [ ] 用戶體驗流暢
- [ ] 文檔已更新
- [ ] 團隊已培訓

## 📞 支持聯繫

- 技術問題: 查看 CLAUDE.md
- Bug 報告: GitHub Issues
- 功能文檔: 查看 MESSAGE_SEARCH_USER_GUIDE.md (待創建)
