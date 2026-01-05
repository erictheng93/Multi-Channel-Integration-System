<template>
  <div class="config-form-page">
    <div class="container container-md">
      <div class="config-card">
        <div class="config-header">
          <h1>Configure Your CRM Deployment</h1>
          <p>Customize your installation settings</p>
        </div>

        <form @submit.prevent="handleSubmit" class="config-form">
          <!-- Account Info (Read-only) -->
          <div class="account-info">
            <div class="account-info-item">
              <span class="account-label">Cloudflare Account:</span>
              <span class="account-value">{{ accountName || accountId }}</span>
            </div>
            <div class="account-info-item">
              <span class="account-label">Email:</span>
              <span class="account-value">{{ userEmail }}</span>
            </div>
          </div>

          <!-- Step Indicator -->
          <div class="step-indicator">
            <div
              v-for="(step, index) in steps"
              :key="step.id"
              class="step-item"
              :class="{ active: currentStep === index, completed: currentStep > index }"
            >
              <div class="step-number">{{ currentStep > index ? '✓' : index + 1 }}</div>
              <div class="step-label">{{ step.label }}</div>
            </div>
          </div>

          <!-- Step 1: Basic Configuration -->
          <div v-show="currentStep === 0" class="form-step">
            <h2>📋 Basic Configuration</h2>

            <!-- Phase 2: Quick Reference -->
            <div class="quick-reference">
              <button type="button" @click="toggleQuickReference(0)" class="quick-reference-toggle">
                <span class="ref-icon">📖</span>
                <span>Quick Reference: What You'll Need</span>
                <span class="ref-arrow">{{ showQuickReference[0] ? '▼' : '▶' }}</span>
              </button>
              <div v-show="showQuickReference[0]" class="quick-reference-content">
                <h4>Step 1: Basic Configuration</h4>
                <ul class="reference-list">
                  <li>
                    <strong>Project Name:</strong> Choose a unique name using lowercase letters, numbers, and hyphens (e.g., my-crm-system)
                  </li>
                  <li>
                    <strong>Admin Email:</strong> Your email for receiving deployment credentials and notifications
                  </li>
                  <li>
                    <strong>Custom Domain (Optional):</strong> Only if you have a domain configured in Cloudflare DNS
                  </li>
                  <li>
                    <strong>R2 Public URL (Optional):</strong> Custom domain for file storage access (recommended for branding)
                  </li>
                </ul>
                <div class="reference-tip">
                  💡 <strong>Tip:</strong> If you enter a custom domain, we'll automatically suggest URLs for frontend, backend, and R2!
                </div>
              </div>
            </div>

            <!-- Project Name -->
            <div class="form-group">
              <label for="projectName" class="form-label">
                Project Name
                <span class="badge badge-required">Required</span>
                <span class="form-hint">Lowercase letters, numbers, and hyphens only</span>
              </label>
              <input
                id="projectName"
                v-model="formData.projectName"
                type="text"
                class="form-input"
                :class="{
                  error: errors.projectName,
                  'is-valid': formData.projectName && formData.projectName.length >= 3 && /^[a-z0-9-]+$/.test(formData.projectName)
                }"
                placeholder="my-crm-system"
                required
                pattern="[a-z0-9-]+"
                maxlength="50"
                @input="clearError('projectName')"
              />
              <div v-if="errors.projectName" class="form-error">
                {{ errors.projectName }}
              </div>
              <!-- Phase 2: Character Counter -->
              <div v-if="formData.projectName" class="char-counter" :class="{
                warning: formData.projectName.length > 40,
                danger: formData.projectName.length > 47
              }">
                {{ formData.projectName.length }} / 50 characters
              </div>
              <div class="form-hint">
                This will be used for resource naming (e.g., my-crm-worker, my-crm-db)
              </div>
            </div>

            <!-- Admin Email -->
            <div class="form-group">
              <label for="adminEmail" class="form-label">
                Admin Email
                <span class="badge badge-required">Required</span>
                <span class="form-hint">For receiving credentials and notifications</span>
              </label>
              <input
                id="adminEmail"
                v-model="formData.adminEmail"
                type="email"
                class="form-input"
                :class="{
                  error: errors.adminEmail,
                  'is-valid': formData.adminEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)
                }"
                placeholder="admin@example.com"
                required
                @input="clearError('adminEmail')"
              />
              <div v-if="errors.adminEmail" class="form-error">
                {{ errors.adminEmail }}
              </div>
            </div>

            <!-- Custom Domain (Optional) -->
            <div class="form-group">
              <label for="customDomain" class="form-label">
                Custom Domain
                <span class="badge badge-optional">Optional</span>
                <span class="form-hint">Leave empty to use default .workers.dev domain</span>
              </label>
              <input
                id="customDomain"
                v-model="formData.customDomain"
                type="text"
                class="form-input"
                :class="{
                  error: errors.customDomain,
                  'is-valid': formData.customDomain && !formData.customDomain.includes('://') && /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(formData.customDomain)
                }"
                placeholder="crm.example.com"
                @input="clearError('customDomain')"
              />
              <div v-if="errors.customDomain" class="form-error">
                {{ errors.customDomain }}
              </div>
              <div class="form-hint">
                Make sure this domain is added to your Cloudflare account
              </div>
            </div>

            <!-- 🆕 Phase 1: R2 Custom Domain -->
            <div class="form-group">
              <label for="r2PublicUrl" class="form-label">
                R2 Public URL
                <span class="badge badge-optional">Optional</span>
                <span class="form-hint">Custom domain for file access</span>
              </label>
              <input
                id="r2PublicUrl"
                v-model="formData.r2PublicUrl"
                type="text"
                class="form-input"
                :class="{
                  error: errors.r2PublicUrl,
                  'is-valid': formData.r2PublicUrl && /^https?:\/\/.+/i.test(formData.r2PublicUrl)
                }"
                placeholder="https://files.yourdomain.com"
                @input="clearError('r2PublicUrl')"
              />
              <div v-if="errors.r2PublicUrl" class="form-error">
                {{ errors.r2PublicUrl }}
              </div>
              <!-- Phase 2: Smart Suggestion -->
              <div v-if="suggestedR2Url" class="suggestion-box">
                <div class="suggestion-content">
                  <span class="suggestion-icon">💡</span>
                  <span class="suggestion-text">Suggested: <strong>{{ suggestedR2Url }}</strong></span>
                </div>
                <div class="suggestion-actions">
                  <button type="button" @click="applySuggestion('r2PublicUrl')" class="btn-suggestion-apply">
                    Use Suggestion
                  </button>
                  <button type="button" @click="dismissSuggestion('r2PublicUrl')" class="btn-suggestion-dismiss">
                    ✕
                  </button>
                </div>
              </div>
              <div class="form-hint">
                💡 Leave empty to use Cloudflare's default R2 public URL. Recommended to set up for better branding.
              </div>
            </div>

            <!-- Phase 2: Resource Naming Preview -->
            <div v-if="formData.projectName" class="resource-preview">
              <button type="button" @click="showResourcePreview = !showResourcePreview" class="resource-preview-toggle">
                <span class="preview-icon">📦</span>
                <span>Preview Resource Names</span>
                <span class="preview-arrow">{{ showResourcePreview ? '▼' : '▶' }}</span>
              </button>
              <div v-show="showResourcePreview" class="resource-preview-content">
                <h4>Resources that will be created:</h4>
                <ul class="resource-list">
                  <li><span class="resource-label">Worker:</span> <code>{{ resourceNames.worker }}</code></li>
                  <li><span class="resource-label">Database:</span> <code>{{ resourceNames.database }}</code></li>
                  <li><span class="resource-label">KV Session:</span> <code>{{ resourceNames.kvSession }}</code></li>
                  <li><span class="resource-label">KV Cache:</span> <code>{{ resourceNames.kvCache }}</code></li>
                  <li><span class="resource-label">R2 Bucket:</span> <code>{{ resourceNames.r2Bucket }}</code></li>
                  <li><span class="resource-label">Queue:</span> <code>{{ resourceNames.queue }}</code></li>
                  <li><span class="resource-label">Pages Project:</span> <code>{{ resourceNames.pages }}</code></li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Step 2: LINE OA Configuration -->
          <div v-show="currentStep === 1" class="form-step">
            <h2>📱 LINE OA Configuration</h2>

            <div class="integration-note">
              <div class="note-icon">ℹ️</div>
              <div class="note-content">
                <strong>How to get LINE credentials:</strong>
                <ol>
                  <li>Go to <a href="https://developers.line.biz/console/" target="_blank">LINE Developers Console</a></li>
                  <li>Create or select a Messaging API channel</li>
                  <li>Copy the Channel Access Token, Channel Secret, and Bot ID</li>
                  <li>(Optional) Create a LIFF app for team binding feature</li>
                </ol>
              </div>
            </div>

            <!-- 🆕 Phase 1: LINE Bot ID -->
            <div class="form-group">
              <label for="lineBotId" class="form-label">
                LINE Bot ID (Basic ID)
                <span v-if="!skipLineConfig" class="badge badge-required">Required</span>
                <span v-else class="badge badge-optional">Optional</span>
                <span class="form-hint">Format: @xxxxxxxxx</span>
              </label>
              <input
                id="lineBotId"
                v-model="formData.lineBotId"
                type="text"
                class="form-input"
                :class="{
                  error: errors.lineBotId,
                  'is-valid': formData.lineBotId && /^@[a-z0-9]+$/.test(formData.lineBotId)
                }"
                placeholder="@110xsqef"
                pattern="^@[a-z0-9]+$"
                :required="formData.enableLineIntegration && !skipLineConfig"
                @input="clearError('lineBotId')"
              />
              <div v-if="errors.lineBotId" class="form-error">
                {{ errors.lineBotId }}
              </div>
              <div class="form-hint">
                📌 Required for QR Code generation. Find it in <strong>Channel Settings → Basic settings</strong>
              </div>

              <!-- Phase 2: Inline Help -->
              <div class="help-section">
                <button type="button" @click="toggleHelp('lineBotId')" class="help-toggle">
                  <span class="help-icon">ℹ️</span>
                  <span>How to find LINE Bot ID?</span>
                  <span class="help-arrow">{{ showHelp.lineBotId ? '▼' : '▶' }}</span>
                </button>
                <div v-show="showHelp.lineBotId" class="help-content">
                  <h4>Finding Your LINE Bot ID (Basic ID)</h4>
                  <ol class="help-steps">
                    <li>Go to <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer">LINE Developers Console</a></li>
                    <li>Select your <strong>Provider</strong> (or create one if needed)</li>
                    <li>Select your <strong>Messaging API Channel</strong></li>
                    <li>Navigate to <strong>Channel Settings</strong> → <strong>Basic settings</strong> tab</li>
                    <li>Look for <strong>Basic ID</strong> section</li>
                    <li>Copy the ID that starts with <code>@</code></li>
                  </ol>
                  <div class="help-example">
                    <strong>Example:</strong> <code>@110xsqef</code>
                  </div>
                  <div class="help-note">
                    📝 <strong>Note:</strong> The Basic ID is different from the Channel ID (numeric). Make sure to copy the one that starts with @.
                  </div>
                </div>
              </div>
            </div>

            <!-- 🆕 Phase 1: LINE LIFF ID -->
            <div class="form-group">
              <label for="lineLiffId" class="form-label">
                LINE LIFF ID
                <span class="badge badge-optional">Optional</span>
                <span class="form-hint">Required for team binding feature</span>
              </label>
              <input
                id="lineLiffId"
                v-model="formData.lineLiffId"
                type="text"
                class="form-input"
                :class="{
                  error: errors.lineLiffId,
                  'is-valid': formData.lineLiffId && formData.lineLiffId.length >= 10
                }"
                placeholder="2008756115-vWtFyDMA"
                @input="clearError('lineLiffId')"
              />
              <div v-if="errors.lineLiffId" class="form-error">
                {{ errors.lineLiffId }}
              </div>
              <!-- Phase 2: Character Counter -->
              <div v-if="formData.lineLiffId" class="char-counter" :class="{
                danger: formData.lineLiffId.length < 10
              }">
                {{ formData.lineLiffId.length }} characters (min 10)
              </div>
              <div class="form-hint">
                💡 Create a LIFF app in <strong>LINE Developers Console → LIFF tab</strong>
              </div>

              <!-- Phase 2: Inline Help -->
              <div class="help-section">
                <button type="button" @click="toggleHelp('lineLiffId')" class="help-toggle">
                  <span class="help-icon">ℹ️</span>
                  <span>How to create and find LINE LIFF ID?</span>
                  <span class="help-arrow">{{ showHelp.lineLiffId ? '▼' : '▶' }}</span>
                </button>
                <div v-show="showHelp.lineLiffId" class="help-content">
                  <h4>Creating and Finding Your LINE LIFF ID</h4>
                  <ol class="help-steps">
                    <li>Go to <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer">LINE Developers Console</a></li>
                    <li>Select your Messaging API Channel</li>
                    <li>Click on the <strong>LIFF</strong> tab in the top navigation</li>
                    <li>Click <strong>Add</strong> button to create a new LIFF app</li>
                    <li>Configure LIFF app settings:
                      <ul>
                        <li><strong>Size:</strong> Choose "Full" for best experience</li>
                        <li><strong>Endpoint URL:</strong> Enter your frontend URL (will be provided after deployment)</li>
                        <li><strong>Scope:</strong> Select "profile" and "openid"</li>
                      </ul>
                    </li>
                    <li>After creation, copy the <strong>LIFF ID</strong> (format: xxxxxxxxxx-xxxxxxxx)</li>
                  </ol>
                  <div class="help-example">
                    <strong>Example:</strong> <code>2008756115-vWtFyDMA</code>
                  </div>
                  <div class="help-note">
                    📝 <strong>Note:</strong> You can create the LIFF app later and update the configuration. It's only needed for the team member binding feature.
                  </div>
                  <div class="help-link">
                    📚 <a href="https://developers.line.biz/en/docs/liff/overview/" target="_blank" rel="noopener noreferrer">Learn more about LINE LIFF</a>
                  </div>
                </div>
              </div>
            </div>

            <!-- LINE Channel Access Token -->
            <div class="form-group">
              <label for="lineChannelAccessToken" class="form-label">
                Channel Access Token
                <span v-if="formData.enableLineIntegration" class="badge badge-required">Required</span>
                <span v-else class="badge badge-optional">Optional</span>
              </label>
              <div class="input-with-toggle">
                <input
                  id="lineChannelAccessToken"
                  v-model="formData.lineChannelAccessToken"
                  :type="showLineToken ? 'text' : 'password'"
                  class="form-input"
                  :class="{
                    error: errors.lineChannelAccessToken,
                    'is-valid': formData.lineChannelAccessToken && formData.lineChannelAccessToken.length > 0
                  }"
                  placeholder="Enter your LINE Channel Access Token"
                  :required="formData.enableLineIntegration"
                  @input="clearError('lineChannelAccessToken')"
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  @click="showLineToken = !showLineToken"
                >
                  {{ showLineToken ? '🙈' : '👁️' }}
                </button>
              </div>
              <div v-if="errors.lineChannelAccessToken" class="form-error">
                {{ errors.lineChannelAccessToken }}
              </div>
            </div>

            <!-- LINE Channel Secret -->
            <div class="form-group">
              <label for="lineChannelSecret" class="form-label">
                Channel Secret
                <span v-if="formData.enableLineIntegration" class="badge badge-required">Required</span>
                <span v-else class="badge badge-optional">Optional</span>
              </label>
              <div class="input-with-toggle">
                <input
                  id="lineChannelSecret"
                  v-model="formData.lineChannelSecret"
                  :type="showLineSecret ? 'text' : 'password'"
                  class="form-input"
                  :class="{
                    error: errors.lineChannelSecret,
                    'is-valid': formData.lineChannelSecret && formData.lineChannelSecret.length > 0
                  }"
                  placeholder="Enter your LINE Channel Secret"
                  :required="formData.enableLineIntegration"
                  @input="clearError('lineChannelSecret')"
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  @click="showLineSecret = !showLineSecret"
                >
                  {{ showLineSecret ? '🙈' : '👁️' }}
                </button>
              </div>
              <div v-if="errors.lineChannelSecret" class="form-error">
                {{ errors.lineChannelSecret }}
              </div>
            </div>

            <!-- Skip LINE Configuration -->
            <div class="skip-option">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  v-model="skipLineConfig"
                  @change="handleSkipLineChange"
                />
                <span>Skip LINE configuration (configure later in settings)</span>
              </label>
            </div>
          </div>

          <!-- Step 3: Review & Deploy -->
          <div v-show="currentStep === 2" class="form-step">
            <h2>🚀 Review & Deploy</h2>

            <!-- Configuration Summary -->
            <div class="config-summary">
              <h3>Configuration Summary</h3>

              <div class="summary-section">
                <h4>📋 Basic Settings</h4>
                <div class="summary-item">
                  <span class="summary-label">Project Name:</span>
                  <span class="summary-value">{{ formData.projectName }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Admin Email:</span>
                  <span class="summary-value">{{ formData.adminEmail }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Custom Domain:</span>
                  <span class="summary-value">{{ formData.customDomain || 'Not configured' }}</span>
                </div>
              </div>

              <div class="summary-section">
                <h4>📱 LINE Integration</h4>
                <div class="summary-item">
                  <span class="summary-label">Status:</span>
                  <span class="summary-value" :class="{ 'text-success': !skipLineConfig, 'text-muted': skipLineConfig }">
                    {{ skipLineConfig ? 'Will configure later' : 'Configured' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Estimated Cost -->
            <div class="cost-estimate">
              <h3>💰 Estimated Monthly Cost</h3>
              <div class="cost-breakdown">
                <div class="cost-item">
                  <span>Worker Requests (100k/day free):</span>
                  <span class="cost-value">$0 - $5</span>
                </div>
                <div class="cost-item">
                  <span>D1 Database (5GB free):</span>
                  <span class="cost-value">$0 - $5</span>
                </div>
                <div class="cost-item">
                  <span>R2 Storage (10GB free):</span>
                  <span class="cost-value">$0 - $5</span>
                </div>
                <div class="cost-item">
                  <span>KV Namespaces (100k reads/day free):</span>
                  <span class="cost-value">$0 - $3</span>
                </div>
                <div class="cost-total">
                  <span>Estimated Total:</span>
                  <span class="cost-value">$0 - $20/month</span>
                </div>
              </div>
              <p class="cost-note">
                Most small businesses stay within the free tier. You only pay for actual usage.
              </p>
            </div>

            <!-- Resources to be created -->
            <div class="resources-preview">
              <h3>📦 Resources to be Created</h3>
              <ul class="resource-list">
                <li>✅ D1 Database: <code>{{ formData.projectName }}-db</code></li>
                <li>✅ KV Namespace (Sessions): <code>{{ formData.projectName }}-sessions</code></li>
                <li>✅ KV Namespace (Cache): <code>{{ formData.projectName }}-cache</code></li>
                <li>✅ R2 Bucket: <code>{{ formData.projectName }}-files</code></li>
                <li>✅ Queue: <code>{{ formData.projectName }}-queue</code></li>
                <li>✅ Worker: <code>{{ formData.projectName }}-worker</code></li>
                <li>✅ Pages: <code>{{ formData.projectName }}-frontend</code></li>
              </ul>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button
              v-if="currentStep > 0"
              type="button"
              @click="prevStep"
              class="btn btn-secondary"
              :disabled="isSubmitting"
            >
              ← Back
            </button>
            <div v-else></div>

            <button
              v-if="currentStep < steps.length - 1"
              type="button"
              @click="nextStep"
              class="btn btn-primary"
            >
              Next →
            </button>

            <button
              v-else
              type="submit"
              class="btn btn-primary btn-lg"
              :disabled="isSubmitting"
            >
              <span v-if="!isSubmitting">🚀 Start Deployment</span>
              <span v-else class="btn-loading">
                <span class="spinner"></span>
                Starting...
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useDeploymentStore } from '@/stores/deploymentStore';
import type { FormErrors } from '@/types';

// ========================================
// COMPOSABLES
// ========================================

const router = useRouter();
const deploymentStore = useDeploymentStore();

// ========================================
// STATE
// ========================================

const steps = [
  { id: 'basic', label: 'Basic' },
  { id: 'line', label: 'LINE OA' },
  { id: 'review', label: 'Review' }
];

const currentStep = ref(0);

const formData = ref({
  // Basic Configuration
  projectName: '',
  adminEmail: '',
  customDomain: '',
  // Phase 1 Enhancement: URL Configuration
  backendUrl: '',
  frontendUrl: '',
  r2PublicUrl: '',
  // LINE OA Integration (Enhanced)
  enableLineIntegration: true,
  lineChannelAccessToken: '',
  lineChannelSecret: '',
  lineBotId: '',  // Phase 1: New field
  lineLiffId: '',  // Phase 1: New field
  // Facebook Integration
  enableFacebookIntegration: false,
  facebookPageAccessToken: '',
  facebookAppSecret: '',
  // System Configuration (Phase 1)
  logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error' | 'silent'
});

const errors = ref<FormErrors>({});
const isSubmitting = ref(false);
const skipLineConfig = ref(false);
const showLineToken = ref(false);
const showLineSecret = ref(false);
const showResourcePreview = ref(false); // Phase 2: Resource preview toggle

// Phase 2: Inline help state
const showHelp = ref<Record<string, boolean>>({
  customDomain: false,
  r2PublicUrl: false,
  lineBotId: false,
  lineLiffId: false,
  lineToken: false
});

const showQuickReference = ref<Record<number, boolean>>({
  0: false, // Step 1 quick reference
  1: false  // Step 2 quick reference
});

// Session data
const accountId = ref<string>('');
const accountName = ref<string>('');
const userEmail = ref<string>('');
const oauthToken = ref<string>('');

// ========================================
// PHASE 2: SMART DEFAULTS
// ========================================

// Track dismissed suggestions
const dismissedSuggestions = ref<Record<string, boolean>>({});

// Smart URL suggestions based on custom domain
const suggestedFrontendUrl = computed(() => {
  if (!formData.value.customDomain || formData.value.frontendUrl || dismissedSuggestions.value.frontendUrl) {
    return '';
  }
  return `https://${formData.value.customDomain}`;
});

const suggestedBackendUrl = computed(() => {
  if (!formData.value.customDomain || formData.value.backendUrl || dismissedSuggestions.value.backendUrl) {
    return '';
  }
  return `https://api.${formData.value.customDomain}`;
});

const suggestedR2Url = computed(() => {
  if (!formData.value.customDomain || formData.value.r2PublicUrl || dismissedSuggestions.value.r2PublicUrl) {
    return '';
  }
  return `https://files.${formData.value.customDomain}`;
});

// Resource naming preview
const resourceNames = computed(() => {
  const projectName = formData.value.projectName || 'my-crm';
  return {
    worker: `${projectName}-worker`,
    database: `${projectName}-db`,
    kvSession: `${projectName}-session`,
    kvCache: `${projectName}-cache`,
    r2Bucket: `${projectName}-uploads`,
    queue: `${projectName}-queue`,
    pages: `${projectName}-frontend`
  };
});

// Apply smart suggestion to form field
function applySuggestion(field: 'frontendUrl' | 'backendUrl' | 'r2PublicUrl'): void {
  if (field === 'frontendUrl' && suggestedFrontendUrl.value) {
    formData.value.frontendUrl = suggestedFrontendUrl.value;
  } else if (field === 'backendUrl' && suggestedBackendUrl.value) {
    formData.value.backendUrl = suggestedBackendUrl.value;
  } else if (field === 'r2PublicUrl' && suggestedR2Url.value) {
    formData.value.r2PublicUrl = suggestedR2Url.value;
  }
  clearError(field);
}

// Dismiss suggestion
function dismissSuggestion(field: string): void {
  dismissedSuggestions.value[field] = true;
}

// Toggle help sections
function toggleHelp(field: string): void {
  showHelp.value[field] = !showHelp.value[field];
}

// Toggle quick reference
function toggleQuickReference(step: number): void {
  showQuickReference.value[step] = !showQuickReference.value[step];
}

// ========================================
// LIFECYCLE
// ========================================

onMounted(() => {
  // Load session data
  accountId.value = sessionStorage.getItem('account_id') || '';
  accountName.value = sessionStorage.getItem('account_name') || '';
  userEmail.value = sessionStorage.getItem('user_email') || '';
  oauthToken.value = sessionStorage.getItem('oauth_token') || '';

  // Pre-fill admin email with user's email
  formData.value.adminEmail = userEmail.value;

  // Validate session
  if (!accountId.value || !oauthToken.value) {
    router.push({ name: 'landing' });
  }
});

// ========================================
// METHODS
// ========================================

function clearError(field: keyof FormErrors): void {
  if (errors.value[field]) {
    delete errors.value[field];
  }
}

function handleSkipLineChange(): void {
  if (skipLineConfig.value) {
    formData.value.enableLineIntegration = false;
    formData.value.lineChannelAccessToken = '';
    formData.value.lineChannelSecret = '';
    // Phase 1: Clear new LINE fields
    formData.value.lineBotId = '';
    formData.value.lineLiffId = '';
    clearError('lineChannelAccessToken');
    clearError('lineChannelSecret');
    clearError('lineBotId');
    clearError('lineLiffId');
  } else {
    formData.value.enableLineIntegration = true;
  }
}

function validateStep(step: number): boolean {
  errors.value = {};
  let isValid = true;

  if (step === 0) {
    // Phase 2: Enhanced validation with examples
    if (!formData.value.projectName) {
      errors.value.projectName = 'Project name is required';
      isValid = false;
    } else if (!/^[a-z0-9-]+$/.test(formData.value.projectName)) {
      errors.value.projectName = 'Project name must contain only lowercase letters, numbers, and hyphens (e.g., my-crm-system)';
      isValid = false;
    } else if (formData.value.projectName.length < 3) {
      errors.value.projectName = 'Project name must be at least 3 characters (e.g., crm)';
      isValid = false;
    } else if (formData.value.projectName.length > 50) {
      errors.value.projectName = 'Project name must be less than 50 characters';
      isValid = false;
    }

    if (!formData.value.adminEmail) {
      errors.value.adminEmail = 'Admin email is required for receiving deployment credentials';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.value.adminEmail)) {
      errors.value.adminEmail = 'Please enter a valid email address (e.g., admin@example.com)';
      isValid = false;
    }

    if (formData.value.customDomain) {
      // Check for protocol in domain (common mistake)
      if (formData.value.customDomain.includes('://')) {
        errors.value.customDomain = 'Domain should not include protocol (https://). Just enter the domain (e.g., crm.example.com)';
        isValid = false;
      } else {
        const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
        if (!domainRegex.test(formData.value.customDomain)) {
          errors.value.customDomain = 'Please enter a valid domain name (e.g., crm.example.com)';
          isValid = false;
        }
      }
    }

    // Phase 2: Enhanced R2 URL validation
    if (formData.value.r2PublicUrl) {
      const urlRegex = /^https?:\/\/.+/i;
      if (!urlRegex.test(formData.value.r2PublicUrl)) {
        errors.value.r2PublicUrl = 'Please enter a valid URL starting with https:// (e.g., https://files.example.com)';
        isValid = false;
      }
    }
  }

  if (step === 1 && !skipLineConfig.value) {
    // Phase 2: Enhanced LINE validation with actionable guidance
    if (!formData.value.lineBotId) {
      errors.value.lineBotId = 'LINE Bot ID is required for LINE integration';
      isValid = false;
    } else if (!/^@[a-z0-9]+$/.test(formData.value.lineBotId)) {
      errors.value.lineBotId = 'LINE Bot ID must start with @ followed by lowercase letters and numbers (e.g., @110xsqef). Find it in Channel Settings → Basic settings';
      isValid = false;
    }

    // Phase 2: Enhanced LIFF ID validation
    if (formData.value.lineLiffId && formData.value.lineLiffId.length < 10) {
      errors.value.lineLiffId = 'LIFF ID should be at least 10 characters. Example format: 2008756115-vWtFyDMA';
      isValid = false;
    }

    // Validate LINE Channel Access Token
    if (!formData.value.lineChannelAccessToken) {
      errors.value.lineChannelAccessToken = 'Channel Access Token is required';
      isValid = false;
    }

    // Validate LINE Channel Secret
    if (!formData.value.lineChannelSecret) {
      errors.value.lineChannelSecret = 'Channel Secret is required';
      isValid = false;
    } else if (formData.value.lineChannelSecret.length !== 32) {
      errors.value.lineChannelSecret = 'Channel Secret should be 32 characters';
      isValid = false;
    }
  }

  return isValid;
}

function nextStep(): void {
  if (validateStep(currentStep.value)) {
    currentStep.value++;
  }
}

function prevStep(): void {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

async function handleSubmit(): Promise<void> {
  // Validate all steps
  for (let i = 0; i < steps.length - 1; i++) {
    if (!validateStep(i)) {
      currentStep.value = i;
      return;
    }
  }

  isSubmitting.value = true;

  try {
    // Start deployment
    await deploymentStore.startDeployment({
      projectName: formData.value.projectName,
      adminEmail: formData.value.adminEmail,
      customDomain: formData.value.customDomain || undefined,
      accountId: accountId.value,
      oauthToken: oauthToken.value,
      // Phase 1 Enhancement: URL Configuration
      backendUrl: formData.value.backendUrl || undefined,
      frontendUrl: formData.value.frontendUrl || undefined,
      r2PublicUrl: formData.value.r2PublicUrl || undefined,
      // LINE configuration (Enhanced)
      lineChannelAccessToken: skipLineConfig.value ? undefined : formData.value.lineChannelAccessToken,
      lineChannelSecret: skipLineConfig.value ? undefined : formData.value.lineChannelSecret,
      lineBotId: skipLineConfig.value ? undefined : formData.value.lineBotId,
      lineLiffId: skipLineConfig.value ? undefined : formData.value.lineLiffId,
      // Facebook configuration (optional)
      facebookPageAccessToken: formData.value.facebookPageAccessToken || undefined,
      facebookAppSecret: formData.value.facebookAppSecret || undefined,
      // System Configuration
      logLevel: formData.value.logLevel
    });

    // Navigate to deployment progress page
    router.push({
      name: 'deploy',
      params: { projectName: formData.value.projectName }
    });

  } catch (error) {
    console.error('Failed to start deployment:', error);
    alert(
      error instanceof Error
        ? error.message
        : 'Failed to start deployment. Please try again.'
    );
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.config-form-page {
  min-height: 100vh;
  padding: var(--spacing-2xl) 0;
}

.config-card {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--spacing-3xl);
  box-shadow: var(--shadow-xl);
}

.config-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);
}

.config-header h1 {
  margin-bottom: var(--spacing-sm);
  color: var(--color-gray-900);
}

.config-header p {
  margin: 0;
  color: var(--color-gray-600);
}

/* Step Indicator */
.step-indicator {
  display: flex;
  justify-content: center;
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-2xl);
  padding: var(--spacing-lg) 0;
  border-bottom: 1px solid var(--color-gray-200);
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  opacity: 0.5;
  transition: opacity var(--transition-base);
}

.step-item.active,
.step-item.completed {
  opacity: 1;
}

.step-number {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-gray-200);
  color: var(--color-gray-600);
  font-weight: var(--font-weight-bold);
  transition: all var(--transition-base);
}

