#!/bin/bash

################################################################################
# Cloudflare Pages UTF-8 Commit Message Issue 修復腳本
#
# 此腳本提供三種解決方案:
#   1. 創建乾淨的空 commit (推薦,最快)
#   2. 配置 Git hooks 預防未來問題
#   3. Interactive Rebase 修改歷史 (進階)
#
# 使用方式: bash scripts/fix-cloudflare-utf8-issue.sh [option]
#   option: quick | hooks | rebase | all
################################################################################

set -e  # Exit on error

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函數: 打印標題
print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Cloudflare Pages UTF-8 Issue 修復工具                    ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# 函數: 檢查問題 commits
check_utf8_commits() {
    echo -e "${YELLOW}🔍 檢查最近 20 個 commits 中的 UTF-8 字符...${NC}"
    echo ""

    # 搜索含 non-ASCII 字符的 commits
    if git log --all --pretty=format:"%h | %s" -20 | grep -P '[^\x00-\x7F]' > /dev/null 2>&1; then
        echo -e "${RED}❌ 發現包含 UTF-8 特殊字符的 commits:${NC}"
        git log --all --pretty=format:"  %h | %s" -20 | grep -P '[^\x00-\x7F]' --color=always
        echo ""
        return 1
    else
        echo -e "${GREEN}✅ 最近 20 個 commits 都使用 ASCII 字符${NC}"
        echo ""
        return 0
    fi
}

