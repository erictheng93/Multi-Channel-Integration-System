<template>
  <Modal
    :show="show"
    :title="isEditMode ? '編輯頻道配置' : '新增頻道配置'"
    size="lg"
    @close="handleClose"
    @update:show="$emit('update:show', $event)"
  >
    <!-- Dialog Body -->
    <div class="channel-config-dialog">
      <!-- Step Indicator -->
      <div class="step-indicator">
        <div
          v-for="step in steps"
          :key="step.id"
          class="step"
          :class="{
            active: currentStep === step.id,
            completed: currentStep > step.id
          }"
        >
          <div class="step-number">
            {{ step.id }}
          </div>
          <div class="step-label">
            {{ step.label }}
          </div>
        </div>
      </div>

      <!-- Step 1: Select Platform -->
      <div
        v-if="currentStep === 1"
        class="step-content"
      >
        <h4 class="step-title">
          選擇通訊平台
        </h4>
        <p class="step-description">
          請選擇要整合的通訊平台
        </p>

        <div class="platform-selector">
          <div
            v-for="platform in platforms"
            :key="platform.value"
            class="platform-card"
            :class="{ selected: formData.platform === platform.value }"
            @click="selectPlatform(platform.value)"
          >
            <div class="platform-icon">
              {{ platform.icon }}
            </div>
            <div class="platform-name">
              {{ platform.name }}
            </div>
            <div class="platform-description">
              {{ platform.description }}
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Configure Channel -->
      <div
        v-if="currentStep === 2"
        class="step-content"
      >
        <h4 class="step-title">
          配置頻道
        </h4>
        <p class="step-description">
          請輸入 {{ selectedPlatformName }} 頻道的配置資訊
        </p>

        <!-- LINE Configuration -->
        <div
          v-if="formData.platform === 'line'"
          class="config-form"
        >
          <div class="form-group">
            <label for="lineChannelId">Channel ID <span class="required">*</span></label>
            <input
              id="lineChannelId"
              v-model="lineConfig.channelId"
              type="text"
              class="form-input"
              placeholder="1234567890"
              :disabled="isVerifying"
            >
            <span class="form-hint">LINE 頻道的 Channel ID</span>
          </div>

          <div class="form-group">
            <label for="lineAccessToken">Channel Access Token <span class="required">*</span></label>
            <textarea
              id="lineAccessToken"
              v-model="lineConfig.channelAccessToken"
              class="form-input"
              rows="3"
              placeholder="輸入 Channel Access Token"
              :disabled="isVerifying"
            />
            <span class="form-hint">長期有效的 Channel Access Token</span>
          </div>

          <div class="form-group">
            <label for="lineSecret">Channel Secret <span class="required">*</span></label>
            <input
              id="lineSecret"
              v-model="lineConfig.channelSecret"
              type="password"
              class="form-input"
              placeholder="輸入 Channel Secret"
              :disabled="isVerifying"
            >
            <span class="form-hint">用於驗證 webhook 簽名的密鑰</span>
          </div>

          <div class="form-group">
            <label>說明（選填）</label>
            <input
              v-model="formData.description"
              type="text"
              class="form-input"
              placeholder="例如：客服專用頻道"
            >
          </div>
        </div>

        <!-- Facebook Configuration -->
        <div
          v-if="formData.platform === 'facebook'"
          class="config-form"
        >
          <div class="form-group">
            <label for="fbPageId">Page ID <span class="required">*</span></label>
            <input
              id="fbPageId"
              v-model="facebookConfig.pageId"
              type="text"
              class="form-input"
              placeholder="123456789012345"
              :disabled="isVerifying"
            >
          </div>

          <div class="form-group">
            <label for="fbAccessToken">Page Access Token <span class="required">*</span></label>
            <textarea
              id="fbAccessToken"
              v-model="facebookConfig.accessToken"
              class="form-input"
              rows="3"
              placeholder="輸入 Page Access Token"
              :disabled="isVerifying"
            />
          </div>

          <div class="form-group">
            <label for="fbAppSecret">App Secret <span class="required">*</span></label>
            <input
              id="fbAppSecret"
              v-model="facebookConfig.appSecret"
              type="password"
              class="form-input"
              placeholder="輸入 App Secret"
              :disabled="isVerifying"
            >
          </div>
        </div>

        <!-- WhatsApp Configuration -->
        <div
          v-if="formData.platform === 'whatsapp'"
          class="config-form"
        >
          <div class="form-group">
            <label for="waPhoneNumber">Phone Number <span class="required">*</span></label>
            <input
              id="waPhoneNumber"
              v-model="whatsappConfig.phoneNumber"
              type="text"
              class="form-input"
              placeholder="+886912345678"
              :disabled="isVerifying"
            >
          </div>

          <div class="form-group">
            <label for="waBusinessAccountId">Business Account ID <span class="required">*</span></label>
            <input
              id="waBusinessAccountId"
              v-model="whatsappConfig.businessAccountId"
              type="text"
              class="form-input"
              placeholder="輸入 Business Account ID"
              :disabled="isVerifying"
            >
          </div>

          <div class="form-group">
            <label for="waAccessToken">Access Token <span class="required">*</span></label>
            <textarea
              id="waAccessToken"
              v-model="whatsappConfig.accessToken"
              class="form-input"
              rows="3"
              placeholder="輸入 Access Token"
              :disabled="isVerifying"
            />
          </div>
        </div>
      </div>

      <!-- Step 3: Verify & Complete -->
      <div
        v-if="currentStep === 3"
        class="step-content"
      >
        <h4 class="step-title">
          驗證配置
        </h4>
        <p class="step-description">
          驗證頻道配置是否正確
        </p>

        <!-- Verification Status -->
        <div
          v-if="verificationStatus"
          class="verification-status"
          :class="verificationStatus.type"
        >
          <div class="status-icon">
            <span v-if="verificationStatus.type === 'success'" />
            <span v-else-if="verificationStatus.type === 'error'" />
            <span v-else />
          </div>
          <div class="status-content">
            <div class="status-message">
              {{ verificationStatus.message }}
            </div>
            <div
              v-if="verificationStatus.details"
              class="status-details"
            >
              {{ verificationStatus.details }}
            </div>
          </div>
        </div>

        <!-- Webhook URL (shown after channel creation) -->
        <div
          v-if="webhookUrl"
          class="webhook-url-section"
        >
          <h5>Webhook URL</h5>
          <div class="webhook-url-box">
            <input
              :value="webhookUrl"
              type="text"
              class="webhook-url-input"
              readonly
              @click="selectWebhookUrl"
            >
            <button
              class="copy-button"
              :class="{ copied: isCopied }"
              @click="copyWebhookUrl"
            >
              {{ isCopied ? '已複製' : '複製' }}
            </button>
          </div>
          <p class="webhook-hint">
            請將此 URL 設定到 {{ selectedPlatformName }} 的 Webhook 設定中
          </p>
        </div>

        <!-- Configuration Summary -->
        <div class="config-summary">
          <h5>配置摘要</h5>
          <div class="summary-item">
            <span class="summary-label">平台：</span>
            <span class="summary-value">{{ selectedPlatformName }}</span>
          </div>
          <div
            v-if="formData.platform === 'line'"
            class="summary-item"
          >
            <span class="summary-label">Channel ID：</span>
            <span class="summary-value">{{ lineConfig.channelId }}</span>
          </div>
          <div
            v-if="formData.description"
            class="summary-item"
          >
            <span class="summary-label">說明：</span>
            <span class="summary-value">{{ formData.description }}</span>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div
        v-if="errorMessage"
        class="error-message"
      >
        <span class="error-icon" />
        {{ errorMessage }}
      </div>
    </div>

    <!-- Dialog Footer -->
    <template #footer>
      <button
        v-if="currentStep > 1"
        class="btn btn-secondary"
        :disabled="isSubmitting || isVerifying"
        @click="previousStep"
      >
        上一步
      </button>

      <button
        v-if="currentStep < 3"
        class="btn btn-primary"
        :disabled="!canProceed || isVerifying"
        @click="nextStep"
      >
        下一步
      </button>

      <button
        v-if="currentStep === 3"
        class="btn btn-primary"
        :disabled="isSubmitting || isVerifying"
        @click="handleSubmit"
      >
        <span v-if="isSubmitting">處理中...</span>
        <span v-else>{{ isEditMode ? '更新' : '建立' }}頻道</span>
      </button>

      <button
        class="btn btn-secondary"
        :disabled="isSubmitting || isVerifying"
        @click="handleClose"
      >
        取消
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import { channelsApi } from '@/api/channels'
import type { ChannelPlatform, CreateChannelRequest, ChannelIntegration } from '@/api/channels'

