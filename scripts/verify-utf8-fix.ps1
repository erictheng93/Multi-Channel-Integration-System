################################################################################
# Cloudflare Pages UTF-8 修復驗證腳本
#
# 此腳本驗證所有修復措施是否正確配置
# 使用方式: .\scripts\verify-utf8-fix.ps1
################################################################################

function Write-Header {
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  Cloudflare Pages UTF-8 修復驗證工具                      ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Item {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$SuccessMessage,
        [string]$FailureMessage
    )

    Write-Host "🔍 檢查: $Name" -ForegroundColor Yellow

    try {
        $result = & $Test
        if ($result) {
            Write-Host "   ✅ $SuccessMessage" -ForegroundColor Green
            return $true
        } else {
            Write-Host "   ❌ $FailureMessage" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "   ❌ 檢查失敗: $_" -ForegroundColor Red
        return $false
    }
    Write-Host ""
}

Write-Header

$allPassed = $true

# 檢查 1: Git 編碼配置
$allPassed = $allPassed -and (Test-Item `
    -Name "Git commit 編碼配置" `
    -Test {
        $encoding = git config --get i18n.commitEncoding
        return $encoding -eq "utf-8"
    } `
    -SuccessMessage "Git commitEncoding 已設置為 utf-8" `
    -FailureMessage "Git commitEncoding 未正確配置,請執行修復腳本"
)

# 檢查 2: Git 輸出編碼配置
$allPassed = $allPassed -and (Test-Item `
    -Name "Git log 輸出編碼配置" `
    -Test {
        $encoding = git config --get i18n.logOutputEncoding
        return $encoding -eq "utf-8"
    } `
    -SuccessMessage "Git logOutputEncoding 已設置為 utf-8" `
    -FailureMessage "Git logOutputEncoding 未正確配置,請執行修復腳本"
)

# 檢查 3: commit-msg hook 存在
$allPassed = $allPassed -and (Test-Item `
    -Name "commit-msg hook 文件" `
    -Test {
        return Test-Path ".git\hooks\commit-msg"
    } `
    -SuccessMessage "commit-msg hook 已創建" `
    -FailureMessage "commit-msg hook 不存在,請執行修復腳本"
)

# 檢查 4: 最新 commit 是否為 ASCII
$allPassed = $allPassed -and (Test-Item `
    -Name "最新 commit message 編碼" `
    -Test {
        $latestCommit = git log -1 --pretty=format:"%s"
        return $latestCommit -match '^[[:print:][:space:]]*$'
    } `
    -SuccessMessage "最新 commit message 使用 ASCII 字符" `
    -FailureMessage "最新 commit 包含 non-ASCII 字符"
)

# 檢查 5: 檢查最近 commits 中的 UTF-8 字符
Write-Host "🔍 檢查: 掃描最近 20 個 commits" -ForegroundColor Yellow
$commits = git log --all --pretty=format:"%h | %s" -20
$utf8Count = 0

foreach ($commit in $commits) {
    if ($commit -match '[^\x00-\x7F]') {
        $utf8Count++
        if ($utf8Count -eq 1) {
            Write-Host "   ⚠️  發現含 UTF-8 字符的 commits:" -ForegroundColor Yellow
        }
        Write-Host "      $commit" -ForegroundColor Yellow
    }
}

if ($utf8Count -eq 0) {
    Write-Host "   ✅ 所有最近 commits 都使用 ASCII 字符" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  共發現 $utf8Count 個含 UTF-8 字符的 commits" -ForegroundColor Cyan
    Write-Host "   ℹ️  這些歷史 commits 不影響新部署,但可選擇使用 rebase 清理" -ForegroundColor Cyan
}

Write-Host ""

# 最終結果
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "✅ 驗證通過! 所有修復措施已正確配置" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步:" -ForegroundColor Cyan
    Write-Host "  1. 創建新 commit 觸發 Cloudflare Pages 重新部署" -ForegroundColor White
    Write-Host "     git commit --allow-empty -m 'chore: trigger clean deployment'" -ForegroundColor Gray
    Write-Host "     git push origin main" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. 或使用快速修復腳本:" -ForegroundColor White
    Write-Host "     .\scripts\fix-cloudflare-utf8-issue.ps1 -Action quick" -ForegroundColor Gray
} else {
    Write-Host "❌ 驗證失敗! 部分配置缺失" -ForegroundColor Red
    Write-Host ""
    Write-Host "建議執行修復腳本:" -ForegroundColor Yellow
    Write-Host "  .\scripts\fix-cloudflare-utf8-issue.ps1 -Action all" -ForegroundColor White
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# 額外信息
Write-Host "📚 完整文檔: docs\troubleshooting\CLOUDFLARE_UTF8_FIX.md" -ForegroundColor Cyan
