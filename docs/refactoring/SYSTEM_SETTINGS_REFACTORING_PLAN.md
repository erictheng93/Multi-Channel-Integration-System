# SystemSettings.vue 重构规划

**日期**: 2026-01-02
**组件**: SystemSettings.vue
**当前大小**: 1,822 lines
**优先级**: #2

---

## 📊 组件分析

### 当前状态

| 指标 | 数值 |
|-----|------|
| **代码行数** | 1,822 lines |
| **主要标签页** | 4 (general, integrations, advanced, system) |
| **异步方法** | 17+ methods |
| **状态变量** | 10+ reactive states |
| **表单** | 4+ forms |

### 功能模块

#### 1. General Settings (基本设置)
- 系统名称
- 联系邮箱
- 时区设置
- 语言设置

#### 2. Integrations (集成管理)
- **LINE 集成**:
  - Channel ID/Secret
  - Access Token
  - 连接测试
  - 凭证清除
- **Facebook 集成**:
  - App ID/Secret
  - Page ID/Token
  - 连接测试
  - 凭证清除

#### 3. Advanced Settings (高级设置)
- 消息队列大小
- 消息超时时间
- 缓存过期时间
- 会话过期时间
- 速率限制开关
- 日志开关
- 指标开关

#### 4. System Maintenance (系统维护)
- 数据库备份/恢复
- 缓存清理 (all/conversations/messages/sessions)
- 系统健康检查
- 系统重启
- 凭证备份

### 识别的方法

```typescript
// 数据加载 (2 methods)
- loadSettings()
- loadBackups()

// 保存设置 (4 methods)
- saveGeneralSettings()
- saveLineSettings()
- saveFacebookSettings()
- saveAdvancedSettings()

// 集成测试 (2 methods)
- testLineIntegration()
- testFacebookIntegration()

// 凭证管理 (3 methods)
- clearLineCredentials()
- clearFacebookCredentials()
- backupCredentials()

// 系统维护 (6 methods)
- backupDatabase()
- restoreDatabase()
- clearCache()
- healthCheck()
- restartSystem()
- showMessage()
```

---

## 🎯 重构目标

### 架构目标

1. **模块化**: 将 1,822 行单体组件拆分为 <100 行主组件 + 多个小组件
2. **可测试性**: 创建 80+ 测试用例，覆盖所有业务逻辑
3. **可维护性**: Controller Pattern 分离业务逻辑
4. **可复用性**: 创建 8+ 独立可复用组件
5. **类型安全**: 完整的 TypeScript 类型定义

### 质量目标

- **测试覆盖率**: > 85%
- **代码减少**: 主文件 > 90%
- **TypeScript 错误**: 0
- **回归问题**: 0

---

## 📐 架构设计

### 1. Type Definitions

**文件**: `types/system-settings.ts`

```typescript
// Settings data types
export interface GeneralSettings {
  systemName: string
  contactEmail: string
  timezone: string
  language: string
}

export interface LineIntegration {
  channelId: string
  channelSecret: string
  accessToken: string
  status: IntegrationStatus
}

export interface FacebookIntegration {
  appId: string
  appSecret: string
  pageId: string
  pageToken: string
  status: IntegrationStatus
}

export interface IntegrationSettings {
  line: LineIntegration
  facebook: FacebookIntegration
}

export interface AdvancedSettings {
  messageQueueSize: number
  messageTimeout: number
  cacheExpiry: number
  sessionExpiry: number
  enableRateLimit: boolean
  enableLogging: boolean
  enableMetrics: boolean
}

export interface SystemSettings {
  general: GeneralSettings
  integrations: IntegrationSettings
  advanced: AdvancedSettings
}

// UI state types
export type SettingsTab = 'general' | 'integrations' | 'advanced' | 'system'
export type IntegrationStatus = 'connected' | 'disconnected' | 'error'
export type CacheType = 'all' | 'conversations' | 'messages' | 'sessions'
export type MessageType = 'success' | 'error' | 'info'

// Backup types
export interface Backup {
  id: string
  filename: string
  createdAt: Date
  size: number
}

// Tab configuration
export interface TabConfig {
  key: SettingsTab
  label: string
  icon: Component
}
```

### 2. Controller Composable

**文件**: `composables/useSystemSettingsController.ts`