interface Props {
  show: boolean
  channel?: ChannelIntegration
}

interface Emits {
  (_e: 'update:show', _value: boolean): void
  (_e: 'close'): void
  (_e: 'success', _channel: ChannelIntegration): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// State
const currentStep = ref(1)
const isSubmitting = ref(false)
const isVerifying = ref(false)
const errorMessage = ref('')
const verificationStatus = ref<{ type: 'success' | 'error' | 'warning', message: string, details?: string } | null>(null)
const webhookUrl = ref('')
const isCopied = ref(false)
const createdChannel = ref<ChannelIntegration | null>(null)

// Form Data
const formData = ref<{
  platform: ChannelPlatform | null
  description: string
}>({
  platform: null,
  description: ''
})

const lineConfig = ref({
  channelId: '',
  channelAccessToken: '',
  channelSecret: ''
})

const facebookConfig = ref({
  pageId: '',
  accessToken: '',
  appSecret: ''
})

const whatsappConfig = ref({
  phoneNumber: '',
  businessAccountId: '',
  accessToken: ''
})

// Steps
const steps = [
  { id: 1, label: '選擇平台' },
  { id: 2, label: '配置頻道' },
  { id: 3, label: '驗證完成' }
]

// Platform Options
const platforms = [
  {
    value: 'line' as ChannelPlatform,
    name: 'LINE',
    icon: '',
    description: 'LINE Official Account'
  },
  {
    value: 'facebook' as ChannelPlatform,
    name: 'Facebook',
    icon: '',
    description: 'Facebook Messenger'
  },
  {
    value: 'whatsapp' as ChannelPlatform,
    name: 'WhatsApp',
    icon: '',
    description: 'WhatsApp Business'
  }
]

// Computed
const isEditMode = computed(() => !!props.channel)

const selectedPlatformName = computed(() => {
  return platforms.find(p => p.value === formData.value.platform)?.name || ''
})

const canProceed = computed(() => {
  if (currentStep.value === 1) {
    return formData.value.platform !== null
  }

  if (currentStep.value === 2) {
    if (formData.value.platform === 'line') {
      return lineConfig.value.channelId &&
             (isEditMode.value || (lineConfig.value.channelAccessToken && lineConfig.value.channelSecret))
    }
    if (formData.value.platform === 'facebook') {
      return facebookConfig.value.pageId &&
             (isEditMode.value || (facebookConfig.value.accessToken && facebookConfig.value.appSecret))
    }
    if (formData.value.platform === 'whatsapp') {
      return whatsappConfig.value.phoneNumber &&
             whatsappConfig.value.businessAccountId &&
             (isEditMode.value || whatsappConfig.value.accessToken)
    }
  }

  return true
})

// Methods
const selectPlatform = (platform: ChannelPlatform) => {
  formData.value.platform = platform
}

const nextStep = () => {
  if (currentStep.value < 3) {
    currentStep.value++
    errorMessage.value = ''
  }
}

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
    errorMessage.value = ''
  }
}

