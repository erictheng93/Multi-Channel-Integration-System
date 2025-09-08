# 對話詳情頁面滾動優化測試指南

## 測試場景

### 1. 基本功能測試
- [ ] 從對話列表進入對話詳情
- [ ] 檢查是否自動滾動到最新消息
- [ ] 檢查消息顯示順序（舊→新）

### 2. 不同消息量測試
- [ ] 短對話（<10條消息）
- [ ] 中等對話（10-50條消息）
- [ ] 長對話（>50條消息）

### 3. 不同內容類型測試
- [ ] 純文字消息
- [ ] 包含圖片的消息
- [ ] 包含附件的消息
- [ ] 混合類型消息

### 4. 網路條件測試
- [ ] 正常網路速度
- [ ] 慢網路條件（開發者工具 → Network → Slow 3G）
- [ ] 網路中斷恢復

## 調試方法

### 1. 瀏覽器控制台檢查
```javascript
// 檢查滾動位置
console.log('Scroll info:', {
  scrollTop: document.querySelector('.messages-container').scrollTop,
  scrollHeight: document.querySelector('.messages-container').scrollHeight,
  clientHeight: document.querySelector('.messages-container').clientHeight
});

// 檢查消息順序
console.log('Messages order:', 
  Array.from(document.querySelectorAll('.message-bubble'))
    .map(el => el.textContent?.substring(0, 30))
);
```

### 2. 網路請求檢查
- 打開 Network 選項卡
- 查找 `/conversations/{id}/messages` 請求
- 檢查響應數據的 `createdAt` 順序

### 3. 控制台日誌關鍵詞
```
🔄 [ConversationDetail] Loading messages
📍 [ConversationDetail] Initial load complete
🔄 [ConversationDetail] DOM mutation detected
✅ [ConversationDetail] Final scroll completed
```

## 預期行為

### 正常情況
1. 進入對話頁面後，應該看到最新消息在底部
2. 控制台應該顯示 MutationObserver 滾動日誌
3. 用戶無需手動滾動

### 異常情況處理
- 如果 300ms 後仍未滾動到底部，會執行備用滾動
- 如果 MutationObserver 失效，依賴超時機制

## 性能監控

```javascript
// 測量滾動性能
console.time('scroll-to-bottom');
// ... 滾動操作
console.timeEnd('scroll-to-bottom');
```

## 回滾計畫

如果新優化導致問題：

1. **前端快速回滾**：
   - 恢復簡單的 `setTimeout` 滾動邏輯
   - 移除 MutationObserver

2. **後端回滾**：
   - 將 `orderBy(messages.createdAt)` 改回 `orderBy(desc(messages.createdAt))`
   - 恢復前端的 `reverse()` 操作

3. **緊急修復**：
   - 增加滾動延遲到 500ms
   - 添加多次滾動嘗試