```typescript
export function useSystemSettingsController() {
  // State (12 properties)
  const loading = ref(false)
  const saving = ref(false)
  const testing = ref(false)
  const processing = ref(false)
  const activeTab = ref<SettingsTab>('general')
  const showBackupList = ref(false)
  const settings = reactive<SystemSettings>({ ... })
  const backups = ref<Backup[]>([])
  const message = ref('')
  const messageType = ref<MessageType>('success')

  // Computed (4 properties)
  const tabs = computed<TabConfig[]>(() => [...])
  const lineStatus = computed(() => { ... })
  const facebookStatus = computed(() => { ... })
  const isDev = computed(() => import.meta.env.DEV)

  // Data Loading (2 methods)
  async function loadSettings() { ... }
  async function loadBackups() { ... }

  // Save Settings (4 methods)
  async function saveGeneralSettings() { ... }
  async function saveLineSettings() { ... }
  async function saveFacebookSettings() { ... }
  async function saveAdvancedSettings() { ... }

  // Integration Testing (2 methods)
  async function testLineIntegration() { ... }
  async function testFacebookIntegration() { ... }

  // Credentials Management (3 methods)
  async function clearLineCredentials() { ... }
  async function clearFacebookCredentials() { ... }
  async function backupCredentials() { ... }

  // System Maintenance (5 methods)
  async function backupDatabase() { ... }
  async function restoreDatabase(backupId: string) { ... }
  async function clearCache(type: CacheType) { ... }
  async function healthCheck() { ... }
  async function restartSystem() { ... }

  // Utilities (3 methods)
  function showMessage(msg: string, type: MessageType) { ... }
  function getTimezoneDisplay(tz: string) { ... }
  function formatFileSize(bytes: number) { ... }

  // Lifecycle
  async function initialize() { ... }
  function cleanup() { ... }

  return { /* 35+ properties and methods */ }
}
```

### 3. Component Structure

#### 计划的组件 (8个)

1. **SettingsHeader.vue** (~100 lines)
   - 标题和副标题
   - 刷新按钮
   - 消息提示

2. **SettingsNav.vue** (~80 lines)
   - 标签导航
   - 图标 + 标签
   - 激活状态管理

3. **GeneralSettingsForm.vue** (~150 lines)
   - 系统名称
   - 联系邮箱
   - 时区/语言显示
   - 保存按钮

4. **LineIntegrationForm.vue** (~200 lines)
   - Channel ID/Secret 输入
   - Access Token 输入
   - 状态显示
   - 测试连接按钮
   - 清除凭证按钮

5. **FacebookIntegrationForm.vue** (~200 lines)
   - App ID/Secret 输入
   - Page ID/Token 输入
   - 状态显示
   - 测试连接按钮
   - 清除凭证按钮

6. **AdvancedSettingsForm.vue** (~180 lines)
   - 所有高级配置选项
   - 数值输入
   - 开关控件
   - 保存按钮

7. **BackupManager.vue** (~250 lines)
   - 备份列表
   - 创建备份按钮
   - 恢复功能
   - 凭证备份

8. **CacheManager.vue** (~150 lines)
   - 缓存清理选项
   - 健康检查
   - 系统重启

#### 主组件

**SystemSettings.refactored.vue** (~100 lines)

```vue
<template>
  <AppLayout>
    <div class="system-settings">
      <SettingsHeader
        :loading="controller.loading.value"
        :message="controller.message.value"
        :message-type="controller.messageType.value"
        @refresh="controller.loadSettings"
      />

      <div class="settings-content">
        <SettingsNav
          v-model="controller.activeTab.value"
          :tabs="controller.tabs.value"
        />

        <div class="settings-panel">
          <GeneralSettingsForm
            v-if="controller.activeTab.value === 'general'"
            :settings="controller.settings.general"
            :saving="controller.saving.value"
            @save="controller.saveGeneralSettings"
          />

          <div v-if="controller.activeTab.value === 'integrations'">
            <LineIntegrationForm
              :settings="controller.settings.integrations.line"
              :saving="controller.saving.value"
              :testing="controller.testing.value"
              @save="controller.saveLineSettings"
              @test="controller.testLineIntegration"
              @clear="controller.clearLineCredentials"
            />

            <FacebookIntegrationForm
              :settings="controller.settings.integrations.facebook"
              :saving="controller.saving.value"
              :testing="controller.testing.value"
              @save="controller.saveFacebookSettings"
              @test="controller.testFacebookIntegration"
              @clear="controller.clearFacebookCredentials"
            />
          </div>

          <AdvancedSettingsForm
            v-if="controller.activeTab.value === 'advanced'"
            :settings="controller.settings.advanced"
            :saving="controller.saving.value"
            @save="controller.saveAdvancedSettings"
          />

          <div v-if="controller.activeTab.value === 'system'">
            <BackupManager
              :backups="controller.backups.value"
              :processing="controller.processing.value"
              @backup="controller.backupDatabase"
              @restore="controller.restoreDatabase"
              @backup-credentials="controller.backupCredentials"
            />

            <CacheManager
              :processing="controller.processing.value"
              @clear-cache="controller.clearCache"
              @health-check="controller.healthCheck"
              @restart="controller.restartSystem"
            />
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useSystemSettingsController } from '@/composables/useSystemSettingsController'

const controller = useSystemSettingsController()

onMounted(() => controller.initialize())
onUnmounted(() => controller.cleanup())
</script>
```