const selectWebhookUrl = (event: Event) => {
  const input = event.target as HTMLInputElement
  input.select()
}

const copyWebhookUrl = async () => {
  try {
    await navigator.clipboard.writeText(webhookUrl.value)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy webhook URL:', error)
  }
}

const handleSubmit = async () => {
  if (!formData.value.platform) {return}

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const request: CreateChannelRequest = {
      platform: formData.value.platform,
      configMetadata: {
        ...(isEditMode.value ? props.channel?.configMetadata : {}),
        description: formData.value.description,
        [isEditMode.value ? 'updatedAt' : 'createdAt']: new Date().toISOString()
      }
    }

    if (formData.value.platform === 'line') {
      request.lineConfig = {
        channelId: lineConfig.value.channelId,
        channelAccessToken: lineConfig.value.channelAccessToken,
        channelSecret: lineConfig.value.channelSecret
      }
    } else if (formData.value.platform === 'facebook') {
      request.facebookConfig = {
        pageId: facebookConfig.value.pageId,
        accessToken: facebookConfig.value.accessToken,
        appSecret: facebookConfig.value.appSecret
      }
    } else if (formData.value.platform === 'whatsapp') {
      request.whatsappConfig = {
        phoneNumber: whatsappConfig.value.phoneNumber,
        businessAccountId: whatsappConfig.value.businessAccountId,
        accessToken: whatsappConfig.value.accessToken
      }
    }

    const response = isEditMode.value && props.channel
      ? await channelsApi.update(props.channel.id, {
          lineConfig: request.lineConfig,
          facebookConfig: request.facebookConfig,
          whatsappConfig: request.whatsappConfig,
          configMetadata: request.configMetadata
        })
      : await channelsApi.create(request)

    if (response.success && response.data) {
      createdChannel.value = response.data
      webhookUrl.value = 'webhookUrl' in response
        ? response.webhookUrl
        : parseChannelJson(response.data.webhookConfig).url || ''

      verificationStatus.value = {
        type: 'success',
        message: isEditMode.value ? '頻道更新成功！' : '頻道建立成功！',
        details: '請將 Webhook URL 設定到通訊平台中以接收訊息'
      }

      // Auto-verify after 2 seconds
      setTimeout(() => {
        verifyChannel()
      }, 2000)

      emit('success', response.data)
    } else {
      throw new Error(isEditMode.value ? '頻道更新失敗' : '頻道建立失敗')
    }
  } catch (error: unknown) {
    console.error('Failed to create channel:', error)
    const errorMsg = error instanceof Error ? error.message : '建立頻道時發生錯誤'
    errorMessage.value = errorMsg
    verificationStatus.value = {
      type: 'error',
      message: '建立失敗',
      details: errorMsg
    }
  } finally {
    isSubmitting.value = false
  }
}

