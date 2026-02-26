<template>
  <div class="form-step">
    <h2>Review &amp; Deploy</h2>

    <!-- Configuration Summary -->
    <div class="config-summary">
      <h3>Configuration Summary</h3>

      <div class="summary-section">
        <h4>Basic Settings</h4>
        <div class="summary-item">
          <span class="summary-label">Project Name:</span>
          <span class="summary-value">{{ formData.projectName }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Admin Email:</span>
          <span class="summary-value">{{ formData.adminEmail }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Admin Password:</span>
          <span class="summary-value">{{ '\u2022'.repeat(formData.adminPassword?.length || 0) }}</span>
        </div>
      </div>

      <div class="summary-section">
        <h4>LINE Integration</h4>
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
      <h3>Estimated Monthly Cost</h3>
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
      <h3>Resources to be Created</h3>
      <ul class="resource-list">
        <li>&#x2705; D1 Database: <code>{{ formData.projectName }}-db</code></li>
        <li>&#x2705; KV Namespace (Sessions): <code>{{ formData.projectName }}-sessions</code></li>
        <li>&#x2705; KV Namespace (Cache): <code>{{ formData.projectName }}-cache</code></li>
        <li>&#x2705; R2 Bucket: <code>{{ formData.projectName }}-files</code></li>
        <li>&#x2705; Queue: <code>{{ formData.projectName }}-queue</code></li>
        <li>&#x2705; Worker: <code>{{ formData.projectName }}-worker</code></li>
        <li>&#x2705; Pages: <code>{{ formData.projectName }}-frontend</code></li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConfigFormData } from './types';

// ========================================
// PROPS
// ========================================

defineProps<{
  formData: ConfigFormData;
  skipLineConfig: boolean;
}>();
</script>

<style scoped>
/* Form Step */
.form-step h2 {
  margin-bottom: var(--spacing-xl);
  color: var(--color-gray-900);
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
</style>
