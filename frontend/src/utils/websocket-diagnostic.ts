/**
 * WebSocket 诊断工具
 * 用于检查 WebSocket 连接状态和实时更新是否正常工作
 */

export function diagnoseWebSocket() {
  console.log('🔍 ===== WebSocket 诊断开始 =====')

  // 1. 检查 localStorage 中的 auth token
  const token = localStorage.getItem('auth_token')
  console.log('1️⃣ Auth Token:', token ? '✅ 存在' : '❌ 缺失')

  // 2. 检查全局 WebSocket 连接
  const ws = (window as any).__ws_client
  console.log('2️⃣ WebSocket Client:', ws ? '✅ 存在' : '❌ 未初始化')

  if (ws) {
    console.log('   - 连接状态:', ws.state || 'unknown')
    console.log('   - 是否已连接:', ws.isConnected?.value || false)
  }

  // 3. 检查 ConversationSync 服务
  const syncService = (window as any).__sync_service
  console.log('3️⃣ Sync Service:', syncService ? '✅ 存在' : '❌ 未初始化')

  if (syncService) {
    console.log('   - 同步状态:', syncService.status?.value || 'unknown')
    console.log('   - 最后更新:', syncService.lastUpdate?.value || 'never')
  }

  // 4. 检查 Pinia stores
  const conversationsStore = (window as any).__pinia?.stores?.conversations
  console.log('4️⃣ Conversations Store:', conversationsStore ? '✅ 存在' : '❌ 未初始化')

  if (conversationsStore) {
    const conversations = conversationsStore.conversations || []
    const totalUnread = conversations.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0)
    console.log(`   - 对话总数: ${conversations.length}`)
    console.log(`   - 未读消息总数: ${totalUnread}`)
    console.log(`   - 有未读的对话:`, conversations.filter((c: any) => c.unreadCount > 0))
  }

  console.log('✅ ===== 诊断完成 =====')
  console.log('💡 如果 WebSocket 未连接，请检查：')
  console.log('   1. 是否已登录')
  console.log('   2. 后端 WebSocket 服务是否正常')
  console.log('   3. 浏览器控制台是否有错误信息')
}

// 添加到全局，方便在控制台调用
if (typeof window !== 'undefined') {
  (window as any).diagnoseWebSocket = diagnoseWebSocket
}