---

## 📝 测试计划

### 测试覆盖目标: 80+ tests

#### 1. Verification Tests (12 tests)
- 类型定义导出
- Controller 导出
- 组件导出 (8个)
- 主组件导入

#### 2. Controller Unit Tests (45 tests)
- Initialization (6 tests)
- State Management (4 tests)
- Data Loading (4 tests)
- Save Settings (8 tests)
- Integration Testing (4 tests)
- Credentials Management (6 tests)
- System Maintenance (10 tests)
- Utility Functions (3 tests)

#### 3. Component Tests (20 tests)
- SettingsHeader (3 tests)
- SettingsNav (2 tests)
- GeneralSettingsForm (3 tests)
- LineIntegrationForm (3 tests)
- FacebookIntegrationForm (3 tests)
- AdvancedSettingsForm (2 tests)
- BackupManager (2 tests)
- CacheManager (2 tests)

#### 4. Integration Tests (8 tests)
- 完整设置流程
- 标签切换
- 表单保存
- 集成测试
- 备份恢复
- 缓存清理

**总计**: ~85 tests

---

## 🚀 实施阶段

### Phase 1: 准备阶段 (30 min)
- [x] 分析组件结构
- [ ] 创建类型定义文件
- [ ] 创建组件目录结构
- [ ] 创建 README 文档

### Phase 2: Controller 实现 (60 min)
- [ ] 实现 useSystemSettingsController
- [ ] 状态管理 (12 properties)
- [ ] 计算属性 (4 properties)
- [ ] 业务方法 (19 methods)
- [ ] 工具函数 (3 methods)

### Phase 3: 组件实现 (90 min)
- [ ] SettingsHeader.vue
- [ ] SettingsNav.vue
- [ ] GeneralSettingsForm.vue
- [ ] LineIntegrationForm.vue
- [ ] FacebookIntegrationForm.vue
- [ ] AdvancedSettingsForm.vue
- [ ] BackupManager.vue
- [ ] CacheManager.vue
- [ ] SystemSettings.refactored.vue (主组件)

### Phase 4: 测试创建 (75 min)
- [ ] Verification tests (12 tests)
- [ ] Controller unit tests (45 tests)
- [ ] Component tests (20 tests)
- [ ] Integration tests (8 tests)

### Phase 5: 验证和部署 (30 min)
- [ ] 运行所有测试
- [ ] TypeScript 类型检查
- [ ] 回归测试
- [ ] 文件备份
- [ ] 组件替换
- [ ] 最终验证
- [ ] 创建部署报告

**预估总时间**: ~4.5 hours

---

## 📊 预期成果

### 代码质量改善

| 指标 | 重构前 | 预期重构后 | 改善 |
|-----|--------|-----------|------|
| 主文件行数 | 1,822 | ~100 | ⬇️ 94.5% |
| 可复用组件 | 0 | 8 | ⬆️ ∞ |
| 测试覆盖 | 0 | 85 | ⬆️ ∞ |
| 模块数量 | 1 | 10 | ⬆️ 900% |

### 架构改善

- ✅ Controller Pattern 业务逻辑分离
- ✅ 8 个独立可复用组件
- ✅ 完全类型安全
- ✅ 85+ 测试保护
- ✅ 遵循 Vue 3 最佳实践

---

## 🎯 成功标准

- [ ] 所有测试通过 (85/85)
- [ ] 0 TypeScript 错误
- [ ] 0 回归问题
- [ ] 主文件 < 100 lines
- [ ] 文档完整

---

**状态**: ✅ **规划完成，准备开始实施**
**下一步**: Phase 1 - 创建类型定义和目录结构
