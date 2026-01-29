# Cloudflare Pages UTF-8 Commit Message 修復指南

## 問題描述

Cloudflare Pages 部署時遇到 UTF-8 commit message 解析錯誤,雖然文件已成功上傳,但構建過程中會產生警告或錯誤。

### 根本原因

Git commit message 中包含 UTF-8 特殊字符(如箭頭 `→`、表情符號 `✅` `🤖` 等),Cloudflare Pages 的構建環境對這些字符的處理有限制。

### 問題 Commit 示例

```bash
# 發現的問題 commit:
a8c43cd | fix: resolve route ordering conflicts in Conversations module (6 conflicts → 0)
                                                                                 ↑
                                                                    UTF-8 箭頭 (U+2192)
```

---

## 快速解決方案 (推薦)

### 方式 A: 使用自動化腳本 ⭐⭐⭐⭐⭐

我們提供了兩個自動化修復腳本:

#### Windows (PowerShell)

```powershell
# 互動式菜單 (推薦)
.\scripts\fix-cloudflare-utf8-issue.ps1

# 或直接執行特定方案
.\scripts\fix-cloudflare-utf8-issue.ps1 -Action quick   # 快速修復
.\scripts\fix-cloudflare-utf8-issue.ps1 -Action hooks   # 配置 hooks
.\scripts\fix-cloudflare-utf8-issue.ps1 -Action all     # 全部執行
```

#### Linux/Mac/Git Bash

```bash
# 互動式菜單
bash scripts/fix-cloudflare-utf8-issue.sh

# 或直接執行特定方案
bash scripts/fix-cloudflare-utf8-issue.sh quick   # 快速修復
bash scripts/fix-cloudflare-utf8-issue.sh hooks   # 配置 hooks
bash scripts/fix-cloudflare-utf8-issue.sh all     # 全部執行
```

### 方式 B: 手動快速修復 (1 分鐘)

如果無法運行腳本,可以手動執行以下命令:

```bash
# 創建一個乾淨的空 commit
git commit --allow-empty -m "chore: trigger clean Cloudflare Pages deployment

This commit uses ASCII-only characters to ensure compatibility
with Cloudflare Pages build environment.

Previous deployment warning was caused by UTF-8 characters in commit messages."

# 推送到遠端
git push origin main
```

**效果:** Cloudflare Pages 會立即使用這個乾淨的 commit 重新部署,警告消失。

---

## 預防未來問題

### 配置 Git Commit-msg Hook

創建 `.git/hooks/commit-msg` 文件:

```bash
#!/bin/sh
# 防止 UTF-8 特殊字符

if grep -P '[^\x00-\x7F]' "$1" 2>/dev/null; then
    echo ""
    echo "❌ Error: Commit message contains non-ASCII characters"
    echo ""
    echo "Please use ASCII-only characters. Common replacements:"
    echo "  • → (arrow)      -> use '->' or 'to'"
    echo "  • ✅ (checkmark) -> use '[x]' or 'done'"
    echo "  • 🤖 (emoji)     -> remove or use text description"
    echo ""
    exit 1
fi

exit 0
```

設置執行權限 (Linux/Mac):

```bash
chmod +x .git/hooks/commit-msg
```

**效果:** 未來任何包含 UTF-8 特殊字符的 commit 都會被自動拒絕。

---

## 進階解決方案 (可選)

### Interactive Rebase 修改歷史

⚠️ **警告:** 此操作會改變 Git 歷史,如有協作者需協調!

```bash
# 步驟 1: 找出問題 commit 位置
git log --oneline -20

# 步驟 2: 開始 interactive rebase (假設問題在第 10 個 commit)
git rebase -i HEAD~10

# 步驟 3: 在編輯器中,將問題 commit 的 'pick' 改為 'reword'
# 原始: pick a8c43cd fix: ... (6 conflicts → 0)
# 改為: reword a8c43cd fix: ... (6 conflicts → 0)

# 步驟 4: 保存後,Git 會打開編輯器讓你修改 commit message
# 將 → 改為 ->
# 將 ✅ 改為 [x]
# 將 🤖 改為 (automated)

# 步驟 5: 完成 rebase
git rebase --continue

# 步驟 6: 強制推送 (--force-with-lease 更安全)
git push origin main --force-with-lease
```

