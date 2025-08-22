# 測試用戶登入腳本
# 使用方法: .\test-user-login.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = "http://localhost:8787"
)

Write-Host "🧪 測試用戶登入功能..." -ForegroundColor Green
Write-Host "API URL: $ApiUrl" -ForegroundColor Cyan
Write-Host ""

# 測試用戶列表
$testUsers = @(
    @{
        Name = "超級管理員"
        Username = "superadmin"
        Password = "superadmin123"
        ExpectedRole = "admin"
        Color = "Red"
    },
    @{
        Name = "系統管理員"
        Username = "admin"
        Password = "admin123"
        ExpectedRole = "admin"
        Color = "DarkYellow"
    },
    @{
        Name = "團隊主管"
        Username = "teamlead1"
        Password = "teamlead123"
        ExpectedRole = "agent"
        Color = "Yellow"
    },
    @{
        Name = "客服人員"
        Username = "agent1"
        Password = "agent123"
        ExpectedRole = "agent"
        Color = "Green"
    }
)

$successCount = 0
$totalCount = $testUsers.Count

foreach ($user in $testUsers) {
    Write-Host "🔐 測試 $($user.Name) 登入..." -ForegroundColor $user.Color
    Write-Host "   用戶名: $($user.Username)" -ForegroundColor Gray
    
    try {
        # 準備登入請求
        $loginData = @{
            username = $user.Username
            password = $user.Password
        } | ConvertTo-Json
        
        # 發送登入請求
        $response = Invoke-RestMethod -Uri "$ApiUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json" -TimeoutSec 10
        
        if ($response.success -eq $true) {
            Write-Host "   ✅ 登入成功" -ForegroundColor Green
            Write-Host "   👤 用戶ID: $($response.data.user.id)" -ForegroundColor Cyan
            Write-Host "   📧 郵箱: $($response.data.user.email)" -ForegroundColor Cyan
            Write-Host "   🎭 角色: $($response.data.user.role)" -ForegroundColor Cyan
            Write-Host "   🔑 Token: $($response.data.token.Substring(0, 20))..." -ForegroundColor Cyan
            
            # 驗證角色是否正確
            if ($response.data.user.role -eq $user.ExpectedRole) {
                Write-Host "   ✅ 角色驗證通過" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  角色不符預期 (預期: $($user.ExpectedRole), 實際: $($response.data.user.role))" -ForegroundColor Yellow
            }
            
            $successCount++
        } else {
            Write-Host "   ❌ 登入失敗: $($response.error)" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "   ❌ 請求失敗: $($_.Exception.Message)" -ForegroundColor Red
        
        # 如果是連接錯誤，提供建議
        if ($_.Exception.Message -match "連線") {
            Write-Host "   💡 請確認後端服務正在運行: wrangler dev" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
}

# 測試結果總結
Write-Host "📊 測試結果總結" -ForegroundColor Green
Write-Host "=" * 50
Write-Host "成功登入: $successCount/$totalCount" -ForegroundColor $(if ($successCount -eq $totalCount) { "Green" } else { "Yellow" })

if ($successCount -eq $totalCount) {
    Write-Host "🎉 所有測試用戶登入成功！" -ForegroundColor Green
} else {
    Write-Host "⚠️  部分用戶登入失敗，請檢查:" -ForegroundColor Yellow
    Write-Host "   1. 用戶是否已創建: .\create-test-users.ps1" -ForegroundColor White
    Write-Host "   2. 後端服務是否運行: wrangler dev" -ForegroundColor White
    Write-Host "   3. 資料庫是否正確初始化" -ForegroundColor White
}

Write-Host ""
Write-Host "🔧 下一步測試:" -ForegroundColor Cyan
Write-Host "   - 測試權限控制: .\test-permissions.ps1" -ForegroundColor White
Write-Host "   - 測試前端登入: 訪問 http://localhost:3000" -ForegroundColor White
Write-Host "   - 測試 API 功能: .\test-api.ps1" -ForegroundColor White