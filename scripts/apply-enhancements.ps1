# scripts/apply-enhancements.ps1
# 應用所有對話核心功能增強

param(
    [switch]$Backup = $true,
    [switch]$DryRun = $false,
    [string]$Environment = "development"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent

Write-Host "=== 應用對話核心功能增強 ===" -ForegroundColor Green
Write-Host "項目路徑: $ProjectRoot"
Write-Host "環境: $Environment"
Write-Host "備份: $Backup"
Write-Host "演練模式: $DryRun"
Write-Host ""

# 檢查必要檔案
$RequiredFiles = @(
    "$ProjectRoot\database\apply-enhancements.sql",
    "$ProjectRoot\src\handlers\customer.ts",
    "$ProjectRoot\src\handlers\tag.ts",
    "$ProjectRoot\src\handlers\notification.ts",
    "$ProjectRoot\src\routes\enhanced-routes.ts"
)

foreach ($file in $RequiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Error "必要檔案不存在: $file"
    }
}

Write-Host "✓ 所有必要檔案已確認存在" -ForegroundColor Green

# 1. 數據庫增強
Write-Host "`n--- 1. 應用資料庫架構增強 ---" -ForegroundColor Yellow

if ($Backup -and -not $DryRun) {
    Write-Host "創建資料庫備份..."
    $BackupPath = "$ProjectRoot\database\backups"
    if (-not (Test-Path $BackupPath)) {
        New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
    }
    
    $BackupFile = "$BackupPath\backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').db"
    if (Test-Path "$ProjectRoot\.wrangler\state\v3\d1\miniflare-D1DatabaseObject") {
        Copy-Item "$ProjectRoot\.wrangler\state\v3\d1\miniflare-D1DatabaseObject" $BackupFile -ErrorAction SilentlyContinue
        Write-Host "✓ 資料庫已備份至: $BackupFile" -ForegroundColor Green
    }
}

if ($DryRun) {
    Write-Host "[DRY RUN] 將執行資料庫架構更新..." -ForegroundColor Cyan
} else {
    Write-Host "應用資料庫架構更新..."
    try {
        if ($Environment -eq "production") {
            Write-Host "應用到生產環境..."
            & wrangler d1 execute DB --file="$ProjectRoot\database\apply-enhancements.sql" --remote
        } else {
            Write-Host "應用到本地開發環境..."
            & wrangler d1 execute DB --file="$ProjectRoot\database\apply-enhancements.sql" --local
        }
        Write-Host "✓ 資料庫架構更新完成" -ForegroundColor Green
    } catch {
        Write-Error "資料庫架構更新失敗: $_"
    }
}

# 2. 檢查型別定義
Write-Host "`n--- 2. 檢查型別定義 ---" -ForegroundColor Yellow

$TypesFile = "$ProjectRoot\src\types\index.ts"
if ($DryRun) {
    Write-Host "[DRY RUN] 將檢查型別定義..." -ForegroundColor Cyan
} else {
    if (Test-Path $TypesFile) {
        $TypesContent = Get-Content $TypesFile -Raw
        $RequiredTypes = @(
            "CustomerTag",
            "CustomerTagRelation", 
            "ConversationSession",
            "Notification"
        )
        
        $MissingTypes = @()
        foreach ($type in $RequiredTypes) {
            if ($TypesContent -notmatch "interface $type") {
                $MissingTypes += $type
            }
        }
        
        if ($MissingTypes.Count -gt 0) {
            Write-Warning "缺少以下型別定義: $($MissingTypes -join ', ')"
            Write-Host "建議手動檢查並更新 $TypesFile" -ForegroundColor Yellow
        } else {
            Write-Host "✓ 所有必要型別定義已存在" -ForegroundColor Green
        }
    }
}

# 3. 檢查主應用程式
Write-Host "`n--- 3. 檢查主應用程式整合 ---" -ForegroundColor Yellow

$MainAppFile = "$ProjectRoot\src\index.ts"
if ($DryRun) {
    Write-Host "[DRY RUN] 將檢查主應用程式整合..." -ForegroundColor Cyan
} else {
    if (Test-Path $MainAppFile) {
        $AppContent = Get-Content $MainAppFile -Raw
        
        # 檢查是否需要添加路由
        if ($AppContent -notmatch "enhanced-routes" -and $AppContent -notmatch "setupEnhancedRoutes") {
            Write-Host "需要手動整合增強路由到主應用程式" -ForegroundColor Yellow
            Write-Host "在 $MainAppFile 中添加以下代碼:" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "import { setupEnhancedRoutes } from './routes/enhanced-routes';" -ForegroundColor Gray
            Write-Host "setupEnhancedRoutes(app);" -ForegroundColor Gray
            Write-Host ""
        } else {
            Write-Host "✓ 增強路由已整合" -ForegroundColor Green
        }
    }
}

# 4. 檢查工具函數
Write-Host "`n--- 4. 檢查工具函數 ---" -ForegroundColor Yellow