const verifyChannel = async () => {
  if (!createdChannel.value) {return}

  isVerifying.value = true

  try {
    const response = await channelsApi.verify(createdChannel.value.id)

    if (response.verified) {
      verificationStatus.value = {
        type: 'success',
        message: '頻道驗證成功！',
        details: '您的頻道已成功連接並可以開始接收訊息'
      }
    } else {
      verificationStatus.value = {
        type: 'warning',
        message: '頻道驗證失敗',
        details: response.message || '請檢查 API 憑證是否正確'
      }
    }
  } catch (error: unknown) {
    verificationStatus.value = {
      type: 'error',
      message: '驗證時發生錯誤',
      details: error instanceof Error ? error.message : '未知錯誤'
    }
  } finally {
    isVerifying.value = false
  }
}

const handleClose = () => {
  emit('close')
  emit('update:show', false)
}

const resetForm = () => {
  currentStep.value = 1
  formData.value = { platform: null, description: '' }
  lineConfig.value = { channelId: '', channelAccessToken: '', channelSecret: '' }
  facebookConfig.value = { pageId: '', accessToken: '', appSecret: '' }
  whatsappConfig.value = { phoneNumber: '', businessAccountId: '', accessToken: '' }
  errorMessage.value = ''
  verificationStatus.value = null
  webhookUrl.value = ''
  createdChannel.value = null
  isCopied.value = false
}

const parseChannelJson = (value?: string | null): Record<string, string> => {
  if (!value) { return {} }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )
  } catch {
    return {}
  }
}

const loadChannelForEdit = (channel: ChannelIntegration) => {
  resetForm()
  currentStep.value = 2
  formData.value.platform = channel.platform
  formData.value.description = typeof channel.configMetadata?.description === 'string'
    ? channel.configMetadata.description
    : ''
  createdChannel.value = channel

  const config = parseChannelJson(channel.config)
  const webhookConfig = parseChannelJson(channel.webhookConfig)
  webhookUrl.value = webhookConfig.url || ''

  if (channel.platform === 'line') {
    lineConfig.value.channelId = config.channelId || ''
  } else if (channel.platform === 'facebook') {
    facebookConfig.value.pageId = config.pageId || ''
  } else if (channel.platform === 'whatsapp') {
    whatsappConfig.value.phoneNumber = config.phoneNumber || ''
    whatsappConfig.value.businessAccountId = config.businessAccountId || ''
  }
}

