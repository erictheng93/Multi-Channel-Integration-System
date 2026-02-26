<template>
  <div class="form-step">
    <h2>Basic Configuration</h2>

    <!-- Phase 2: Quick Reference -->
    <div class="quick-reference">
      <button type="button" @click="showQuickReference = !showQuickReference" class="quick-reference-toggle">
        <span class="ref-icon">&#x1F4D6;</span>
        <span>Quick Reference: What You'll Need</span>
        <span class="ref-arrow">{{ showQuickReference ? '\u25BC' : '\u25B6' }}</span>
      </button>
      <div v-show="showQuickReference" class="quick-reference-content">
        <h4>Step 1: Basic Configuration</h4>
        <ul class="reference-list">
          <li>
            <strong>Project Name:</strong> Choose a unique name using lowercase letters, numbers, and hyphens (e.g., my-crm-system)
          </li>
          <li>
            <strong>Admin Email:</strong> Your email for receiving deployment credentials and notifications
          </li>
          <li>
            <strong>Admin Password:</strong> Choose a strong password (at least 8 characters) for your admin account
          </li>
        </ul>
        <div class="reference-tip">
          &#x1F4A1; <strong>Tip:</strong> Custom domain and R2 storage URL can be configured later in Cloudflare Dashboard.
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
        :value="formData.projectName"
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
        @input="onFieldInput('projectName', ($event.target as HTMLInputElement).value)"
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
        :value="formData.adminEmail"
        type="email"
        class="form-input"
        :class="{
          error: errors.adminEmail,
          'is-valid': formData.adminEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)
        }"
        placeholder="admin@example.com"
        required
        @input="onFieldInput('adminEmail', ($event.target as HTMLInputElement).value)"
      />
      <div v-if="errors.adminEmail" class="form-error">
        {{ errors.adminEmail }}
      </div>
    </div>

    <!-- Admin Password -->
    <div class="form-group">
      <label for="adminPassword" class="form-label">
        Admin Password
        <span class="badge badge-required">Required</span>
        <span class="form-hint">At least 8 characters</span>
      </label>
      <input
        id="adminPassword"
        :value="formData.adminPassword"
        type="password"
        class="form-input"
        :class="{
          error: errors.adminPassword,
          'is-valid': formData.adminPassword && formData.adminPassword.length >= 8
        }"
        placeholder="Enter admin password"
        required
        @input="onFieldInput('adminPassword', ($event.target as HTMLInputElement).value)"
      />
      <div v-if="errors.adminPassword" class="form-error">
        {{ errors.adminPassword }}
      </div>
    </div>

    <!-- Confirm Password -->
    <div class="form-group">
      <label for="adminPasswordConfirm" class="form-label">
        Confirm Password
        <span class="badge badge-required">Required</span>
      </label>
      <input
        id="adminPasswordConfirm"
        :value="formData.adminPasswordConfirm"
        type="password"
        class="form-input"
        :class="{
          error: errors.adminPasswordConfirm,
          'is-valid': formData.adminPasswordConfirm && formData.adminPasswordConfirm === formData.adminPassword && formData.adminPasswordConfirm.length >= 8
        }"
        placeholder="Confirm admin password"
        required
        @input="onFieldInput('adminPasswordConfirm', ($event.target as HTMLInputElement).value)"
      />
      <div v-if="errors.adminPasswordConfirm" class="form-error">
        {{ errors.adminPasswordConfirm }}
      </div>
    </div>

    <!-- Phase 2: Resource Naming Preview -->
    <div v-if="formData.projectName" class="resource-preview">
      <button type="button" @click="showResourcePreview = !showResourcePreview" class="resource-preview-toggle">
        <span class="preview-icon">&#x1F4E6;</span>
        <span>Preview Resource Names</span>
        <span class="preview-arrow">{{ showResourcePreview ? '\u25BC' : '\u25B6' }}</span>
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
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ConfigFormData, ResourceNames } from './types';
import type { FormErrors } from '@/types';

// ========================================
// PROPS & EMITS
// ========================================

const props = defineProps<{
  formData: ConfigFormData;
  errors: FormErrors;
}>();

const emit = defineEmits<{
  (e: 'update:field', field: keyof ConfigFormData, value: string): void;
  (e: 'clearError', field: keyof FormErrors): void;
}>();

// ========================================
// LOCAL STATE
// ========================================

const showQuickReference = ref(false);
const showResourcePreview = ref(false);

// ========================================
// COMPUTED
// ========================================

const resourceNames = computed<ResourceNames>(() => {
  const projectName = props.formData.projectName || 'my-crm';
  return {
    worker: `${projectName}-worker`,
    database: `${projectName}-db`,
    kvSession: `${projectName}-session`,
    kvCache: `${projectName}-cache`,
    r2Bucket: `${projectName}-uploads`,
    queue: `${projectName}-queue`,
    pages: `${projectName}-frontend`,
  };
});

// ========================================
// METHODS
// ========================================

function onFieldInput(field: keyof ConfigFormData, value: string): void {
  emit('update:field', field, value);
  emit('clearError', field as keyof FormErrors);
}
</script>

<style scoped>
/* Form Step */
.form-step h2 {
  margin-bottom: var(--spacing-xl);
  color: var(--color-gray-900);
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
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-input.error {
  border-color: var(--color-error);
}

.form-input.is-valid {
  border-color: #10b981;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2310b981'%3E%3Cpath fill-rule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clip-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1.25rem;
  padding-right: 3rem;
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

/* Badges */
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
  content: '\25B8';
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
  .resource-list {
    font-size: 0.8125rem;
  }

  .resource-label {
    min-width: 80px;
  }
}
</style>