.step-item.active .step-number {
  background: var(--color-primary);
  color: white;
}

.step-item.completed .step-number {
  background: var(--color-success);
  color: white;
}

.step-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

/* Form Step */
.form-step h2 {
  margin-bottom: var(--spacing-xl);
  color: var(--color-gray-900);
}

/* Account Info */
.account-info {
  padding: var(--spacing-lg);
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xl);
}

.account-info-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
}

.account-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-gray-700);
}

.account-value {
  color: var(--color-gray-900);
  font-family: 'Courier New', monospace;
}

/* Form Group */
.form-group {
  margin-bottom: var(--spacing-xl);
}

.form-label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-gray-700);
}

.form-input {
  width: 100%;
  padding: var(--spacing-md);
  border: 2px solid var(--color-gray-200);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: border-color var(--transition-base);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-input.error {
  border-color: var(--color-error);
}

.form-error {
  margin-top: var(--spacing-xs);
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.form-hint {
  display: block;
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  font-weight: var(--font-weight-normal);
}

/* Input with Toggle */
.input-with-toggle {
  position: relative;
  display: flex;
}

.input-with-toggle .form-input {
  padding-right: 50px;
}

.toggle-visibility {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2em;
  padding: var(--spacing-xs);
}

/* Integration Note */
.integration-note {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-primary-light);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xl);
}

