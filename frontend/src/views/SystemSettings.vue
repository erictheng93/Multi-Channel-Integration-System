<template>
  <AppLayout>
    <div class="system-settings">
      <!-- Header -->
      <div class="settings-header">
        <div class="header-content">
          <div class="header-info">
            <h1 class="settings-title">
              {{ t('systemSettings.title') }}
            </h1>
            <p class="settings-subtitle">
              {{ t('systemSettings.subtitle') }}
            </p>
          </div>
          <div class="header-actions">
            <RefreshButton
              :loading="loading"
              @refresh="loadSettings"
            />
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div
        v-if="loading"
        class="loading-container"
      >
        <div class="loading-spinner" />
        <p>載入設定中...</p>
      </div>

      <!-- Settings Content -->
      <div
        v-else
        class="settings-content"
      >
        <!-- Settings Navigation -->
        <div class="settings-nav">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="['nav-tab', { active: activeTab === tab.key }]"
            @click="activeTab = tab.key"
          >
            <component :is="tab.icon" />
            {{ tab.label }}
          </button>
        </div>

        <!-- Settings Panels -->
        <div class="settings-panel">
          <!-- General Settings -->
          <div
            v-if="activeTab === 'general'"
            class="panel-content"
          >
            <h2 class="panel-title">
              {{ t('systemSettings.general.title') }}
            </h2>
            <form
              class="settings-form"
              @submit.prevent="saveGeneralSettings"
            >
              <div class="form-group">
                <label for="systemName">{{ t('systemSettings.general.systemName') }}</label>
                <input
                  id="systemName"
                  v-model="settings.general.systemName"
                  type="text"
                  class="form-input"
                  placeholder="Multi-Channel Support"
                >
              </div>

              <div class="form-group">
                <label for="contactEmail">{{ t('systemSettings.general.contactEmail') }}</label>
                <input
                  id="contactEmail"
                  v-model="settings.general.contactEmail"
                  type="email"
                  class="form-input"
                  placeholder="admin@example.com"
                >
              </div>

              <div class="form-group">
                <label for="timezone">{{ t('systemSettings.general.timezone') }}</label>
                <div class="form-display">
                  {{ getTimezoneDisplay(settings.general.timezone) }}
                </div>
              </div>

              <div class="form-group">
                <label for="language">{{ t('systemSettings.general.language') }}</label>
                <div class="form-display">
                  繁體中文 (zh-TW)
                </div>
              </div>

              <div class="form-actions">
                <button
                  type="submit"
                  class="btn btn-primary"
                  :disabled="saving"
                >
                  {{ saving ? t('systemSettings.messages.saving') : t('common.save') }}
                </button>
              </div>
            </form>
          </div>

          <!-- Integration Settings -->
          <div
            v-if="activeTab === 'integrations'"
            class="panel-content"
          >
            <h2 class="panel-title">
              平台整合
            </h2>

            <!-- LINE Integration -->
            <div class="integration-section">
              <div class="integration-header">
                <h3>LINE Official Account</h3>
                <div
                  class="status-badge"
                  :class="lineStatus"
                >
                  {{ getStatusText(settings.integrations.line?.status) }}
                </div>
              </div>

              <form
                class="settings-form"
                @submit.prevent="saveLineSettings"
              >
                <div class="form-group">
                  <label for="lineChannelId">Channel ID</label>
                  <input
                    id="lineChannelId"
                    v-model="settings.integrations.line.channelId"
                    type="text"
                    class="form-input"
                    placeholder="輸入 LINE Channel ID"
                  >
                </div>

                <div class="form-group">
                  <label for="lineChannelSecret">Channel Secret</label>
                  <input
                    id="lineChannelSecret"
                    v-model="settings.integrations.line.channelSecret"
                    type="password"
                    class="form-input"
                    placeholder="輸入 LINE Channel Secret"
                  >
                </div>

                <div class="form-group">
                  <label for="lineAccessToken">Access Token</label>
                  <input
                    id="lineAccessToken"
                    v-model="settings.integrations.line.accessToken"
                    type="password"
                    class="form-input"
                    placeholder="輸入 LINE Access Token"
                  >
                </div>

                <div class="form-actions">
                  <button
                    type="button"
                    class="btn btn-secondary"
                    :disabled="testing"
                    @click="testLineIntegration"
                  >
                    {{ testing ? '測試中...' : '測試連線' }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-danger"
                    :disabled="processing"
                    @click="clearLineCredentials"
                  >
                    {{ processing ? '清除中...' : '清除憑證' }}
                  </button>
                  <button
                    type="submit"
                    class="btn btn-primary"
                    :disabled="saving"
                  >
                    {{ saving ? '儲存中...' : '儲存設定' }}
                  </button>
                </div>
              </form>
            </div>

            <!-- Facebook Integration -->
            <div class="integration-section">
              <div class="integration-header">
                <h3>Facebook Messenger</h3>
                <div
                  class="status-badge"
                  :class="facebookStatus"
                >
                  {{ getStatusText(settings.integrations.facebook?.status) }}
                </div>
              </div>

              <form
                class="settings-form"
                @submit.prevent="saveFacebookSettings"
              >
                <div class="form-group">
                  <label for="fbAppId">App ID</label>
                  <input
                    id="fbAppId"
                    v-model="settings.integrations.facebook.appId"
                    type="text"
                    class="form-input"
                    placeholder="輸入 Facebook App ID"
                  >
                </div>

                <div class="form-group">
                  <label for="fbAppSecret">App Secret</label>
                  <input
                    id="fbAppSecret"
                    v-model="settings.integrations.facebook.appSecret"
                    type="password"
                    class="form-input"
                    placeholder="輸入 Facebook App Secret"
                  >
                </div>

                <div class="form-group">
                  <label for="fbPageId">Page ID</label>
                  <input
                    id="fbPageId"
                    v-model="settings.integrations.facebook.pageId"
                    type="text"
                    class="form-input"
                    placeholder="輸入 Facebook Page ID"
                  >
                </div>

                <div class="form-group">
                  <label for="fbPageToken">Page Token</label>
                  <input
                    id="fbPageToken"
                    v-model="settings.integrations.facebook.pageToken"
                    type="password"
                    class="form-input"
                    placeholder="輸入 Facebook Page Token"
                  >
                </div>

                <div class="form-actions">
                  <button
                    type="button"
                    class="btn btn-secondary"
                    :disabled="testing"
                    @click="testFacebookIntegration"
                  >
                    {{ testing ? '測試中...' : '測試連線' }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-danger"
                    :disabled="processing"
                    @click="clearFacebookCredentials"
                  >
                    {{ processing ? '清除中...' : '清除憑證' }}
                  </button>
                  <button
                    type="submit"
                    class="btn btn-primary"
                    :disabled="saving"
                  >
                    {{ saving ? '儲存中...' : '儲存設定' }}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- Advanced Settings -->
          <div
            v-if="activeTab === 'advanced'"
            class="panel-content"
          >
            <h2 class="panel-title">
              進階設定
            </h2>
            <form
              class="settings-form"
              @submit.prevent="saveAdvancedSettings"
            >
              <div class="form-group">
                <label for="messageQueueSize">訊息佇列大小</label>
                <input
                  id="messageQueueSize"
                  v-model.number="settings.advanced.messageQueueSize"
                  type="number"
                  class="form-input"
                  min="100"
                  max="10000"
                >
              </div>

              <div class="form-group">
                <label for="messageTimeout">訊息逾時 (秒)</label>
                <input
                  id="messageTimeout"
                  v-model.number="settings.advanced.messageTimeout"
                  type="number"
                  class="form-input"
                  min="5"
                  max="300"
                >
              </div>

              <div class="form-group">
                <label for="cacheExpiry">快取過期時間 (分鐘)</label>
                <input
                  id="cacheExpiry"
                  v-model.number="settings.advanced.cacheExpiry"
                  type="number"
                  class="form-input"
                  min="1"
                  max="1440"
                >
              </div>

              <div class="form-group">
                <label for="sessionExpiry">會話過期時間 (小時)</label>
                <input
                  id="sessionExpiry"
                  v-model.number="settings.advanced.sessionExpiry"
                  type="number"
                  class="form-input"
                  min="1"
                  max="168"
                >
              </div>

              <div class="form-group checkbox-group">
                <label class="checkbox-label">
                  <input
                    v-model="settings.advanced.enableRateLimit"
                    type="checkbox"
                    class="form-checkbox"
                  >
                  啟用速率限制
                </label>
              </div>

              <div class="form-group checkbox-group">
                <label class="checkbox-label">
                  <input
                    v-model="settings.advanced.enableLogging"
                    type="checkbox"
                    class="form-checkbox"
                  >
                  啟用系統日誌
                </label>
              </div>

              <div class="form-group checkbox-group">
                <label class="checkbox-label">
                  <input
                    v-model="settings.advanced.enableMetrics"
                    type="checkbox"
                    class="form-checkbox"
                  >
                  啟用效能監控
                </label>
              </div>

              <div class="form-actions">
                <button
                  type="submit"
                  class="btn btn-primary"
                  :disabled="saving"
                >
                  {{ saving ? '儲存中...' : '儲存設定' }}
                </button>
              </div>
            </form>
          </div>

          <!-- System Management -->
          <div
            v-if="activeTab === 'system'"
            class="panel-content"
          >
            <h2 class="panel-title">
              系統管理
            </h2>

            <div class="management-section">
              <h3>資料庫管理</h3>
              <div class="management-actions">
                <button
                  class="btn btn-secondary"
                  :disabled="processing"
                  @click="backupDatabase"
                >
                  {{ processing ? '備份中...' : '備份資料庫' }}
                </button>
                <button
                  class="btn btn-secondary"
                  @click="showBackupList = !showBackupList"
                >
                  查看備份
                </button>
              </div>

              <div
                v-if="showBackupList"
                class="backup-list"
              >
                <div
                  v-for="backup in backups"
                  :key="backup.id"
                  class="backup-item"
                >
                  <div class="backup-info">
                    <span class="backup-name">{{ backup.filename }}</span>
                    <span class="backup-date">{{ formatDate(backup.createdAt) }}</span>
                    <span class="backup-size">{{ formatSize(backup.size) }}</span>
                  </div>
                  <button
                    class="btn btn-sm btn-primary"
                    @click="restoreDatabase(backup.id)"
                  >
                    恢復
                  </button>
                </div>
              </div>
            </div>

            <div class="management-section">
              <h3>憑證管理</h3>
              <div class="management-actions">
                <button
                  class="btn btn-secondary"
                  :disabled="processing"
                  @click="backupCredentials"
                >
                  {{ processing ? '備份中...' : '備份憑證' }}
                </button>
                <button
                  class="btn btn-danger"
                  :disabled="processing"
                  @click="clearLineCredentials"
                >
                  清除 LINE 憑證
                </button>
                <button
                  class="btn btn-danger"
                  :disabled="processing"
                  @click="clearFacebookCredentials"
                >
                  清除 Facebook 憑證
                </button>
              </div>
            </div>

            <div class="management-section">
              <h3>快取管理</h3>
              <div class="management-actions">
                <button
                  class="btn btn-secondary"
                  :disabled="processing"
                  @click="clearCache('all')"
                >
                  清除所有快取
                </button>
                <button
                  class="btn btn-secondary"
                  :disabled="processing"
                  @click="clearCache('conversations')"
                >
                  清除對話快取
                </button>
                <button
                  class="btn btn-secondary"
                  :disabled="processing"
                  @click="clearCache('messages')"
                >
                  清除訊息快取
                </button>
              </div>
            </div>

            <div class="management-section">
              <h3>系統控制</h3>
              <div class="management-actions">
                <button
                  class="btn btn-secondary"
                  :disabled="processing"
                  @click="healthCheck"
                >
                  健康檢查
                </button>
                <button
                  class="btn btn-danger"
                  :disabled="processing"
                  @click="restartSystem"
                >
                  重啟系統
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Success/Error Messages -->
      <div
        v-if="message"
        :class="['message', messageType]"
      >
        {{ message }}
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { systemApi, credentialsApi } from '@/api/system'
import AppLayout from '@/components/ui/AppLayout.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import { SettingsIcon, IntegrationIcon, AdvancedIcon, SystemIcon } from '@/components/icons'
import { useI18n } from '@/composables/useI18n'
import { useConfirm } from '@/composables/useConfirm'
// 已移除所有診斷和測試工具的引用

const route = useRoute()

// i18n
const { t } = useI18n()
const { confirmDanger, confirmWarning } = useConfirm()

// Reactive state
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const processing = ref(false)
const activeTab = ref('general')
const showBackupList = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error' | 'info'>('success')
interface Backup {
  id: string
  filename: string
  createdAt: string | Date
  size: number
}

const backups = ref<Backup[]>([])

// Settings data
const settings = reactive({
  general: {
    systemName: '',
    contactEmail: '',
    timezone: 'Asia/Taipei',
    language: 'zh-TW'
  },
  integrations: {
    line: {
      channelId: '',
      channelSecret: '',
      accessToken: '',
      status: 'disconnected' as 'connected' | 'disconnected' | 'error'
    },
    facebook: {
      appId: '',
      appSecret: '',
      pageId: '',
      pageToken: '',
      status: 'disconnected' as 'connected' | 'disconnected' | 'error'
    }
  },
  advanced: {
    messageQueueSize: 1000,
    messageTimeout: 30,
    cacheExpiry: 60,
    sessionExpiry: 24,
    enableRateLimit: true,
    enableLogging: true,
    enableMetrics: true
  }
})

// Tab configuration
const tabs = computed(() => [
  { key: 'general', label: t('systemSettings.tabs.general'), icon: SettingsIcon },
  { key: 'integrations', label: t('systemSettings.tabs.integrations'), icon: IntegrationIcon },
  { key: 'advanced', label: t('systemSettings.tabs.advanced'), icon: AdvancedIcon },
  { key: 'system', label: t('systemSettings.tabs.system'), icon: SystemIcon }
])

// Computed properties
const isDev = computed(() => import.meta.env.DEV)

const lineStatus = computed(() => {
  const status = settings.integrations.line?.status
  return {
    'status-connected': status === 'connected',
    'status-disconnected': status === 'disconnected',
    'status-error': status === 'error'
  }
})

const facebookStatus = computed(() => {
  const status = settings.integrations.facebook?.status
  return {
    'status-connected': status === 'connected',
    'status-disconnected': status === 'disconnected',
    'status-error': status === 'error'
  }
})

// Methods
const loadSettings = async () => {
  try {
    loading.value = true

    // 載入基本設定
    const settingsResponse = await systemApi.getSettings()
    if (settingsResponse.success && settingsResponse.data) {
      // 安全地合併設定，保持現有結構
      if (settingsResponse.data.general) {
        Object.assign(settings.general, settingsResponse.data.general)
      }
      if (settingsResponse.data.advanced) {
        Object.assign(settings.advanced, settingsResponse.data.advanced)
      }
      // 只合併 integrations 的 status，不覆蓋整個結構
      if (settingsResponse.data.integrations?.line?.status) {
        settings.integrations.line.status = settingsResponse.data.integrations.line.status
      }
      if (settingsResponse.data.integrations?.facebook?.status) {
        settings.integrations.facebook.status = settingsResponse.data.integrations.facebook.status
      }
    }

    // 載入憑證資料
    const credentialsResponse = await credentialsApi.getAllCredentials()
    if (credentialsResponse.success && credentialsResponse.data) {
      // 確保 integrations 結構存在
      if (!settings.integrations) {
        settings.integrations = {
          line: { channelId: '', channelSecret: '', accessToken: '', status: 'disconnected' },
          facebook: { appId: '', appSecret: '', pageId: '', pageToken: '', status: 'disconnected' }
        }
      }

      // 確保 line 和 facebook 物件存在
      if (!settings.integrations.line) {
        settings.integrations.line = { channelId: '', channelSecret: '', accessToken: '', status: 'disconnected' }
      }
      if (!settings.integrations.facebook) {
        settings.integrations.facebook = { appId: '', appSecret: '', pageId: '', pageToken: '', status: 'disconnected' }
      }

      // 安全地合併憑證資料，保持現有的 status
      if (credentialsResponse.data.line) {
        settings.integrations.line.channelId = credentialsResponse.data.line.channelId || ''
        settings.integrations.line.channelSecret = credentialsResponse.data.line.channelSecret || ''
        settings.integrations.line.accessToken = credentialsResponse.data.line.accessToken || ''
      }
      if (credentialsResponse.data.facebook) {
        settings.integrations.facebook.appId = credentialsResponse.data.facebook.appId || ''
        settings.integrations.facebook.appSecret = credentialsResponse.data.facebook.appSecret || ''
        settings.integrations.facebook.pageId = credentialsResponse.data.facebook.pageId || ''
        settings.integrations.facebook.pageToken = credentialsResponse.data.facebook.pageToken || ''
      }
    }

    console.log('Loaded settings:', settings)
  } catch (error) {
    console.error('Failed to load settings:', error)
    showMessage(t('systemSettings.messages.saveFailed'), 'error')
  } finally {
    loading.value = false
  }
}

const saveGeneralSettings = async () => {
  try {
    saving.value = true
    // 確保語言設定固定為繁體中文
    const settingsToSave = {
      ...settings.general,
      language: 'zh-TW'
    }

    const response = await systemApi.updateSettings({ general: settingsToSave })

    if (response.success) {
      showMessage(t('systemSettings.messages.saveSuccess'), 'success')
    } else {
      const errorMessage = response.message || t('systemSettings.messages.saveFailed')
      showMessage(errorMessage, 'error')
      console.error('Settings save failed:', response)
    }
  } catch (error) {
    console.error('Failed to save general settings:', error)
    const errorMessage = error instanceof Error ? error.message : t('systemSettings.messages.saveFailed')
    showMessage(`${t('systemSettings.messages.saveFailed')}: ${errorMessage}`, 'error')
  } finally {
    saving.value = false
  }
}

const saveLineSettings = async () => {
  try {
    saving.value = true

    // 確保 LINE 設定結構存在
    if (!settings.integrations?.line) {
      showMessage('LINE 設定結構異常，請重新載入頁面', 'error')
      return
    }

    // 使用新的憑證 API 儲存敏感資料
    await Promise.all([
      credentialsApi.storeCredential('line', 'channelId', settings.integrations.line.channelId || ''),
      credentialsApi.storeCredential('line', 'channelSecret', settings.integrations.line.channelSecret || ''),
      credentialsApi.storeCredential('line', 'accessToken', settings.integrations.line.accessToken || '')
    ])

    // 儲存非敏感設定到資料庫
    const response = await systemApi.updateSettings({
      integrations: {
        line: {
          status: settings.integrations.line.status
        }
      }
    })

    if (response.success) {
      showMessage('LINE 設定已儲存', 'success')
    } else {
      const errorMessage = response.message || '儲存失敗'
      showMessage(`儲存 LINE 設定失敗: ${errorMessage}`, 'error')
    }
  } catch (error) {
    console.error('Failed to save LINE settings:', error)
    const errorMessage = error instanceof Error ? error.message : '儲存失敗'
    showMessage(`儲存 LINE 設定失敗: ${errorMessage}`, 'error')
  } finally {
    saving.value = false
  }
}

const saveFacebookSettings = async () => {
  try {
    saving.value = true

    // 確保 Facebook 設定結構存在
    if (!settings.integrations?.facebook) {
      showMessage('Facebook 設定結構異常，請重新載入頁面', 'error')
      return
    }

    // 使用新的憑證 API 儲存敏感資料
    await Promise.all([
      credentialsApi.storeCredential('facebook', 'appId', settings.integrations.facebook.appId || ''),
      credentialsApi.storeCredential('facebook', 'appSecret', settings.integrations.facebook.appSecret || ''),
      credentialsApi.storeCredential('facebook', 'pageId', settings.integrations.facebook.pageId || ''),
      credentialsApi.storeCredential('facebook', 'pageToken', settings.integrations.facebook.pageToken || '')
    ])

    // 儲存非敏感設定到資料庫
    const response = await systemApi.updateSettings({
      integrations: {
        facebook: {
          status: settings.integrations.facebook.status
        }
      }
    })

    if (response.success) {
      showMessage('Facebook 設定已儲存', 'success')
    } else {
      showMessage('儲存 Facebook 設定失敗', 'error')
    }
  } catch (error) {
    console.error('Failed to save Facebook settings:', error)
    showMessage('儲存 Facebook 設定失敗', 'error')
  } finally {
    saving.value = false
  }
}

const saveAdvancedSettings = async () => {
  try {
    saving.value = true
    const response = await systemApi.updateSettings({ advanced: settings.advanced })

    if (response.success) {
      showMessage('進階設定已儲存', 'success')
    } else {
      showMessage('儲存進階設定失敗', 'error')
    }
  } catch (error) {
    console.error('Failed to save advanced settings:', error)
    showMessage('儲存進階設定失敗', 'error')
  } finally {
    saving.value = false
  }
}

const testLineIntegration = async () => {
  try {
    testing.value = true

    // 確保 LINE 設定結構存在
    if (!settings.integrations?.line) {
      showMessage('LINE 設定結構異常，請重新載入頁面', 'error')
      return
    }

    const response = await systemApi.testIntegration('line', {
      channelId: settings.integrations.line.channelId || '',
      channelSecret: settings.integrations.line.channelSecret || '',
      accessToken: settings.integrations.line.accessToken || ''
    })

    if (response.success && response.data) {
      if (response.data.status === 'success') {
        settings.integrations.line.status = 'connected'
        showMessage('LINE 連線測試成功', 'success')
      } else {
        settings.integrations.line.status = 'error'
        showMessage(`LINE 連線測試失敗: ${response.data.message}`, 'error')
      }
    }
  } catch (error) {
    console.error('Failed to test LINE integration:', error)
    if (settings.integrations?.line) {
      settings.integrations.line.status = 'error'
    }
    showMessage('LINE 連線測試失敗', 'error')
  } finally {
    testing.value = false
  }
}

const testFacebookIntegration = async () => {
  try {
    testing.value = true

    // 確保 Facebook 設定結構存在
    if (!settings.integrations?.facebook) {
      showMessage('Facebook 設定結構異常，請重新載入頁面', 'error')
      return
    }

    const response = await systemApi.testIntegration('facebook', {
      appId: settings.integrations.facebook.appId || '',
      appSecret: settings.integrations.facebook.appSecret || '',
      pageId: settings.integrations.facebook.pageId || '',
      pageToken: settings.integrations.facebook.pageToken || ''
    })

    if (response.success && response.data) {
      if (response.data.status === 'success') {
        settings.integrations.facebook.status = 'connected'
        showMessage('Facebook 連線測試成功', 'success')
      } else {
        settings.integrations.facebook.status = 'error'
        showMessage(`Facebook 連線測試失敗: ${response.data.message}`, 'error')
      }
    }
  } catch (error) {
    console.error('Failed to test Facebook integration:', error)
    if (settings.integrations?.facebook) {
      settings.integrations.facebook.status = 'error'
    }
    showMessage('Facebook 連線測試失敗', 'error')
  } finally {
    testing.value = false
  }
}

const backupDatabase = async () => {
  try {
    processing.value = true
    const response = await systemApi.backupDatabase()

    if (response.success) {
      showMessage('資料庫備份成功', 'success')
      loadBackups()
    } else {
      showMessage('資料庫備份失敗', 'error')
    }
  } catch (error) {
    console.error('Failed to backup database:', error)
    showMessage('資料庫備份失敗', 'error')
  } finally {
    processing.value = false
  }
}

const loadBackups = async () => {
  try {
    const response = await systemApi.getBackups()
    if (response.success && response.data) {
      backups.value = response.data
    }
  } catch (error) {
    console.error('Failed to load backups:', error)
  }
}

const restoreDatabase = async (backupId: string) => {
  const confirmed = await confirmDanger(
    '恢復資料庫備份',
    '確定要恢復此備份嗎？這將覆蓋目前的資料庫內容。此操作無法復原。',
    '恢復備份'
  )
  if (!confirmed) {
    return
  }

  try {
    processing.value = true
    const response = await systemApi.restoreDatabase(backupId)

    if (response.success) {
      showMessage('資料庫恢復成功', 'success')
    } else {
      showMessage('資料庫恢復失敗', 'error')
    }
  } catch (error) {
    console.error('Failed to restore database:', error)
    showMessage('資料庫恢復失敗', 'error')
  } finally {
    processing.value = false
  }
}

const clearCache = async (type: 'all' | 'conversations' | 'messages' | 'sessions') => {
  try {
    processing.value = true
    const response = await systemApi.clearCache(type)

    if (response.success) {
      showMessage('快取清除成功', 'success')
    } else {
      showMessage('快取清除失敗', 'error')
    }
  } catch (error) {
    console.error('Failed to clear cache:', error)
    showMessage('快取清除失敗', 'error')
  } finally {
    processing.value = false
  }
}

const healthCheck = async () => {
  try {
    processing.value = true
    const response = await systemApi.healthCheck()

    if (response.success && response.data) {
      const status = response.data.status
      showMessage(`系統健康檢查: ${status === 'healthy' ? '正常' : '異常'}`,
        status === 'healthy' ? 'success' : 'error')
    }
  } catch (error) {
    console.error('Failed to perform health check:', error)
    showMessage('健康檢查失敗', 'error')
  } finally {
    processing.value = false
  }
}

const restartSystem = async () => {
  const confirmed = await confirmWarning(
    '重啟系統',
    '確定要重啟系統嗎？這將中斷所有連線。',
    '重啟系統'
  )
  if (!confirmed) {
    return
  }

  try {
    processing.value = true
    const response = await systemApi.restartSystem()

    if (response.success) {
      showMessage('系統重啟指令已發送', 'success')
    } else {
      showMessage('系統重啟失敗', 'error')
    }
  } catch (error) {
    console.error('Failed to restart system:', error)
    showMessage('系統重啟失敗', 'error')
  } finally {
    processing.value = false
  }
}

const getStatusText = (status?: string) => {
  switch (status) {
    case 'connected': return '已連線'
    case 'disconnected': return '未連線'
    case 'error': return '錯誤'
    default: return '未知'
  }
}

const getTimezoneDisplay = (timezone: string) => {
  const timezoneMap: Record<string, string> = {
    'Asia/Taipei': 'Asia/Taipei (GMT+8)',
    'UTC': 'UTC (GMT+0)',
    'America/New_York': 'America/New_York (GMT-5)',
    'Asia/Tokyo': 'Asia/Tokyo (GMT+9)',
    'Europe/London': 'Europe/London (GMT+0)',
    'America/Los_Angeles': 'America/Los_Angeles (GMT-8)'
  }
  return timezoneMap[timezone] || `${timezone} (未知時區)`
}

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleString('zh-TW')
}

const formatSize = (bytes: number) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0) { return '0 Bytes' }
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
}

