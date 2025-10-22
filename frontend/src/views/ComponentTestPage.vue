<template>
  <div class="test-page">
    <div class="test-header">
      <h1>🧪 Toast & ConfirmDialog 测试页面</h1>
      <p class="subtitle">验证统一弹窗组件功能</p>
    </div>

    <div class="test-sections">
      <!-- Toast 测试区域 -->
      <section class="test-section">
        <h2>📬 Toast 通知测试</h2>
        <div class="test-grid">
          <button
            class="test-btn success-btn"
            @click="testSuccessToast"
          >
            ✅ 成功 Toast
          </button>
          <button
            class="test-btn error-btn"
            @click="testErrorToast"
          >
            ❌ 错误 Toast
          </button>
          <button
            class="test-btn warning-btn"
            @click="testWarningToast"
          >
            ⚠️ 警告 Toast
          </button>
          <button
            class="test-btn info-btn"
            @click="testInfoToast"
          >
            ℹ️ 信息 Toast
          </button>
        </div>

        <div class="test-grid">
          <button
            class="test-btn"
            @click="testToastWithDescription"
          >
            📝 带描述的 Toast
          </button>
          <button
            class="test-btn"
            @click="testToastWithAction"
          >
            🔘 带操作按钮的 Toast
          </button>
          <button
            class="test-btn"
            @click="testMultipleToasts"
          >
            🔢 多个 Toast
          </button>
          <button
            class="test-btn"
            @click="clearAllToasts"
          >
            🗑️ 清除所有 Toast
          </button>
        </div>
      </section>

      <!-- ConfirmDialog 测试区域 -->
      <section class="test-section">
        <h2>💬 确认对话框测试</h2>
        <div class="test-grid">
          <button
            class="test-btn"
            @click="testDefaultConfirm"
          >
            ❓ 默认确认框
          </button>
          <button
            class="test-btn warning-btn"
            @click="testWarningConfirm"
          >
            ⚠️ 警告对话框
          </button>
          <button
            class="test-btn error-btn"
            @click="testDangerConfirm"
          >
            🚨 危险对话框
          </button>
          <button
            class="test-btn info-btn"
            @click="testInfoConfirm"
          >
            ℹ️ 信息对话框
          </button>
        </div>

        <div class="test-grid">
          <button
            class="test-btn"
            @click="testCustomButtons"
          >
            🔤 自定义按钮文本
          </button>
          <button
            class="test-btn"
            @click="testWithMessage"
          >
            📄 带详细消息
          </button>
        </div>
      </section>

      <!-- 集成测试区域 -->
      <section class="test-section">
        <h2>🔗 集成测试</h2>
        <div class="test-grid">
          <button
            class="test-btn success-btn"
            @click="testWebSocketAdminScenario"
          >
            💾 模拟 WebSocketAdmin 保存
          </button>
          <button
            class="test-btn error-btn"
            @click="testConversationHeaderScenario"
          >
            🚫 模拟 ConversationHeader 错误
          </button>
          <button
            class="test-btn warning-btn"
            @click="testAdvancedAssignScenario"
          >
            👤 模拟 AdvancedAssign 取消指派
          </button>
        </div>
      </section>

      <!-- 测试结果 -->
      <section class="test-section">
        <h2>📊 测试结果</h2>
        <div class="test-results">
          <div
            v-for="(result, index) in testResults"
            :key="index"
            class="result-item"
            :class="`result-${result.type}`"
          >
            <span class="result-time">{{ result.time }}</span>
            <span class="result-message">{{ result.message }}</span>
          </div>
          <div
            v-if="testResults.length === 0"
            class="no-results"
          >
            点击上方按钮开始测试...
          </div>
        </div>
        <button
          v-if="testResults.length > 0"
          class="test-btn clear-btn"
          @click="clearResults"
        >
          清除结果
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

const { showSuccess, showError, showWarning, showInfo, clearToasts } = useToast()
const { showConfirm, showWarning: showWarningDialog, showDanger, showInfo: showInfoDialog } = useConfirmDialog()

interface TestResult {
  time: string
  message: string
  type: 'success' | 'error' | 'info'
}

const testResults = ref<TestResult[]>([])

const addResult = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const now = new Date()
  testResults.value.unshift({
    time: now.toLocaleTimeString('zh-CN'),
    message,
    type
  })
  if (testResults.value.length > 20) {
    testResults.value.pop()
  }
}

const clearResults = () => {
  testResults.value = []
}

// Toast 测试函数
const testSuccessToast = () => {
  showSuccess('操作成功！', '数据已成功保存到服务器')
  addResult('✅ 成功 Toast 已显示', 'success')
}

const testErrorToast = () => {
  showError('操作失败', '网络连接错误，请稍后重试')
  addResult('❌ 错误 Toast 已显示', 'error')
}

const testWarningToast = () => {
  showWarning('注意', '此操作可能影响系统性能')
  addResult('⚠️ 警告 Toast 已显示', 'info')
}

const testInfoToast = () => {
  showInfo('提示', '系统将在 10 分钟后进行维护')
  addResult('ℹ️ 信息 Toast 已显示', 'info')
}

const testToastWithDescription = () => {
  showSuccess('配置已更新', '新的配置将在 5 秒后生效，请注意观察系统行为变化')
  addResult('📝 带长描述的 Toast 已显示', 'success')
}

