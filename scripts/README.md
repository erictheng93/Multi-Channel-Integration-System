
# Scripts Directory

本目錄包含專案的自動化腳本和工具。

## 文檔維護腳本

### remove-emoji.py

自動移除 Markdown 文件中的 emoji 字符。

**用法：**

```bash
# 移除所有文檔中的 emoji
python scripts/remove-emoji.py --root .

# Dry-run 模式（預覽但不修改）
python scripts/remove-emoji.py --root . --dry-run

# 檢查特定文件
python scripts/remove-emoji.py --root docs/
```

**功能：**
- 支援多種編碼（UTF-8, GBK, Big5 等）
- 自動清理空白標題
- 修正多餘的空格和換行
- Dry-run 預覽模式

### check-docs.py

檢查文檔質量和標準合規性。

**用法：**

```bash
# 檢查所有文檔
python scripts/check-docs.py --all

# 檢查特定文件
python scripts/check-docs.py docs/README.md docs/guides/QUICK_START.md

# 檢查特定目錄
python scripts/check-docs.py docs/api/*.md
```

**檢查項目：**
- Emoji 字符檢查
- 中文文件名檢查
- 文件命名規範
- 文檔結構檢查（H1 標題、元數據）
- 空白行和格式問題
- 尾隨空格

### docs-pre-commit-hook.sh

Git pre-commit hook，自動在提交前檢查文檔質量。

**安裝：**

```bash
# 複製到 Git hooks 目錄
cp scripts/docs-pre-commit-hook.sh .git/hooks/pre-commit

# 給予執行權限
chmod +x .git/hooks/pre-commit
```

**功能：**
- 自動檢查即將提交的 Markdown 文件
- 檢查 emoji 字符
- 檢查中文文件名
- 運行文檔質量檢查器
- 發現問題時阻止提交

## 路由衝突檢測工具

### route-conflict-detector.cjs

自動檢測handler文件中的路由衝突，防止路由錯誤。

**用法：**

```bash
# 基本掃描
node scripts/route-conflict-detector.cjs

# 詳細輸出
node scripts/route-conflict-detector.cjs --verbose

# JSON 輸出（用於 CI/CD）
node scripts/route-conflict-detector.cjs --json > report.json
```

**退出代碼：**
- `0` - 未發現衝突
- `1` - 發現衝突（中等/低嚴重性）
- `2` - 發現嚴重衝突

**檢測內容：**
- ✅ 靜態路由 vs 動態路由衝突（如 `/search` vs `/:id`）
- ✅ 重複路由註冊
- ✅ 跨模組路由衝突
- ✅ 註冊順序問題

**詳細文檔：** `docs/tools/ROUTE_CONFLICT_DETECTOR.md`

### route-conflict-analysis.md

初始路由模式掃描的手動分析報告

### route-conflict-fix-summary.md

已應用的路由衝突修復摘要

## 團隊處理器遷移

### team-handler-migration-summary.md

團隊處理器模組化架構的完整遷移報告
- 部署版本: `e0a1cd14-1fc9-42c6-8d30-fb50fc80f212`
- 狀態: ✅ 成功部署

## 測試腳本

### test-route-conflicts-fix.js

驗證路由衝突修復的測試腳本
- 測試 Session 模組和 QRCode 模組的保留路徑驗證
- 預期結果: 10/11 測試通過（91%）

## 部署腳本

### developer-deploy.ps1

開發者快速部署腳本（PowerShell）。

**用法：**

```powershell
# 完整部署（後端 + 前端）
.\scripts\developer-deploy.ps1

# 只部署後端
.\scripts\developer-deploy.ps1 -BackendOnly

# 只部署前端
.\scripts\developer-deploy.ps1 -FrontendOnly

# 跳過構建，強制部署
.\scripts\developer-deploy.ps1 -SkipBuild -Force

# 查看幫助
.\scripts\developer-deploy.ps1 -Help
```

### user-deploy.ps1

用戶部署腳本（使用 Terraform）。

**用法：**

```powershell
# 預覽部署計劃
.\scripts\user-deploy.ps1 -PlanOnly

# 自動批准並部署
.\scripts\user-deploy.ps1 -AutoApprove

# 查看幫助
.\scripts\user-deploy.ps1 -Help
```

## 使用流程

### 日常開發工作流

1. **編輯文檔**
   ```bash
   # 編輯 Markdown 文件
   code docs/guides/MY_GUIDE.md
   ```

2. **清理 Emoji**
   ```bash
   # 自動移除 emoji
   python scripts/remove-emoji.py --root docs/
   ```

3. **檢查文檔質量**
   ```bash
   # 運行質量檢查
   python scripts/check-docs.py docs/guides/MY_GUIDE.md
   ```

4. **提交更改**
   ```bash
   # Git pre-commit hook 會自動運行檢查
   git add docs/
   git commit -m "docs: update guide"
   ```

## 故障排除

### Python 腳本無法運行

**問題：** `python: command not found`

**解決方案：**
```bash
# 嘗試使用 python3
python3 scripts/remove-emoji.py --root .

# 或檢查 Python 安裝
which python
which python3
```

## 相關文檔

- [文檔貢獻指南](../docs/CONTRIBUTING.md)
- [文檔索引](../docs/DOCUMENTATION_INDEX.md)
- [專案 README](../README.md)

---

最後更新: 2025-10-18
維護者: Development Team