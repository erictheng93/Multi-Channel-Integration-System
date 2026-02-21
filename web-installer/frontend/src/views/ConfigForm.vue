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
              <div class="step-number">{{ currentStep > index ? '\u2713' : index + 1 }}</div>
              <div class="step-label">{{ step.label }}</div>
            </div>
          </div>

          <!-- Step 1: Basic Configuration -->
          <ConfigFormBasic
            v-show="currentStep === 0"
            :form-data="formData"
            :errors="errors"
            :suggested-r2-url="suggestedR2Url"
            @update:field="updateField"
            @clear-error="clearError"
            @apply-suggestion="applySuggestion"
            @dismiss-suggestion="dismissSuggestion"
          />

          <!-- Step 2: LINE OA Configuration -->
          <ConfigFormLineOA
            v-show="currentStep === 1"
            :form-data="formData"
            :errors="errors"
            :skip-line-config="skipLineConfig"
            @update:field="updateField"
            @clear-error="clearError"
            @update:skip-line-config="handleSkipLineChange"
          />

          <!-- Step 3: Review & Deploy -->
          <ConfigFormReview
            v-show="currentStep === 2"
            :form-data="formData"
            :skip-line-config="skipLineConfig"
          />

          <!-- Form Actions -->
          <div class="form-actions">
            <button
              v-if="currentStep > 0"
              type="button"
              @click="prevStep"
              class="btn btn-secondary"
              :disabled="isSubmitting"
            >
              &larr; Back
            </button>
            <div v-else></div>

            <button
              v-if="currentStep < steps.length - 1"
              type="button"
              @click="nextStep"
              class="btn btn-primary"
            >
              Next &rarr;
            </button>

            <button
              v-else
              type="submit"
              class="btn btn-primary btn-lg"
              :disabled="isSubmitting"
            >
              <span v-if="!isSubmitting">&#x1F680; Start Deployment</span>
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
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDeploymentStore } from '@/stores/deploymentStore';
import type { FormErrors } from '@/types';
import type { ConfigFormData } from './config-form/types';
import { createDefaultFormData } from './config-form/types';
import ConfigFormBasic from './config-form/ConfigFormBasic.vue';
import ConfigFormLineOA from './config-form/ConfigFormLineOA.vue';
import ConfigFormReview from './config-form/ConfigFormReview.vue';

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
  { id: 'review', label: 'Review' },
];

const currentStep = ref(0);
const formData = ref<ConfigFormData>(createDefaultFormData());
const errors = ref<FormErrors>({});
const isSubmitting = ref(false);
const skipLineConfig = ref(false);

// Session data
const accountId = ref<string>('');
const accountName = ref<string>('');
const userEmail = ref<string>('');
const oauthToken = ref<string>('');

// ========================================
// SMART DEFAULTS
// ========================================

// Track dismissed suggestions
const dismissedSuggestions = ref<Record<string, boolean>>({});

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

function updateField(field: keyof ConfigFormData, value: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (formData.value as any)[field] = value;
}

function clearError(field: keyof FormErrors): void {
  if (errors.value[field]) {
    delete errors.value[field];
  }
}

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

function dismissSuggestion(field: string): void {
  dismissedSuggestions.value[field] = true;
}

function handleSkipLineChange(newValue: boolean): void {
  skipLineConfig.value = newValue;
  if (newValue) {
    formData.value.enableLineIntegration = false;
    formData.value.lineChannelAccessToken = '';
    formData.value.lineChannelSecret = '';
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

    if (formData.value.r2PublicUrl) {
      const urlRegex = /^https?:\/\/.+/i;
      if (!urlRegex.test(formData.value.r2PublicUrl)) {
        errors.value.r2PublicUrl = 'Please enter a valid URL starting with https:// (e.g., https://files.example.com)';
        isValid = false;
      }
    }
  }

  if (step === 1 && !skipLineConfig.value) {
    if (!formData.value.lineBotId) {
      errors.value.lineBotId = 'LINE Bot ID is required for LINE integration';
      isValid = false;
    } else if (!/^@[a-z0-9]+$/.test(formData.value.lineBotId)) {
      errors.value.lineBotId = 'LINE Bot ID must start with @ followed by lowercase letters and numbers (e.g., @110xsqef). Find it in Channel Settings \u2192 Basic settings';
      isValid = false;
    }

    if (formData.value.lineLiffId && formData.value.lineLiffId.length < 10) {
      errors.value.lineLiffId = 'LIFF ID should be at least 10 characters. Example format: 2008756115-vWtFyDMA';
      isValid = false;
    }

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
    await deploymentStore.startDeployment({
      projectName: formData.value.projectName,
      adminEmail: formData.value.adminEmail,
      customDomain: formData.value.customDomain || undefined,
      accountId: accountId.value,
      oauthToken: oauthToken.value,
      backendUrl: formData.value.backendUrl || undefined,
      frontendUrl: formData.value.frontendUrl || undefined,
      r2PublicUrl: formData.value.r2PublicUrl || undefined,
      lineChannelAccessToken: skipLineConfig.value ? undefined : formData.value.lineChannelAccessToken,
      lineChannelSecret: skipLineConfig.value ? undefined : formData.value.lineChannelSecret,
      lineBotId: skipLineConfig.value ? undefined : formData.value.lineBotId,
      lineLiffId: skipLineConfig.value ? undefined : formData.value.lineLiffId,
      facebookPageAccessToken: formData.value.facebookPageAccessToken || undefined,
      facebookAppSecret: formData.value.facebookAppSecret || undefined,
      logLevel: formData.value.logLevel,
    });

    router.push({
      name: 'deploy',
      params: { projectName: formData.value.projectName },
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