const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
  message.value = text
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 5000)
}

// 清除 LINE 憑證
const clearLineCredentials = async () => {
  const confirmed = await confirmDanger(
    '清除 LINE 憑證',
    '確定要清除所有 LINE 憑證嗎？此操作無法復原。',
    '清除憑證'
  )
  if (!confirmed) {
    return
  }

  try {
    processing.value = true
    await credentialsApi.clearPlatformCredentials('line')

    // 確保結構存在後清空前端顯示
    if (settings.integrations?.line) {
      settings.integrations.line.channelId = ''
      settings.integrations.line.channelSecret = ''
      settings.integrations.line.accessToken = ''
      settings.integrations.line.status = 'disconnected'
    }

    showMessage('LINE 憑證已清除', 'success')
  } catch (error) {
    console.error('Failed to clear LINE credentials:', error)
    showMessage('清除 LINE 憑證失敗', 'error')
  } finally {
    processing.value = false
  }
}

// 清除 Facebook 憑證
const clearFacebookCredentials = async () => {
  const confirmed = await confirmDanger(
    '清除 Facebook 憑證',
    '確定要清除所有 Facebook 憑證嗎？此操作無法復原。',
    '清除憑證'
  )
  if (!confirmed) {
    return
  }

  try {
    processing.value = true
    await credentialsApi.clearPlatformCredentials('facebook')

    // 確保結構存在後清空前端顯示
    if (settings.integrations?.facebook) {
      settings.integrations.facebook.appId = ''
      settings.integrations.facebook.appSecret = ''
      settings.integrations.facebook.pageId = ''
      settings.integrations.facebook.pageToken = ''
      settings.integrations.facebook.status = 'disconnected'
    }

    showMessage('Facebook 憑證已清除', 'success')
  } catch (error) {
    console.error('Failed to clear Facebook credentials:', error)
    showMessage('清除 Facebook 憑證失敗', 'error')
  } finally {
    processing.value = false
  }
}

