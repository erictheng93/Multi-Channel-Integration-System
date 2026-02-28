<template>
  <div class="error-page">
    <div class="container container-md">
      <div class="error-card">
        <!-- Error Icon -->
        <div class="error-icon">
          <div class="error-circle">
            <span>✗</span>
          </div>
        </div>

        <!-- Error Header -->
        <div class="error-header">
          <h1>Deployment Failed</h1>
          <p>We encountered an error during the deployment process</p>
        </div>

        <!-- Error Details -->
        <div class="error-details">
          <h3>Error Details</h3>
          <div class="error-message-box">
            <pre>{{ errorMessage }}</pre>
          </div>
        </div>

        <!-- Deployment Info (if available) -->
        <div v-if="deploymentStore.projectName" class="deployment-info">
          <div class="info-row">
            <span class="info-label">Project Name:</span>
            <span class="info-value">{{ deploymentStore.projectName }}</span>
          </div>
          <div v-if="deploymentStore.currentStep" class="info-row">
            <span class="info-label">Failed Step:</span>
            <span class="info-value">{{ formatStepName(deploymentStore.currentStep) }}</span>
          </div>
          <div v-if="deploymentStore.duration > 0" class="info-row">
            <span class="info-label">Time Elapsed:</span>
            <span class="info-value">{{ formatDuration(deploymentStore.duration) }}</span>
          </div>
        </div>

        <!-- Rollback Info -->
        <div class="rollback-info">
          <h3>🔄 Automatic Rollback</h3>
          <p>
            Don't worry! Our system automatically cleans up any resources that were created
            before the error occurred. Your Cloudflare account remains clean.
          </p>
        </div>

        <!-- Common Issues -->
        <div class="common-issues">
          <h3>💡 Common Issues & Solutions</h3>
          <div class="issue-list">
            <div class="issue-item">
              <div class="issue-title">❌ Invalid OAuth Token</div>
              <div class="issue-solution">
                Solution: Try logging out and authenticating again with Cloudflare
              </div>
            </div>
            <div class="issue-item">
              <div class="issue-title">❌ Insufficient Permissions</div>
              <div class="issue-solution">
                Solution: Make sure your Cloudflare account has permissions to create Workers, D1, KV, R2, and Pages
              </div>
            </div>
            <div class="issue-item">
              <div class="issue-title">❌ Resource Quota Exceeded</div>
              <div class="issue-solution">
                Solution: Check your Cloudflare plan limits or upgrade to a paid plan
              </div>
            </div>
            <div class="issue-item">
              <div class="issue-title">❌ Domain Not Found</div>
              <div class="issue-solution">
                Solution: Make sure the custom domain you specified exists in your Cloudflare account
              </div>
            </div>
          </div>
        </div>

        <!-- Deployment Logs (if available) -->
        <div v-if="deploymentStore.logs.length > 0" class="logs-section">
          <h3>📋 Deployment Logs</h3>
          <LogConsole :logs="deploymentStore.logs" />
        </div>

        <!-- Actions -->
        <div class="actions-section">
          <button @click="tryAgain" class="btn btn-primary btn-lg">
            🔄 Try Again
          </button>
          <button @click="getSupport" class="btn btn-secondary">
            💬 Get Support
          </button>
          <button @click="goHome" class="btn btn-secondary">
            ← Back to Home
          </button>
        </div>

        <!-- Support Info -->
        <div class="support-info">
          <p>
            Still having issues?
            <a href="mailto:support@yourcompany.com">Contact our support team</a>
            or
            <a href="https://discord.gg/yourcompany" target="_blank">join our Discord</a>
            for help.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useDeploymentStore } from '@/stores/deploymentStore';
import LogConsole from '@/components/LogConsole.vue';
import { formatDuration } from '@/utils/format';

// ========================================
// COMPOSABLES
// ========================================

const router = useRouter();
const deploymentStore = useDeploymentStore();

// ========================================
// STATE
// ========================================

