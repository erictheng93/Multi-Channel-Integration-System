# 添加 WebSocket 路由到前端路由配置
$routerFile = "D:\Code\Multi_Channel_Integration_System\frontend\src\router\index.ts"

# 讀取檔案內容
$content = Get-Content $routerFile -Raw

# 檢查是否已經包含 WebSocket 路由
if ($content -match "WebSocketAdmin") {
    Write-Host "⚠️ WebSocket 路由已存在，跳過"
    exit 0
}

# 要插入的路由配置
$websocketRoutes = @"
    // ==================== WebSocket 管理路由 ====================
    {
      path: '/admin/websocket',
      name: 'WebSocketAdmin',
      component: () => import('@/views/WebSocketAdmin.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        title: 'WebSocket 遷移管理'
      }
    },
    {
      path: '/monitoring/websocket',
      name: 'WebSocketMonitoring',
      component: () => import('@/views/WebSocketMonitoring.vue'),
      meta: {
        requiresAuth: true,
        title: 'WebSocket 即時監控'
      }
    },
"@

# 找到客戶管理路由的位置並在之前插入
$pattern = "    // ==================== 客戶管理路由 ===================="
$replacement = "$websocketRoutes`n$pattern"

# 替換內容
$newContent = $content -replace [regex]::Escape($pattern), $replacement

# 寫回檔案
$newContent | Set-Content $routerFile -NoNewline

Write-Host "✅ WebSocket 路由已成功添加到 router/index.ts"

# 顯示添加的路由
Write-Host "`n📋 已添加的路由:"
Write-Host "  • /admin/websocket       (Admin) - WebSocket 遷移管理"
Write-Host "  • /monitoring/websocket         - WebSocket 即時監控"