.note-icon {
  font-size: 1.5em;
}

.note-content {
  flex: 1;
}

.note-content ol {
  margin: var(--spacing-sm) 0 0 var(--spacing-lg);
  padding: 0;
}

.note-content li {
  margin-bottom: var(--spacing-xs);
}

.note-content a {
  color: var(--color-primary);
  text-decoration: underline;
}

/* Skip Option */
.skip-option {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-gray-50);
  border-radius: var(--radius-md);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
}

/* Config Summary */
.config-summary {
  background: var(--color-gray-50);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-xl);
}

.config-summary h3 {
  margin-bottom: var(--spacing-lg);
}

.summary-section {
  margin-bottom: var(--spacing-lg);
}

.summary-section h4 {
  margin-bottom: var(--spacing-md);
  color: var(--color-gray-700);
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--color-gray-200);
}

.summary-label {
  color: var(--color-gray-600);
}

.summary-value {
  font-weight: var(--font-weight-medium);
}

.text-success {
  color: var(--color-success);
}

.text-muted {
  color: var(--color-gray-500);
}

/* Resources Preview */
.resources-preview {
  background: white;
  padding: var(--spacing-xl);
  border: 2px solid var(--color-gray-200);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-xl);
}

.resources-preview h3 {
  margin-bottom: var(--spacing-md);
}