const errorMessage = computed(() => {
  return deploymentStore.error || 'An unknown error occurred during deployment';
});

// ========================================
// METHODS
// ========================================

function formatStepName(step: string): string {
  // Convert snake_case to Title Case
  return step
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function tryAgain(): void {
  // Reset deployment state
  deploymentStore.resetState();
  // Go back to configuration
  router.push({ name: 'configure' });
}

function getSupport(): void {
  // Open support resources in new tabs
  window.open('https://docs.yourcompany.com/troubleshooting', '_blank');
  window.open('https://discord.gg/yourcompany', '_blank');
}

function goHome(): void {
  // Reset deployment state
  deploymentStore.resetState();
  // Go to landing page
  router.push({ name: 'landing' });
}

// ========================================
// LIFECYCLE
// ========================================

onMounted(() => {
  // If no error in store, redirect to landing
  if (!deploymentStore.error && deploymentStore.status !== 'failed') {
    router.push({ name: 'landing' });
  }
});
</script>

<style scoped>
.error-page {
  min-height: 100vh;
  padding: var(--spacing-2xl) 0;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.error-card {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--spacing-3xl);
  box-shadow: var(--shadow-xl);
}

/* Error Icon */
.error-icon {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.error-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  background: var(--gradient-error);
  border-radius: 50%;
  color: white;
  font-size: 4rem;
  font-weight: var(--font-weight-bold);
  animation: errorPulse 0.6s ease;
}

@keyframes errorPulse {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Error Header */
.error-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);
}

.error-header h1 {
  margin-bottom: var(--spacing-sm);
  color: var(--color-error);
}

.error-header p {
  margin: 0;
  color: var(--color-gray-600);
}

/* Error Details */
.error-details {
  margin-bottom: var(--spacing-2xl);
}

.error-details h3 {
  margin-bottom: var(--spacing-md);
  color: var(--color-gray-900);
}

.error-message-box {
  padding: var(--spacing-lg);
  background: #fee;
  border: 2px solid var(--color-error);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.error-message-box pre {
  margin: 0;
  color: var(--color-error);
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-sm);
  white-space: pre-wrap;
  word-break: break-word;
}

/* Deployment Info */
.deployment-info {
  padding: var(--spacing-lg);
  background: var(--color-gray-50);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-2xl);
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
}

.info-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-gray-700);
}

.info-value {
  color: var(--color-gray-900);
  font-family: 'Courier New', monospace;
}

/* Rollback Info */
.rollback-info {
  padding: var(--spacing-lg);
  background: #e0f2fe;
  border: 2px solid var(--color-info);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-2xl);
}

.rollback-info h3 {
  margin-bottom: var(--spacing-sm);
  color: var(--color-info);
}

.rollback-info p {
  margin: 0;
  color: var(--color-gray-700);
}

/* Common Issues */
.common-issues {
  margin-bottom: var(--spacing-2xl);
}

.common-issues h3 {
  margin-bottom: var(--spacing-md);
  color: var(--color-gray-900);
}

.issue-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.issue-item {
  padding: var(--spacing-md);
  background: var(--color-gray-50);
  border-left: 4px solid var(--color-warning);
  border-radius: var(--radius-md);
}

.issue-title {
  font-weight: var(--font-weight-semibold);
  color: var(--color-gray-900);
  margin-bottom: var(--spacing-xs);
}

.issue-solution {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

/* Logs Section */
.logs-section {
  margin-bottom: var(--spacing-2xl);
}

.logs-section h3 {
  margin-bottom: var(--spacing-md);
  color: var(--color-gray-900);
}

/* Actions */
.actions-section {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: var(--spacing-lg);
}

/* Support Info */
.support-info {
  text-align: center;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-gray-200);
}

.support-info p {
  margin: 0;
  color: var(--color-gray-600);
}

.support-info a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
}

.support-info a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .error-card {
    padding: var(--spacing-xl);
  }

  .info-row {
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .actions-section {
    flex-direction: column;
  }

  .actions-section .btn {
    width: 100%;
  }
}
</style>