// Watch for dialog visibility changes
watch(() => props.show, (newValue) => {
  if (!newValue) {
    // Reset form when dialog closes
    setTimeout(resetForm, 300) // Delay to allow closing animation
  } else if (props.channel) {
    loadChannelForEdit(props.channel)
  } else {
    resetForm()
  }
})
</script>

<style scoped>
.channel-config-dialog {
  min-height: 400px;
}

/* Step Indicator */
.step-indicator {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
  position: relative;
}

.step-indicator::before {
  content: '';
  position: absolute;
  top: 20px;
  left: 10%;
  right: 10%;
  height: 2px;
  background: var(--gray-200);
  z-index: 0;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  z-index: 1;
  flex: 1;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--gray-200);
  color: var(--gray-600);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  transition: all 0.3s;
}

.step.active .step-number {
  background: var(--primary-500);
  color: white;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
}

.step.completed .step-number {
  background: var(--green-500);
  color: white;
}

.step-label {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}

.step.active .step-label {
  color: var(--primary-600);
  font-weight: 600;
}

/* Step Content */
.step-content {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 0.5rem;
}

.step-description {
  color: var(--gray-600);
  margin-bottom: 1.5rem;
}

/* Platform Selector */
.platform-selector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.platform-card {
  border: 2px solid var(--gray-200);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.platform-card:hover {
  border-color: var(--primary-300);
  background: var(--primary-50);
  transform: translateY(-2px);
}

.platform-card.selected {
  border-color: var(--primary-500);
  background: var(--primary-50);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.platform-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.platform-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 0.25rem;
}

.platform-description {
  font-size: 0.875rem;
  color: var(--gray-600);
}

/* Config Form */
.config-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: var(--gray-700);
  font-size: 0.875rem;
}

.required {
  color: var(--red-500);
}

.form-input {
  padding: 0.75rem;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input:disabled {
  background: var(--gray-100);
  cursor: not-allowed;
}

.form-hint {
  font-size: 0.75rem;
  color: var(--gray-500);
}

/* Verification Status */
.verification-status {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
}

.verification-status.success {
  background: var(--green-50);
  border: 1px solid var(--green-200);
}

.verification-status.error {
  background: var(--red-50);
  border: 1px solid var(--red-200);
}

.verification-status.warning {
  background: var(--yellow-50);
  border: 1px solid var(--yellow-200);
}

.status-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.status-content {
  flex: 1;
}

.status-message {
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 0.25rem;
}

.status-details {
  font-size: 0.875rem;
  color: var(--gray-600);
}

/* Webhook URL Section */
.webhook-url-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--gray-50);
  border-radius: var(--radius-md);
}

.webhook-url-section h5 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-700);
  margin-bottom: 0.75rem;
}

.webhook-url-box {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.webhook-url-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-family: monospace;
  background: white;
}

.copy-button {
  padding: 0.5rem 1rem;
  background: var(--primary-500);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.copy-button:hover {
  background: var(--primary-600);
}

.copy-button.copied {
  background: var(--green-500);
}

.webhook-hint {
  font-size: 0.75rem;
  color: var(--gray-600);
  margin: 0;
}

/* Config Summary */
.config-summary {
  padding: 1rem;
  background: var(--gray-50);
  border-radius: var(--radius-md);
}

.config-summary h5 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-700);
  margin-bottom: 0.75rem;
}

.summary-item {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--gray-200);
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-label {
  font-weight: 500;
  color: var(--gray-600);
  min-width: 120px;
}

.summary-value {
  color: var(--gray-900);
  word-break: break-all;
}

/* Error Message */
.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--red-50);
  border: 1px solid var(--red-200);
  border-radius: var(--radius-md);
  color: var(--red-700);
  font-size: 0.875rem;
  margin-top: 1rem;
}

.error-icon {
  font-size: 1.25rem;
}

</style>