# 方案 1: 創建乾淨的空 commit
solution_quick_fix() {
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  方案 1: 快速修復 - 創建乾淨的觸發 commit${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${BLUE}📝 創建空 commit 觸發 Cloudflare Pages 重新部署...${NC}"

    # 創建空 commit
    git commit --allow-empty -m "chore: trigger clean Cloudflare Pages deployment

This commit uses ASCII-only characters to ensure compatibility
with Cloudflare Pages build environment.

Previous deployment warning was caused by UTF-8 characters (arrow symbols)
in commit messages. This has been noted for future prevention.

Changes:
- No code changes, empty commit to trigger clean deployment
- All subsequent commits will follow ASCII-only convention

Generated with automated fix script"

    echo -e "${GREEN}✅ 空 commit 已創建${NC}"
    echo ""

    # 詢問是否推送
    read -p "是否立即推送到 origin/main? (y/n): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push origin main
        echo -e "${GREEN}✅ 已推送到 origin/main${NC}"
        echo -e "${BLUE}📊 Cloudflare Pages 將自動開始部署...${NC}"
    else
        echo -e "${YELLOW}⚠️  請稍後手動執行: git push origin main${NC}"
    fi

    echo ""
}

# 方案 2: 配置 Git hooks
solution_setup_hooks() {
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  方案 2: 預防機制 - 配置 Git commit-msg hook${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${BLUE}⚙️  配置 Git 編碼設置...${NC}"
    git config --local i18n.commitEncoding utf-8
    git config --local i18n.logOutputEncoding utf-8
    echo -e "${GREEN}✅ Git 編碼配置完成${NC}"
    echo ""

    echo -e "${BLUE}📝 創建 commit-msg hook...${NC}"

    # 創建 hook 腳本
    cat > .git/hooks/commit-msg << 'EOF'
#!/bin/sh
#
# Git commit-msg hook - 防止 UTF-8 特殊字符
# 確保 commit message 只使用 ASCII 字符,保證 Cloudflare Pages 兼容性
#

if grep -P '[^\x00-\x7F]' "$1"; then
    echo ""
    echo "❌ Error: Commit message contains non-ASCII characters"
    echo ""
    echo "Detected characters that may cause issues with Cloudflare Pages:"
    grep -P '[^\x00-\x7F]' "$1" --color=always
    echo ""
    echo "Please use ASCII-only characters. Common replacements:"
    echo "  • → (arrow)        -> use '->' or 'to'"
    echo "  • ✅ (checkmark)   -> use '[x]' or 'done'"
    echo "  • 🤖 (emoji)       -> remove or use text description"
    echo ""
    exit 1
fi

exit 0
EOF

    # 設置執行權限
    chmod +x .git/hooks/commit-msg

    echo -e "${GREEN}✅ commit-msg hook 已創建並啟用${NC}"
    echo ""
    echo -e "${BLUE}測試 hook 功能:${NC}"
    echo "  未來任何包含 UTF-8 特殊字符的 commit 都會被自動拒絕"
    echo ""
}

# 方案 3: Interactive Rebase (進階)
solution_rebase_guide() {
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  方案 3: 進階修復 - Interactive Rebase 修改歷史${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${RED}⚠️  警告: 此操作會改變 Git 歷史!${NC}"
    echo -e "${RED}⚠️  如果有協作者,需要協調後再執行!${NC}"
    echo ""

    echo -e "${YELLOW}此方案提供指南,不會自動執行。請根據以下步驟手動操作:${NC}"
    echo ""
    echo "步驟 1: 找出問題 commit 的位置"
    echo "  $ git log --oneline -20"
    echo ""
    echo "步驟 2: 從問題 commit 的父節點開始 rebase (假設是第 10 個)"
    echo "  $ git rebase -i HEAD~10"
    echo ""
    echo "步驟 3: 在編輯器中,將問題 commit 的 'pick' 改為 'reword'"
    echo "  原始: pick a8c43cd fix: ... (6 conflicts → 0)"
    echo "  改為: reword a8c43cd fix: ... (6 conflicts → 0)"
    echo ""
    echo "步驟 4: 保存後,Git 會打開編輯器讓你修改 commit message"
    echo "  將特殊字符改為 ASCII:"
    echo "    → 改為 ->"
    echo "    ✅ 改為 [x]"
    echo "    🤖 改為 (automated)"
    echo ""
    echo "步驟 5: 完成 rebase"
    echo "  $ git rebase --continue"
    echo ""
    echo "步驟 6: 強制推送 (使用 --force-with-lease 更安全)"
    echo "  $ git push origin main --force-with-lease"
    echo ""

    read -p "按 Enter 繼續..."
}

# 主菜單
show_menu() {
    echo -e "${BLUE}請選擇修復方案:${NC}"
    echo ""
    echo "  1) 快速修復 - 創建乾淨的空 commit (推薦,最快)"
    echo "  2) 配置 hooks - 預防未來問題"
    echo "  3) Rebase 指南 - 修改歷史 (進階用戶)"
    echo "  4) 全部執行 (方案 1 + 2)"
    echo "  5) 退出"
    echo ""
    read -p "請輸入選項 (1-5): " -n 1 -r
    echo ""
    echo ""

    case $REPLY in
        1)
            solution_quick_fix
            ;;
        2)
            solution_setup_hooks
            ;;
        3)
            solution_rebase_guide
            ;;
        4)
            solution_quick_fix
            echo ""
            solution_setup_hooks
            ;;
        5)
            echo -e "${BLUE}👋 退出修復工具${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ 無效選項,請重新選擇${NC}"
            echo ""
            show_menu
            ;;
    esac
}

# 主程序
main() {
    print_header
    check_utf8_commits || true

    # 如果有命令行參數,直接執行
    if [ $# -gt 0 ]; then
        case $1 in
            quick)
                solution_quick_fix
                ;;
            hooks)
                solution_setup_hooks
                ;;
            rebase)
                solution_rebase_guide
                ;;
            all)
                solution_quick_fix
                echo ""
                solution_setup_hooks
                ;;
            *)
                echo -e "${RED}❌ 無效參數: $1${NC}"
                echo "使用方式: bash $0 [quick|hooks|rebase|all]"
                exit 1
                ;;
        esac
    else
        # 無參數則顯示菜單
        show_menu
    fi

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  修復完成! 感謝使用 Cloudflare Pages UTF-8 修復工具      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
}

# 執行主程序
main "$@"