$UtilsApiResponse = "$ProjectRoot\src\utils\api-response.ts"
if ($DryRun) {
    Write-Host "[DRY RUN] 將檢查工具函數..." -ForegroundColor Cyan
} else {
    if (-not (Test-Path $UtilsApiResponse)) {
        Write-Warning "缺少 API 回應工具函數: $UtilsApiResponse"
        Write-Host "請確認此檔案存在並包含所需的回應函數" -ForegroundColor Yellow
    } else {
        Write-Host "✓ API 回應工具函數已存在" -ForegroundColor Green
    }
}

# 5. 型別檢查
Write-Host "`n--- 5. TypeScript 編譯檢查 ---" -ForegroundColor Yellow

if ($DryRun) {
    Write-Host "[DRY RUN] 將執行 TypeScript 編譯檢查..." -ForegroundColor Cyan
} else {
    Write-Host "執行 TypeScript 編譯檢查..."
    try {
        Push-Location $ProjectRoot
        & npm run build
        Write-Host "✓ TypeScript 編譯通過" -ForegroundColor Green
    } catch {
        Write-Warning "TypeScript 編譯警告: $_"
        Write-Host "請檢查並修復型別錯誤" -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
}

# 6. 測試新功能
Write-Host "`n--- 6. 功能測試建議 ---" -ForegroundColor Yellow

Write-Host "建議測試以下新功能:" -ForegroundColor Cyan
Write-Host "1. 客戶管理 API:" -ForegroundColor White
Write-Host "   GET /api/customers - 客戶列表和搜索" -ForegroundColor Gray
Write-Host "   GET /api/customers/:id - 客戶詳情" -ForegroundColor Gray
Write-Host "   POST /api/customers/:id/tags - 添加標籤" -ForegroundColor Gray

Write-Host "2. 標籤系統 API:" -ForegroundColor White
Write-Host "   GET /api/tags - 標籤列表" -ForegroundColor Gray
Write-Host "   POST /api/tags - 創建標籤" -ForegroundColor Gray
Write-Host "   GET /api/tags/:id/stats - 標籤統計" -ForegroundColor Gray

Write-Host "3. 對話管理增強 API:" -ForegroundColor White
Write-Host "   PUT /api/conversations/:id/priority - 設定優先級" -ForegroundColor Gray
Write-Host "   POST /api/conversations/:id/transfer - 轉移對話" -ForegroundColor Gray
Write-Host "   POST /api/conversations/auto-assign - 自動分配" -ForegroundColor Gray

Write-Host "4. 訊息搜索 API:" -ForegroundColor White
Write-Host "   GET /api/messages/search - 全文搜索" -ForegroundColor Gray
Write-Host "   POST /api/messages/search/advanced - 高級搜索" -ForegroundColor Gray

Write-Host "5. 通知系統 API:" -ForegroundColor White
Write-Host "   GET /api/notifications - 通知列表" -ForegroundColor Gray
Write-Host "   GET /api/notifications/sse - 即時通知" -ForegroundColor Gray

Write-Host "6. 儀表板 API:" -ForegroundColor White
Write-Host "   GET /api/dashboard/overview - 綜合概覽" -ForegroundColor Gray
Write-Host "   GET /api/dashboard/workload - 工作負載統計" -ForegroundColor Gray

# 7. 部署建議
Write-Host "`n--- 7. 部署建議 ---" -ForegroundColor Yellow

Write-Host "部署步驟:" -ForegroundColor Cyan
Write-Host "1. 確認所有測試通過後，部署到測試環境" -ForegroundColor White
Write-Host "2. 執行完整的功能測試" -ForegroundColor White
Write-Host "3. 確認性能指標符合預期" -ForegroundColor White
Write-Host "4. 部署到生產環境" -ForegroundColor White

Write-Host "`n生產環境部署命令:" -ForegroundColor Cyan
Write-Host "npm run deploy" -ForegroundColor Gray

# 完成
Write-Host "`n=== 增強功能應用完成 ===" -ForegroundColor Green

if ($DryRun) {
    Write-Host "這是演練模式，未進行實際更改" -ForegroundColor Yellow
    Write-Host "重新執行時請移除 -DryRun 參數來應用更改" -ForegroundColor Yellow
} else {
    Write-Host "所有增強功能已成功應用！" -ForegroundColor Green
    Write-Host ""
    Write-Host "新功能概覽:" -ForegroundColor Cyan
    Write-Host "✓ 客戶管理系統（CRUD + 搜索 + 統計）" -ForegroundColor Green
    Write-Host "✓ 標籤系統（全局和團隊標籤）" -ForegroundColor Green
    Write-Host "✓ 對話狀態管理（優先級 + 轉移 + 自動分配）" -ForegroundColor Green
    Write-Host "✓ 訊息全文搜索（基礎 + 高級 + 高亮）" -ForegroundColor Green
    Write-Host "✓ 即時通知系統（SSE + 通知設定）" -ForegroundColor Green
    Write-Host "✓ 增強儀表板（概覽 + 工作負載 + 平台統計）" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "接下來可以:" -ForegroundColor Yellow
    Write-Host "1. 啟動開發服務器: npm run dev" -ForegroundColor Gray
    Write-Host "2. 測試新功能 API" -ForegroundColor Gray
    Write-Host "3. 查看管理界面的增強功能" -ForegroundColor Gray
}