.resource-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.resource-list li {
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--color-gray-100);
}

.resource-list code {
  background: var(--color-gray-100);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

/* Cost Estimate */
.cost-estimate {
  padding: var(--spacing-xl);
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-xl);
}

.cost-estimate h3 {
  margin-bottom: var(--spacing-md);
  color: var(--color-gray-900);
}

.cost-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.cost-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm);
  color: var(--color-gray-700);
}

.cost-total {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-md);
  margin-top: var(--spacing-sm);
  border-top: 2px solid var(--color-gray-300);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-lg);
  color: var(--color-gray-900);
}

.cost-value {
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}

.cost-note {
  margin-top: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
  font-style: italic;
}

/* Form Actions */
.form-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: space-between;
  margin-top: var(--spacing-2xl);
}

.btn {
  padding: var(--spacing-md) var(--spacing-xl);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-secondary {
  background: var(--color-gray-200);
  color: var(--color-gray-700);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-gray-300);
}

.btn-lg {
  padding: var(--spacing-lg) var(--spacing-2xl);
  font-size: var(--font-size-lg);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ========================================
   PHASE 2: SMART SUGGESTIONS & UX ENHANCEMENTS
   ======================================== */

/* Suggestion Box */
.suggestion-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-md);
  animation: slideIn 0.3s ease-out;
}

