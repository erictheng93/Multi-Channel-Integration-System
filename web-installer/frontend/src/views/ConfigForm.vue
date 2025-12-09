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

            <!-- Project Name -->
            <div class="form-group">
              <label for="projectName" class="form-label">
                Project Name *
                <span class="form-hint">Lowercase letters, numbers, and hyphens only</span>
              </label>
              <input
                id="projectName"
                v-model="formData.projectName"
                type="text"
                class="form-input"
                :class="{ error: errors.projectName }"
                placeholder="my-crm-system"
                required
                pattern="[a-z0-9-]+"
                maxlength="50"
                @input="clearError('projectName')"
              />
              <div v-if="errors.projectName" class="form-error">
                {{ errors.projectName }}
              </div>
              <div class="form-hint">
                This will be used for resource naming (e.g., my-crm-worker, my-crm-db)
              </div>
            </div>

            <!-- Admin Email -->
            <div class="form-group">
              <label for="adminEmail" class="form-label">
                Admin Email *
                <span class="form-hint">For receiving credentials and notifications</span>
              </label>
              <input
                id="adminEmail"
                v-model="formData.adminEmail"
                type="email"
                class="form-input"
                :class="{ error: errors.adminEmail }"
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
                Custom Domain (Optional)
                <span class="form-hint">Leave empty to use default .workers.dev domain</span>
              </label>
              <input
                id="customDomain"
                v-model="formData.customDomain"
                type="text"
                class="form-input"
                :class="{ error: errors.customDomain }"
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
                  <li>Copy the Channel Access Token and Channel Secret</li>
                </ol>
              </div>
            </div>

            <!-- LINE Channel Access Token -->
            <div class="form-group">
              <label for="lineChannelAccessToken" class="form-label">
                Channel Access Token {{ formData.enableLineIntegration ? '*' : '' }}
              </label>
              <div class="input-with-toggle">
                <input
                  id="lineChannelAccessToken"
                  v-model="formData.lineChannelAccessToken"
                  :type="showLineToken ? 'text' : 'password'"
                  class="form-input"
                  :class="{ error: errors.lineChannelAccessToken }"
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
                Channel Secret {{ formData.enableLineIntegration ? '*' : '' }}
              </label>
              <div class="input-with-toggle">
                <input
                  id="lineChannelSecret"
                  v-model="formData.lineChannelSecret"
                  :type="showLineSecret ? 'text' : 'password'"
                  class="form-input"
                  :class="{ error: errors.lineChannelSecret }"
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
  projectName: '',
  adminEmail: '',
  customDomain: '',
  enableLineIntegration: true,
  lineChannelAccessToken: '',
  lineChannelSecret: '',
  enableFacebookIntegration: false,
  facebookPageAccessToken: '',
  facebookAppSecret: ''
});

const errors = ref<FormErrors>({});
const isSubmitting = ref(false);
const skipLineConfig = ref(false);
const showLineToken = ref(false);
const showLineSecret = ref(false);

// Session data
const accountId = ref<string>('');
const accountName = ref<string>('');
const userEmail = ref<string>('');
const oauthToken = ref<string>('');

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
    clearError('lineChannelAccessToken');
    clearError('lineChannelSecret');
  } else {
    formData.value.enableLineIntegration = true;
  }
}

function validateStep(step: number): boolean {
  errors.value = {};
  let isValid = true;

  if (step === 0) {
    // Validate basic configuration
    if (!formData.value.projectName) {
      errors.value.projectName = 'Project name is required';
      isValid = false;
    } else if (!/^[a-z0-9-]+$/.test(formData.value.projectName)) {
      errors.value.projectName = 'Only lowercase letters, numbers, and hyphens are allowed';
      isValid = false;
    } else if (formData.value.projectName.length < 3) {
      errors.value.projectName = 'Project name must be at least 3 characters';
      isValid = false;
    } else if (formData.value.projectName.length > 50) {
      errors.value.projectName = 'Project name must be less than 50 characters';
      isValid = false;
    }

    if (!formData.value.adminEmail) {
      errors.value.adminEmail = 'Admin email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.value.adminEmail)) {
      errors.value.adminEmail = 'Please enter a valid email address';
      isValid = false;
    }

    if (formData.value.customDomain) {
      const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
      if (!domainRegex.test(formData.value.customDomain)) {
        errors.value.customDomain = 'Please enter a valid domain name';
        isValid = false;
      }
    }
  }

  if (step === 1 && !skipLineConfig.value) {
    // Validate LINE configuration
    if (!formData.value.lineChannelAccessToken) {
      errors.value.lineChannelAccessToken = 'Channel Access Token is required';
      isValid = false;
    }

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
      // LINE configuration
      lineChannelAccessToken: skipLineConfig.value ? undefined : formData.value.lineChannelAccessToken,
      lineChannelSecret: skipLineConfig.value ? undefined : formData.value.lineChannelSecret,
      // Facebook configuration (optional)
      facebookPageAccessToken: formData.value.facebookPageAccessToken || undefined,
      facebookAppSecret: formData.value.facebookAppSecret || undefined
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
}
</style>
