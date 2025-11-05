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

          <!-- Form Actions -->
          <div class="form-actions">
            <button
              type="button"
              @click="goBack"
              class="btn btn-secondary"
              :disabled="isSubmitting"
            >
              ← Back
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isSubmitting"
            >
              <span v-if="!isSubmitting">Start Deployment →</span>
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

const formData = ref({
  projectName: '',
  adminEmail: '',
  customDomain: ''
});

const errors = ref<FormErrors>({});
const isSubmitting = ref(false);

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

function validateForm(): boolean {
  errors.value = {};
  let isValid = true;

  // Validate project name
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

  // Validate admin email
  if (!formData.value.adminEmail) {
    errors.value.adminEmail = 'Admin email is required';
    isValid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.value.adminEmail)) {
    errors.value.adminEmail = 'Please enter a valid email address';
    isValid = false;
  }

  // Validate custom domain (optional)
  if (formData.value.customDomain) {
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    if (!domainRegex.test(formData.value.customDomain)) {
      errors.value.customDomain = 'Please enter a valid domain name';
      isValid = false;
    }
  }

  return isValid;
}

async function handleSubmit(): Promise<void> {
  if (!validateForm()) {
    return;
  }

  isSubmitting.value = true;

  try {
    // Start deployment
    await deploymentStore.startDeployment({
      projectName: formData.value.projectName,
      adminEmail: formData.value.adminEmail,
      customDomain: formData.value.customDomain || undefined,
      accountId: accountId.value,
      oauthToken: oauthToken.value
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

function goBack(): void {
  router.push({ name: 'landing' });
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

/* Form Hint */
.form-hint {
  display: block;
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  font-weight: var(--font-weight-normal);
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
}

.form-actions .btn {
  flex: 1;
}

.btn-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

@media (max-width: 768px) {
  .config-card {
    padding: var(--spacing-xl);
  }

  .account-info-item {
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .form-actions {
    flex-direction: column;
  }
}
</style>