.suggestion-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
}

.suggestion-icon {
  font-size: 1.25rem;
}

.suggestion-text {
  font-size: 0.875rem;
  color: var(--color-gray-700);
}

.suggestion-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.btn-suggestion-apply {
  padding: 0.375rem 0.75rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-base);
}

.btn-suggestion-apply:hover {
  background: var(--color-primary-dark);
}

.btn-suggestion-dismiss {
  padding: 0.375rem 0.5rem;
  background: transparent;
  color: var(--color-gray-500);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-suggestion-dismiss:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-gray-700);
}

/* Resource Preview */
.resource-preview {
  margin-top: var(--spacing-lg);
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.resource-preview-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-gray-50);
  border: none;
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-gray-700);
  transition: background var(--transition-base);
}

.resource-preview-toggle:hover {
  background: var(--color-gray-100);
}

.preview-icon {
  font-size: 1.125rem;
}

.preview-arrow {
  margin-left: auto;
  color: var(--color-gray-500);
  transition: transform var(--transition-base);
}

.resource-preview-content {
  padding: var(--spacing-md);
  background: white;
  border-top: 1px solid var(--color-gray-200);
}

.resource-preview-content h4 {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: 0.875rem;
  color: var(--color-gray-600);
  font-weight: 500;
}

.resource-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.resource-list li {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.875rem;
}

