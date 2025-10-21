################################################################################
# Cloudflare Pages UTF-8 Commit Message Issue 修復腳本 (PowerShell 版本)
#
# 此腳本提供三種解決方案:
#   1. 創建乾淨的空 commit (推薦,最快)
#   2. 配置 Git hooks 預防未來問題
#   3. Interactive Rebase 修改歷史指南 (進階)
#
# 使用方式:
#   .\scripts\fix-cloudflare-utf8-issue.ps1
#   .\scripts\fix-cloudflare-utf8-issue.ps1 -Action quick
#   .\scripts\fix-cloudflare-utf8-issue.ps1 -Action hooks
#   .\scripts\fix-cloudflare-utf8-issue.ps1 -Action all
################################################################################

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('quick', 'hooks', 'rebase', 'all')]
    [string]$Action
)

# 顏色函數
function Write-Header {
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  Cloudflare Pages UTF-8 Issue 修復工具 (PowerShell)       ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

# 檢查 UTF-8 commits
function Test-Utf8Commits {
    Write-Host "🔍 檢查最近 20 個 commits 中的 UTF-8 字符..." -ForegroundColor Yellow
    Write-Host ""

    $commits = git log --all --pretty=format:"%h | %s" -20
    $hasUtf8 = $false

    foreach ($commit in $commits) {
        # 檢查是否包含 non-ASCII 字符
        if ($commit -match '[^\x00-\x7F]') {
            if (-not $hasUtf8) {
                Write-Error "發現包含 UTF-8 特殊字符的 commits:"
                $hasUtf8 = $true
            }
            Write-Host "  $commit" -ForegroundColor Red
        }
    }

    if (-not $hasUtf8) {
        Write-Success "最近 20 個 commits 都使用 ASCII 字符"
    }

    Write-Host ""
    return $hasUtf8
}

# 方案 1: 快速修復
function Invoke-QuickFix {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "  方案 1: 快速修復 - 創建乾淨的觸發 commit" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""

    Write-Info "創建空 commit 觸發 Cloudflare Pages 重新部署..."

    $commitMessage = @"
chore: trigger clean Cloudflare Pages deployment

This commit uses ASCII-only characters to ensure compatibility
with Cloudflare Pages build environment.

Previous deployment warning was caused by UTF-8 characters (arrow symbols)
in commit messages. This has been noted for future prevention.

Changes:
- No code changes, empty commit to trigger clean deployment
- All subsequent commits will follow ASCII-only convention

Generated with automated fix script (PowerShell)
"@

    git commit --allow-empty -m $commitMessage
    Write-Success "空 commit 已創建"
    Write-Host ""

    $push = Read-Host "是否立即推送到 origin/main? (y/n)"
    if ($push -eq 'y' -or $push -eq 'Y') {
        git push origin main
        Write-Success "已推送到 origin/main"
        Write-Info "Cloudflare Pages 將自動開始部署..."
    } else {
        Write-Warning "請稍後手動執行: git push origin main"
    }

    Write-Host ""
}

# 方案 2: 配置 hooks
function Set-GitHooks {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "  方案 2: 預防機制 - 配置 Git commit-msg hook" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""

    Write-Info "配置 Git 編碼設置..."
    git config --local i18n.commitEncoding utf-8
    git config --local i18n.logOutputEncoding utf-8
    Write-Success "Git 編碼配置完成"
    Write-Host ""

    Write-Info "創建 commit-msg hook..."

    $hookContent = @'
#!/bin/sh
#
# Git commit-msg hook - 防止 UTF-8 特殊字符
# 確保 commit message 只使用 ASCII 字符,保證 Cloudflare Pages 兼容性
#

if grep -P '[^\x00-\x7F]' "$1" 2>/dev/null; then
    echo ""
    echo "❌ Error: Commit message contains non-ASCII characters"
    echo ""
    echo "Detected characters that may cause issues with Cloudflare Pages:"
    grep -P '[^\x00-\x7F]' "$1" --color=always 2>/dev/null || grep '[^[:print:]]' "$1"
    echo ""
    echo "Please use ASCII-only characters. Common replacements:"
    echo "  • → (arrow)        -> use '->' or 'to'"
    echo "  • ✅ (checkmark)   -> use '[x]' or 'done'"
    echo "  • 🤖 (emoji)       -> remove or use text description"
    echo ""
    exit 1
fi

exit 0
'@

    $hookPath = ".git\hooks\commit-msg"

    # 確保 hooks 目錄存在
    $hooksDir = ".git\hooks"
    if (-not (Test-Path $hooksDir)) {
        New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null
    }

    # 寫入 hook 文件
    Set-Content -Path $hookPath -Value $hookContent -Encoding UTF8

    Write-Success "commit-msg hook 已創建"
    Write-Host ""
    Write-Info "測試 hook 功能:"
    Write-Host "  未來任何包含 UTF-8 特殊字符的 commit 都會被自動拒絕" -ForegroundColor Cyan
    Write-Host ""

    # Windows 下 Git hooks 不需要 chmod,但提示用戶可能需要配置 Git Bash
    Write-Warning "注意: 如果使用 Git Bash,hook 已自動生效"
    Write-Warning "注意: 如果使用 PowerShell/CMD,部分 hook 功能可能受限"
    Write-Host ""
}

# 方案 3: Rebase 指南
function Show-RebaseGuide {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "  方案 3: 進階修復 - Interactive Rebase 修改歷史" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""

    Write-Host "⚠️  警告: 此操作會改變 Git 歷史!" -ForegroundColor Red
    Write-Host "⚠️  如果有協作者,需要協調後再執行!" -ForegroundColor Red
    Write-Host ""

    Write-Warning "此方案提供指南,不會自動執行。請根據以下步驟手動操作:"
    Write-Host ""

    $guide = @"
步驟 1: 找出問題 commit 的位置
  > git log --oneline -20

步驟 2: 從問題 commit 的父節點開始 rebase (假設是第 10 個)
  > git rebase -i HEAD~10

步驟 3: 在編輯器中,將問題 commit 的 'pick' 改為 'reword'
  原始: pick a8c43cd fix: ... (6 conflicts → 0)
  改為: reword a8c43cd fix: ... (6 conflicts → 0)

步驟 4: 保存後,Git 會打開編輯器讓你修改 commit message
  將特殊字符改為 ASCII:
    → 改為 ->
    ✅ 改為 [x]
    🤖 改為 (automated)

步驟 5: 完成 rebase
  > git rebase --continue

步驟 6: 強制推送 (使用 --force-with-lease 更安全)
  > git push origin main --force-with-lease

提示: 在 Windows 上建議使用 Git Bash 執行 interactive rebase
"@

    Write-Host $guide -ForegroundColor Cyan
    Write-Host ""
    Read-Host "按 Enter 繼續..."
}

# 主菜單
function Show-Menu {
    Write-Host "請選擇修復方案:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  1) 快速修復 - 創建乾淨的空 commit (推薦,最快)"
    Write-Host "  2) 配置 hooks - 預防未來問題"
    Write-Host "  3) Rebase 指南 - 修改歷史 (進階用戶)"
    Write-Host "  4) 全部執行 (方案 1 + 2)"
    Write-Host "  5) 退出"
    Write-Host ""

    $choice = Read-Host "請輸入選項 (1-5)"
    Write-Host ""

    switch ($choice) {
        '1' { Invoke-QuickFix }
        '2' { Set-GitHooks }
        '3' { Show-RebaseGuide }
        '4' {
            Invoke-QuickFix
            Write-Host ""
            Set-GitHooks
        }
        '5' {
            Write-Host "👋 退出修復工具" -ForegroundColor Cyan
            exit 0
        }
        default {
            Write-Error "無效選項,請重新選擇"
            Write-Host ""
            Show-Menu
        }
    }
}

# 主程序
function Main {
    Write-Header
    Test-Utf8Commits | Out-Null

    if ($Action) {
        switch ($Action) {
            'quick' { Invoke-QuickFix }
            'hooks' { Set-GitHooks }
            'rebase' { Show-RebaseGuide }
            'all' {
                Invoke-QuickFix
                Write-Host ""
                Set-GitHooks
            }
        }
    } else {
        Show-Menu
    }

    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  修復完成! 感謝使用 Cloudflare Pages UTF-8 修復工具      ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
}

# 執行主程序
Main