---

## 方案比較

| 方案 | 複雜度 | 破壞性 | 效果 | 推薦度 |
|------|--------|--------|------|--------|
| **自動腳本 (快速修復)** | ⭐ 低 | ✅ 無 | ✅ 立即生效 | ⭐⭐⭐⭐⭐ |
| **手動空 commit** | ⭐ 最低 | ✅ 無 | ✅ 立即生效 | ⭐⭐⭐⭐⭐ |
| **配置 Git hooks** | ⭐⭐ 中 | ✅ 無 | ⚠️ 預防未來 | ⭐⭐⭐⭐ |
| **Interactive Rebase** | ⭐⭐⭐ 高 | ⚠️ 改變歷史 | ✅ 完全修復 | ⭐⭐⭐ |

---

## 推薦執行流程

### Phase 1: 立即修復 (5 分鐘)

```bash
# 使用 PowerShell 腳本 (Windows)
.\scripts\fix-cloudflare-utf8-issue.ps1 -Action quick

# 或手動執行
git commit --allow-empty -m "chore: trigger clean Cloudflare Pages deployment"
git push origin main
```

**結果:** ✅ Cloudflare Pages 立即重新部署,無警告

### Phase 2: 預防機制 (10 分鐘)

```bash
# 使用腳本配置
.\scripts\fix-cloudflare-utf8-issue.ps1 -Action hooks

# 或使用自動化腳本的 "all" 選項一次完成
.\scripts\fix-cloudflare-utf8-issue.ps1 -Action all
```

**結果:** ✅ 未來自動防止 UTF-8 字符進入 commit message

### Phase 3: 清理歷史 (可選,30 分鐘)

僅當你:
- 是唯一開發者,或可協調團隊
- 希望保持完美的 Git 歷史
- 有 Git rebase 經驗

才執行 Interactive Rebase 方案。

---

## 常見問題

### Q1: 腳本執行失敗怎麼辦?

**A:** 可以手動執行命令。所有腳本只是自動化了簡單的 Git 命令。

### Q2: 為什麼不直接修改舊 commit?

**A:** 修改舊 commit 需要 rebase,會改變 Git 歷史。創建新的空 commit 更安全快速。

### Q3: Hook 在 Windows 上不工作?

**A:** Git hooks 在 Git Bash 環境中工作最佳。如果使用 PowerShell,建議改用 Git Bash 執行 commit。

### Q4: 會影響現有部署嗎?

**A:** 不會。這些方案只影響 Git 歷史和未來的部署,不會改變已部署的代碼。

---

## 驗證修復

修復後,檢查以下項目:

```bash
# 1. 檢查 Git 配置
git config --local i18n.commitEncoding
# 應該輸出: utf-8

# 2. 檢查 hook 是否存在
ls -la .git/hooks/commit-msg
# 應該看到文件且有執行權限

# 3. 測試 hook (應該會被拒絕)
git commit --allow-empty -m "test: contains → arrow"
# 應該輸出錯誤訊息

# 4. 檢查最新 commit
git log -1 --pretty=format:"%s" | cat -A
# 應該只看到 ASCII 字符
```

---

## 相關文檔

- [Git Hooks 官方文檔](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [Cloudflare Pages 文檔](https://developers.cloudflare.com/pages/)
- [Git Rebase 指南](https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History)

---

## 腳本位置

- PowerShell 版本: `scripts/fix-cloudflare-utf8-issue.ps1`
- Bash 版本: `scripts/fix-cloudflare-utf8-issue.sh`

## 聯繫支持

如有問題,請查看:
- 項目 README: `README.md`
- Cloudflare 部署文檔: `docs/deployment/`
- Git 工作流程: `docs/git-workflow.md`