.resource-label {
  min-width: 100px;
  color: var(--color-gray-600);
  font-weight: 500;
}

.resource-list code {
  padding: 0.25rem 0.5rem;
  background: var(--color-gray-100);
  border-radius: var(--radius-sm);
  font-family: 'Courier New', monospace;
  font-size: 0.8125rem;
  color: var(--color-primary);
}

/* Quick Reference */
.quick-reference {
  margin-bottom: var(--spacing-lg);
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.quick-reference-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: none;
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-primary);
  transition: background var(--transition-base);
}

.quick-reference-toggle:hover {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
}

.ref-icon {
  font-size: 1.25rem;
}

.ref-arrow {
  margin-left: auto;
  color: var(--color-primary);
  transition: transform var(--transition-base);
  font-size: 0.875rem;
}

.quick-reference-content {
  padding: var(--spacing-md);
  background: white;
  border-top: 1px solid var(--color-gray-200);
}

.quick-reference-content h4 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: 1rem;
  color: var(--color-gray-800);
  font-weight: 600;
}

.reference-list {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--spacing-sm) 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.reference-list li {
  padding-left: var(--spacing-md);
  position: relative;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-gray-700);
}

.reference-list li::before {
  content: '▸';
  position: absolute;
  left: 0;
  color: var(--color-primary);
  font-weight: bold;
}