// 備份憑證
const backupCredentials = async () => {
  try {
    processing.value = true
    const response = await credentialsApi.backupCredentials()

    if (response.success && response.data) {
      // 創建下載連結
      const dataStr = JSON.stringify(response.data, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)

      const link = document.createElement('a')
      link.href = url
      link.download = `credentials-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      showMessage('憑證備份已下載', 'success')
    }
  } catch (error) {
    console.error('Failed to backup credentials:', error)
    showMessage('憑證備份失敗', 'error')
  } finally {
    processing.value = false
  }
}

// 語言設定已固定為繁體中文，移除了所有測試函數

// 監控語言變化
watch(() => settings.general.language, (newLang, oldLang) => {
  console.log('Language setting changed:', { from: oldLang, to: newLang })
})

// 監聽路由變化，確保SystemSettings頁面正確重新渲染
watch(() => route.path, (newPath, oldPath) => {
  console.log('🔄 SystemSettings: Route changed from', oldPath, 'to', newPath)

  // 如果路由到達SystemSettings頁面，確保數據刷新
  if (newPath === '/settings') {
    console.log('🔄 SystemSettings: Refreshing data due to route change')
    loadSettings()
    loadBackups()
  }
}, { immediate: false })

// Lifecycle
onMounted(() => {
  console.log('🚀 SystemSettings mounted')
  loadSettings()
  loadBackups()

  // 開發模式下的基本日誌
  if (isDev.value) {
    console.log('🚀 SystemSettings mounted in development mode')
  }
})
</script>

<style scoped>
.system-settings {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: 32px;
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.header-info {
  flex: 1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.settings-title {
  font-size: 28px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.settings-subtitle {
  font-size: 16px;
  color: #666;
  margin: 0;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 0;
  color: #666;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.settings-content {
  display: flex;
  gap: 24px;
}

.settings-nav {
  flex: 0 0 240px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  height: fit-content;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: none;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 4px;
}

.nav-tab:hover {
  background: #e9ecef;
  color: #333;
}

.nav-tab.active {
  background: #007bff;
  color: white;
}

.nav-tab svg {
  width: 18px;
  height: 18px;
}

.settings-panel {
  flex: 1;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 32px;
}

.panel-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 24px 0;
}

.settings-form {
  max-width: 600px;
}

.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.form-input,
.form-select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s ease;
  background-color: white;
}

.form-display {
  padding: 12px 16px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  font-size: 14px;
  background-color: #f8f9fa;
  color: #495057;
  min-height: 20px;
}

.form-select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 40px;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.checkbox-group {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin: 0;
}

.form-checkbox {
  width: 16px;
  height: 16px;
  margin: 0;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 32px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 12px;
}

.integration-section {
  margin-bottom: 48px;
  padding-bottom: 32px;
  border-bottom: 1px solid #e9ecef;
}

.integration-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.integration-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.integration-header h3 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-connected {
  background: #d4edda;
  color: #155724;
}

.status-disconnected {
  background: #f8d7da;
  color: #721c24;
}

.status-error {
  background: #fff3cd;
  color: #856404;
}

.management-section {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e9ecef;
}

.management-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.management-section h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 16px 0;
}

.management-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.backup-list {
  margin-top: 16px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  overflow: hidden;
}

.backup-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
}

.backup-item:last-child {
  border-bottom: none;
}

.backup-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.backup-name {
  font-weight: 500;
  color: #333;
}

.backup-date,
.backup-size {
  font-size: 12px;
  color: #666;
}

.message {
  position: fixed;
  top: 24px;
  right: 24px;
  padding: 16px 24px;
  border-radius: 6px;
  font-weight: 500;
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

/* 移除了開發測試按鈕相關樣式 */

.btn-info {
  background-color: #17a2b8;
  border-color: #17a2b8;
  color: white;
}

.btn-warning {
  background-color: #ffc107;
  border-color: #ffc107;
  color: #212529;
}

.btn-success {
  background-color: #28a745;
  border-color: #28a745;
  color: white;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .system-settings {
    padding: 16px;
  }

  .settings-content {
    flex-direction: column;
  }

  .settings-nav {
    flex: none;
    display: flex;
    overflow-x: auto;
    padding: 12px;
  }

  .nav-tab {
    flex: 0 0 auto;
    margin-right: 8px;
    margin-bottom: 0;
  }

  .settings-panel {
    padding: 24px 16px;
  }

  .form-actions {
    flex-direction: column;
  }

  .management-actions {
    flex-direction: column;
  }

  .backup-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

@media (max-width: 640px) {
  .system-settings {
    padding: 12px;
  }

  .settings-panel {
    padding: 20px 12px;
  }

  .nav-tab {
    min-height: 44px;
    padding: 12px 16px;
    font-size: 14px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    font-size: 14px;
  }

  .form-input,
  .form-textarea,
  .form-select {
    padding: 12px;
    font-size: 14px;
  }

  .btn {
    padding: 12px 16px;
    font-size: 14px;
    min-height: 44px;
  }

  .management-actions {
    gap: 12px;
  }

  .backup-actions {
    flex-direction: column;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .system-settings {
    padding: 8px;
  }

  .settings-panel {
    padding: 16px 8px;
  }

  .settings-nav {
    padding: 8px;
  }

  .nav-tab {
    margin-right: 4px;
    padding: 10px 12px;
    font-size: 13px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-input,
  .form-textarea,
  .form-select {
    padding: 10px;
    font-size: 13px;
  }

  .btn {
    padding: 10px 14px;
    font-size: 13px;
  }

  .backup-item {
    padding: 12px;
  }

  .backup-info h4 {
    font-size: 14px;
  }

  .backup-info p {
    font-size: 12px;
  }
}

@media (max-width: 320px) {
  .system-settings {
    padding: 4px;
  }

  .settings-panel {
    padding: 12px 4px;
  }

  .settings-nav {
    padding: 4px;
  }

  .nav-tab {
    margin-right: 2px;
    padding: 8px 10px;
    font-size: 12px;
    min-height: 44px;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .form-input,
  .form-textarea,
  .form-select {
    padding: 8px;
    font-size: 12px;
    min-height: 44px;
  }

  .btn {
    padding: 8px 12px;
    font-size: 12px;
    min-height: 44px;
    min-width: 44px;
  }

  .backup-item {
    padding: 8px;
  }

  .backup-info h4 {
    font-size: 13px;
  }

  .backup-info p {
    font-size: 11px;
  }
}

/* Reduced Motion Preference */
@media (prefers-reduced-motion: reduce) {
  .nav-tab,
  .btn,
  .form-input,
  .form-textarea,
  .form-select,
  .backup-item {
    transition: none;
  }

  .slide-in {
    animation: none;
  }

  @keyframes slide-in {
    from, to {
      transform: translateX(0);
      opacity: 1;
    }
  }
}

/* 已移除所有測試按鈕樣式 */
</style>