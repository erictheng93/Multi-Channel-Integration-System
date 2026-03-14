# Documentation Contributing Guide

歡迎為本專案文檔做出貢獻！本指南將幫助您了解如何創建、編輯和維護專案文檔。

## 文檔標準

### 文件命名規範

1. **使用英文命名**
   - 所有文件名必須使用英文
   - 使用大寫字母和底線（例如：`EXAMPLE_DOCUMENT.md`）
   - 避免使用空格、中文或特殊符號

2. **命名模式**
   ```
   正確: WEBSOCKET_CONFIGURATION_GUIDE.md
   正確: API_ENDPOINT_REFERENCE.md
   錯誤: websocket guide.md
   錯誤: WebSocket指南.md
   錯誤: websocket-guide.md (連字符僅用於特殊情況)
   ```

### 文件內容規範

1. **禁止使用 Emoji**
   - 不要在文檔中使用任何 emoji 符號
   - 使用文字描述替代圖示

2. **文件編碼**
   - 統一使用 UTF-8 編碼
   - 確保跨平台兼容性

3. **Markdown 格式**
   - 使用標準 Markdown 語法
   - 標題層級清晰（H1-H6）
   - 適當使用代碼區塊、列表和表格

## 文檔分類

請將文檔放置在正確的文件夾中：

### 主要分類

```
docs/
├── analytics/ # 分析功能文檔
├── api/ # API 參考文檔
├── architecture/ # 系統架構文檔
├── components/ # 前端元件文檔
├── database/ # 資料庫文檔
├── deployment/ # 部署相關文檔
├── enterprise/ # 企業功能文檔
├── features/ # 功能特性文檔
├── guides/ # 操作指南
├── implementation/ # 實作報告
├── migration/ # 遷移指南
├── monitoring/ # 監控文檔
├── optimization/ # 效能優化
├── performance/ # 效能測試
├── reports/ # 各類報告
│ ├── analytics/ # 分析報告
│ ├── deployment/ # 部署報告
│ ├── enhancement/ # 功能增強報告
│ ├── migration/ # 遷移報告
│ ├── modules/ # 模組報告
│ ├── monitoring/ # 監控報告
│ ├── verification/ # 驗證報告
│ └── websocket/ # WebSocket 報告
├── standards/ # 編碼標準
├── testing/ # 測試文檔
└── troubleshooting/ # 故障排除
```

### 如何選擇正確的文件夾？

- **guides/** - 操作步驟、設置指南、快速開始
- **api/** - API 端點參考、接口文檔
- **architecture/** - 系統設計、架構圖、技術決策
- **reports/** - 實施報告、測試報告、驗證報告
- **features/** - 功能說明、使用手冊
- **troubleshooting/** - 問題排查、解決方案

## 文檔模板

### 使用模板

在 `docs/templates/` 文件夾中提供了各種文檔模板：

- `FEATURE_DOCUMENT_TEMPLATE.md` - 功能文檔模板
- `API_REFERENCE_TEMPLATE.md` - API 參考模板
- `GUIDE_TEMPLATE.md` - 操作指南模板
- `REPORT_TEMPLATE.md` - 報告文檔模板

複製相應的模板開始創建新文檔。

## 貢獻流程

### 1. 創建新文檔

```bash
# 1. 從模板複製
cp docs/templates/GUIDE_TEMPLATE.md docs/guides/YOUR_NEW_GUIDE.md

# 2. 編輯文檔內容
# 使用您喜歡的編輯器編輯文件

# 3. 確認文檔格式
python scripts/check-docs.py docs/guides/YOUR_NEW_GUIDE.md
```

### 2. 更新現有文檔

```bash
# 1. 編輯文檔
# 2. 移除 emoji（如果有）
python scripts/remove-emoji.py --root .

# 3. 驗證更改
# 確保文檔仍然可讀且格式正確
```

### 3. 更新文檔索引

當添加新文檔時，請更新 `docs/DOCUMENTATION_INDEX.md`：

```markdown
### 新增的分類
- [您的文檔標題](./path/to/YOUR_NEW_DOCUMENT.md) - 簡短描述
```

### 4. 提交更改

```bash
# 1. 檢查更改
git status

# 2. 添加文件
git add docs/

# 3. 提交
git commit -m "docs: add/update documentation for [feature/topic]"

# 4. 推送（如果適用）
git push
```

## 文檔質量檢查清單

在提交文檔前，請確認：

- [ ] 文件名使用英文大寫加底線
- [ ] 沒有使用 emoji 符號
- [ ] 使用 UTF-8 編碼
- [ ] 放置在正確的文件夾中
- [ ] 包含清晰的標題和目錄（如果需要）
- [ ] 代碼示例格式正確
- [ ] 連結有效且指向正確位置
- [ ] 更新了 DOCUMENTATION_INDEX.md（新文檔）
- [ ] 語法和拼寫檢查通過
- [ ] 內容準確且最新

## 常見問題

### Q: 我應該使用中文還是英文寫文檔？

A: 文檔內容可以使用中文或英文，但**文件名必須使用英文**。建議根據目標受眾選擇語言：
- 內部團隊文檔：可以使用中文
- API 參考、技術規格：建議使用英文或雙語

### Q: 如何處理圖片？

A:
1. 將圖片放在 `docs/images/` 文件夾中
2. 使用描述性的英文文件名
3. 在文檔中使用相對路徑引用

```markdown
![Architecture Diagram](../images/WEBSOCKET_ARCHITECTURE.png)
```

### Q: 如何添加代碼示例？

A: 使用 Markdown 代碼區塊並指定語言：

\`\`\`typescript
// TypeScript 示例
const example = "Hello World";
\`\`\`

### Q: 文檔需要包含版本信息嗎？

A: 是的，建議在文檔末尾添加：

```markdown
---
最後更新: 2025-10-18
版本: 1.0
作者: [Your Name]
```

## 自動化工具

### Emoji 移除工具

```bash
# 掃描並移除所有 emoji
python scripts/remove-emoji.py --root .

# 預覽模式（不修改文件）
python scripts/remove-emoji.py --root . --dry-run
```

### 文檔檢查工具

```bash
# 檢查文檔格式
python scripts/check-docs.py [file]

# 檢查所有文檔
python scripts/check-docs.py --all
```

## 聯繫方式

如有任何問題或建議，請：
- 創建 Issue
- 聯繫文檔維護團隊
- 在團隊會議中提出

## 參考資源

- [Markdown 語法指南](https://www.markdownguide.org/)
- [專案文檔索引](./DOCUMENTATION_INDEX.md)
- [README.md](../README.md)

---

感謝您對專案文檔的貢獻！

最後更新: 2025-10-18
版本: 1.0