.reference-tip {
  margin-top: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: #fef3c7;
  border-left: 3px solid #f59e0b;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  color: var(--color-gray-700);
}

/* Help Section */
.help-section {
  margin-top: var(--spacing-md);
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.help-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-gray-50);
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-gray-700);
  transition: background var(--transition-base);
}

.help-toggle:hover {
  background: var(--color-gray-100);
}

.help-icon {
  font-size: 1rem;
  color: var(--color-primary);
}

.help-arrow {
  margin-left: auto;
  color: var(--color-gray-500);
  transition: transform var(--transition-base);
  font-size: 0.75rem;
}

.help-content {
  padding: var(--spacing-md);
  background: white;
  border-top: 1px solid var(--color-gray-200);
  animation: slideIn 0.2s ease-out;
}

.help-content h4 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: 0.9375rem;
  color: var(--color-gray-800);
  font-weight: 600;
}

.help-steps {
  margin: 0 0 var(--spacing-md) 0;
  padding-left: var(--spacing-lg);
  color: var(--color-gray-700);
  font-size: 0.875rem;
  line-height: 1.6;
}

.help-steps li {
  margin-bottom: var(--spacing-xs);
}

.help-steps ul {
  margin-top: var(--spacing-xs);
  padding-left: var(--spacing-lg);
}