const testToastWithAction = () => {
  showInfo('新消息', '您有 3 条未读消息', {
    actionText: '查看',
    onAction: () => {
      addResult('🔘 Toast 操作按钮被点击', 'success')
    }
  })
  addResult('🔘 带操作按钮的 Toast 已显示', 'info')
}

const testMultipleToasts = () => {
  showSuccess('第一个通知')
  setTimeout(() => showInfo('第二个通知'), 300)
  setTimeout(() => showWarning('第三个通知'), 600)
  setTimeout(() => showError('第四个通知'), 900)
  addResult('🔢 显示了 4 个连续 Toast', 'info')
}

const clearAllToasts = () => {
  clearToasts()
  addResult('🗑️ 已清除所有 Toast', 'success')
}

// ConfirmDialog 测试函数
const testDefaultConfirm = async () => {
  const result = await showConfirm({
    title: '确认操作',
    message: '确定要继续吗？'
  })
  addResult(`❓ 默认确认框 - 用户${result ? '确认' : '取消'}`, result ? 'success' : 'info')
}

const testWarningConfirm = async () => {
  const result = await showWarningDialog('警告', '此操作无法撤销，确定继续吗？')
  addResult(`⚠️ 警告对话框 - 用户${result ? '确认' : '取消'}`, result ? 'success' : 'info')
}

const testDangerConfirm = async () => {
  const result = await showDanger('危险操作', '这将永久删除所有数据，无法恢复！')
  addResult(`🚨 危险对话框 - 用户${result ? '确认' : '取消'}`, result ? 'error' : 'success')
}

const testInfoConfirm = async () => {
  const result = await showInfoDialog('提示信息', '系统即将更新，是否继续？')
  addResult(`ℹ️ 信息对话框 - 用户${result ? '确认' : '取消'}`, result ? 'success' : 'info')
}

const testCustomButtons = async () => {
  const result = await showConfirm({
    title: '保存更改',
    message: '是否要保存当前的更改？',
    confirmText: '保存',
    cancelText: '放弃'
  })
  addResult(`🔤 自定义按钮 - 用户选择${result ? '保存' : '放弃'}`, result ? 'success' : 'info')
}

const testWithMessage = async () => {
  const result = await showConfirm({
    title: '导出数据',
    message: '将导出最近 30 天的所有数据，包括对话记录、客户信息和统计数据。文件大小约为 15MB。'
  })
  addResult(`📄 带详细消息 - 用户${result ? '确认' : '取消'}`, result ? 'success' : 'info')
}

// 集成测试场景
const testWebSocketAdminScenario = () => {
  // 模拟 WebSocketAdmin.vue 保存成功场景
  showSuccess('配置已保存成功！')
  addResult('💾 WebSocketAdmin 保存场景测试完成', 'success')
}

const testConversationHeaderScenario = () => {
  // 模拟 ConversationHeader.vue 错误场景
  showError('指派失敗', '指派过程中发生错误')
  addResult('🚫 ConversationHeader 错误场景测试完成', 'error')
}

const testAdvancedAssignScenario = async () => {
  // 模拟 AdvancedAssignActions.vue 取消指派场景
  const result = await showWarningDialog('確定要取消對話指派嗎？')
  if (result) {
    showSuccess('已取消指派')
    addResult('👤 AdvancedAssign 取消指派 - 用户确认', 'success')
  } else {
    addResult('👤 AdvancedAssign 取消指派 - 用户取消', 'info')
  }
}
</script>

<style scoped>
.test-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.test-header {
  text-align: center;
  margin-bottom: 40px;
  color: white;
}

.test-header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.subtitle {
  font-size: 1.1rem;
  opacity: 0.9;
}

.test-sections {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.test-section {
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.test-section h2 {
  font-size: 1.5rem;
  margin-bottom: 20px;
  color: #333;
  border-bottom: 2px solid #667eea;
  padding-bottom: 10px;
}

.test-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 15px;
}

.test-grid:last-child {
  margin-bottom: 0;
}

.test-btn {
  padding: 15px 20px;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.test-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.test-btn:active {
  transform: translateY(0);
}

.success-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.error-btn {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.warning-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.info-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.clear-btn {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  margin-top: 15px;
}

.test-results {
  background: #f9fafb;
  border-radius: 8px;
  padding: 20px;
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}

.result-item {
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  border-left: 4px solid #667eea;
  background: white;
  display: flex;
  gap: 12px;
  align-items: center;
}

.result-item.result-success {
  border-left-color: #10b981;
  background: #f0fdf4;
}

.result-item.result-error {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.result-item.result-info {
  border-left-color: #3b82f6;
  background: #eff6ff;
}

.result-time {
  font-size: 0.75rem;
  color: #6b7280;
  min-width: 70px;
  font-family: monospace;
}

.result-message {
  flex: 1;
  font-size: 0.9rem;
  color: #111827;
}

.no-results {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
  font-size: 1.1rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .test-page {
    padding: 20px 10px;
  }

  .test-header h1 {
    font-size: 1.8rem;
  }

  .test-section {
    padding: 20px;
  }

  .test-grid {
    grid-template-columns: 1fr;
  }
}
</style>