.help-example {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-gray-100);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  margin-bottom: var(--spacing-sm);
}

.help-example code {
  padding: 0.125rem 0.375rem;
  background: white;
  border-radius: var(--radius-sm);
  font-family: 'Courier New', monospace;
  color: var(--color-primary);
}

.help-note {
  padding: var(--spacing-sm) var(--spacing-md);
  background: #dbeafe;
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  color: var(--color-gray-700);
  margin-bottom: var(--spacing-sm);
}

.help-link {
  font-size: 0.875rem;
  color: var(--color-gray-700);
}

.help-link a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.help-link a:hover {
  text-decoration: underline;
}

/* Phase 2: Badges */
.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  margin-left: var(--spacing-xs);
  vertical-align: middle;
}

.badge-required {
  background: #fee2e2;
  color: #dc2626;
}

.badge-optional {
  background: #dbeafe;
  color: #2563eb;
}

/* Phase 2: Success Indicators */
.form-success {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
  color: #059669;
  font-size: 0.875rem;
  font-weight: 500;
}

.form-success-icon {
  font-size: 1rem;
}

/* Phase 2: Enhanced Input States */
.form-input.is-valid {
  border-color: #10b981;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2310b981'%3E%3Cpath fill-rule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clip-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1.25rem;
  padding-right: 3rem;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

/* Character Counter */
.char-counter {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-xs);
  font-size: 0.75rem;
  color: var(--color-gray-500);
}

.char-counter.warning {
  color: #f59e0b;
}

.char-counter.danger {
  color: #dc2626;
}

/* Animations */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .config-card {
    padding: var(--spacing-xl);
  }

  .step-indicator {
    gap: var(--spacing-md);
  }

  .step-label {
    display: none;
  }

  .account-info-item {
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .form-actions {
    flex-direction: column;
  }

  .form-actions .btn {
    width: 100%;
  }

  /* Phase 2: Mobile responsive */
  .suggestion-box {
    flex-direction: column;
    align-items: stretch;
  }

  .suggestion-actions {
    justify-content: flex-end;
  }

  .resource-list {
    font-size: 0.8125rem;
  }

  .resource-label {
    min-width: 80px;
  }
}
</style>
