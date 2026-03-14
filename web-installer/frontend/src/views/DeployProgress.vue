<template>
  <div class="deploy-progress-page">
    <div class="container container-lg">
      <div class="progress-card">
        <!-- Header -->
        <div class="progress-header">
          <h1>
            <span v-if="!deploymentStore.isCompleted && !deploymentStore.isFailed">
               Deploying {{ projectName }}
            </span>
            <span v-else-if="deploymentStore.isCompleted">
               Deployment Complete!
            </span>
            <span v-else-if="deploymentStore.isFailed">
               Deployment Failed
            </span>
          </h1>
          <p v-if="deploymentStore.isDeploying" class="progress-subtitle">
            This usually takes 2-3 minutes. Please don't close this page.
          </p>
        </div>

        <!-- Overall Progress -->
        <div class="progress-section">
          <ProgressBar
            :progress="deploymentStore.totalProgress"
            :label="`Overall Progress: ${deploymentStore.currentStep || 'Starting...'}`"
            :step-text="currentStepText"
            :is-complete="deploymentStore.isCompleted"
            :has-error="deploymentStore.isFailed"
          />
        </div>

        <!-- Deployment Steps -->
        <div class="steps-section">
          <h2>Deployment Steps</h2>
          <div class="steps-grid">
            <div
              v-for="step in deploymentSteps"
              :key="step.key"
              class="step-item"
              :class="{
                'step-completed': isStepCompleted(step.key),
                'step-current': deploymentStore.currentStep === step.key,
                'step-pending': isStepPending(step.key)
              }"
            >
              <div class="step-icon">
                <span v-if="isStepCompleted(step.key)"></span>
                <span v-else-if="deploymentStore.currentStep === step.key" class="spinner"></span>
                <span v-else>{{ step.number }}</span>
              </div>
              <div class="step-content">
                <div class="step-name">{{ step.name }}</div>
                <div class="step-description">{{ step.description }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Logs Console -->
        <div class="logs-section">
          <LogConsole :logs="deploymentStore.logs" @clear="deploymentStore.logs = []" />
        </div>

        <!-- Resources (if available) -->
        <div v-if="deploymentStore.hasResources" class="resources-section">
          <h2> Provisioned Resources</h2>
          <div class="resources-grid">
            <div v-if="deploymentStore.resources.workerUrl" class="resource-item">
              <span class="resource-label">Worker URL:</span>
              <a
                :href="deploymentStore.resources.workerUrl"
                target="_blank"
                class="resource-link"
              >
                {{ deploymentStore.resources.workerUrl }}
              </a>
            </div>
            <div v-if="deploymentStore.resources.pagesUrl" class="resource-item">
              <span class="resource-label">Frontend URL:</span>
              <a
                :href="deploymentStore.resources.pagesUrl"
                target="_blank"
                class="resource-link"
              >
                {{ deploymentStore.resources.pagesUrl }}
              </a>
            </div>
            <div v-if="deploymentStore.resources.customDomain" class="resource-item">
              <span class="resource-label">Custom Domain:</span>
              <span class="resource-value">{{ deploymentStore.resources.customDomain }}</span>
            </div>
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="deploymentStore.error" class="error-section">
          <h2> Error Details</h2>
          <div class="error-box">
            <p>{{ deploymentStore.error }}</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions-section">
          <button
            v-if="deploymentStore.isDeploying"
            @click="handleCancel"
            class="btn btn-danger"
            :disabled="isCancelling"
          >
            <span v-if="!isCancelling">Cancel Deployment</span>
            <span v-else>
              <span class="spinner"></span> Cancelling...
            </span>
          </button>

          <button
            v-if="deploymentStore.isCompleted"
            @click="goToSuccess"
            class="btn btn-primary btn-lg"
          >
            View Credentials & Continue →
          </button>

          <button
            v-if="deploymentStore.isFailed"
            @click="goToError"
            class="btn btn-secondary"
          >
            View Error Details
          </button>

          <button
            v-if="deploymentStore.isFailed"
            @click="goBack"
            class="btn btn-primary"
          >
            ← Try Again
          </button>
        </div>

        <!-- Duration -->
        <div v-if="deploymentStore.duration > 0" class="duration-info">
           Time elapsed: {{ formatDuration(deploymentStore.duration) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDeploymentStore } from '@/stores/deploymentStore';
import ProgressBar from '@/components/ProgressBar.vue';
import LogConsole from '@/components/LogConsole.vue';
import { formatDuration } from '@/utils/format';

// ========================================
// COMPOSABLES
// ========================================

const router = useRouter();
const route = useRoute();
const deploymentStore = useDeploymentStore();

// ========================================
// STATE
// ========================================

const projectName = ref<string>('');
const isCancelling = ref(false);

// Deployment step definitions
const deploymentSteps = [
  { key: 'initialize', number: 1, name: 'Initialize', description: 'Setting up deployment' },
  { key: 'create_d1', number: 2, name: 'D1 Database', description: 'Creating SQLite database' },
  { key: 'create_kv_session', number: 3, name: 'KV Session', description: 'Creating session storage' },
  { key: 'create_kv_cache', number: 4, name: 'KV Cache', description: 'Creating cache storage' },
  { key: 'create_r2', number: 5, name: 'R2 Bucket', description: 'Creating file storage' },
  { key: 'create_queue', number: 6, name: 'Queue', description: 'Creating message queue' },
  { key: 'run_migrations', number: 7, name: 'Migrations', description: 'Running database migrations' },
  { key: 'generate_config', number: 8, name: 'Configuration', description: 'Generating wrangler.toml' },
  { key: 'deploy_worker', number: 9, name: 'Worker', description: 'Deploying backend API' },
  { key: 'build_frontend', number: 10, name: 'Build Frontend', description: 'Building Vue application' },
  { key: 'deploy_pages', number: 11, name: 'Pages', description: 'Deploying frontend' },
  { key: 'configure_domain', number: 12, name: 'Domain', description: 'Configuring custom domain' },
  { key: 'create_admin', number: 13, name: 'Admin User', description: 'Creating admin account' },
  { key: 'verify_health', number: 14, name: 'Health Check', description: 'Verifying deployment' },
  { key: 'complete', number: 15, name: 'Complete', description: 'Finishing up' }
];

// ========================================
// COMPUTED
// ========================================

const currentStepText = computed(() => {
  if (!deploymentStore.currentStep) return '';
  const step = deploymentSteps.find((s) => s.key === deploymentStore.currentStep);
  return step ? step.description : '';
});

// ========================================
// LIFECYCLE
// ========================================

onMounted(() => {
  projectName.value = route.params.projectName as string;

  // If no active deployment, try to fetch status
  if (deploymentStore.status === 'idle') {
    deploymentStore.fetchDeploymentStatus(projectName.value).catch((error) => {
      console.error('Failed to fetch deployment status:', error);
      router.push({ name: 'landing' });
    });
  }
});

onUnmounted(() => {
  // Polling continues in store until deployment completes
});

// ========================================
// METHODS
// ========================================

function isStepCompleted(stepKey: string): boolean {
  if (!deploymentStore.currentStep) return false;
  const currentIndex = deploymentSteps.findIndex((s) => s.key === deploymentStore.currentStep);
  const stepIndex = deploymentSteps.findIndex((s) => s.key === stepKey);
  return stepIndex < currentIndex || deploymentStore.isCompleted;
}

function isStepPending(stepKey: string): boolean {
  if (!deploymentStore.currentStep) return true;
  const currentIndex = deploymentSteps.findIndex((s) => s.key === deploymentStore.currentStep);
  const stepIndex = deploymentSteps.findIndex((s) => s.key === stepKey);
  return stepIndex > currentIndex;
}

async function handleCancel(): Promise<void> {
  if (!confirm('Are you sure you want to cancel this deployment?')) {
    return;
  }

  isCancelling.value = true;

  try {
    await deploymentStore.cancelDeployment();
    alert('Deployment cancelled. Resources will be cleaned up automatically.');
    router.push({ name: 'landing' });
  } catch (error) {
    console.error('Failed to cancel deployment:', error);
    alert('Failed to cancel deployment. Please try again.');
    isCancelling.value = false;
  }
}

function goToSuccess(): void {
  router.push({ name: 'success', params: { projectName: projectName.value } });
}

function goToError(): void {
  router.push({ name: 'error' });
}

function goBack(): void {
  router.push({ name: 'configure' });
}
</script>

<style scoped>
.deploy-progress-page {
  min-height: 100vh;
  padding: var(--spacing-2xl) 0;
}

.progress-card {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--spacing-3xl);
  box-shadow: var(--shadow-xl);
}

.progress-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);
}

.progress-header h1 {
  margin-bottom: var(--spacing-sm);
  color: var(--color-gray-900);
}

.progress-subtitle {
  margin: 0;
  color: var(--color-gray-600);
  font-size: var(--font-size-base);
}

/* Progress Section */
.progress-section {
  margin-bottom: var(--spacing-2xl);
}

/* Steps Section */
.steps-section {
  margin-bottom: var(--spacing-2xl);
}

.steps-section h2 {
  margin-bottom: var(--spacing-lg);
  color: var(--color-gray-900);
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-md);
}

.step-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-gray-50);
  border: 2px solid var(--color-gray-200);
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.step-item.step-current {
  border-color: var(--color-primary);
  background: rgba(102, 126, 234, 0.05);
}

.step-item.step-completed {
  border-color: var(--color-success);
  background: rgba(16, 185, 129, 0.05);
}

.step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  font-weight: var(--font-weight-bold);
  border-radius: 50%;
  background: var(--color-gray-200);
  color: var(--color-gray-600);
}

.step-current .step-icon {
  background: var(--color-primary);
  color: white;
}

.step-completed .step-icon {
  background: var(--color-success);
  color: white;
}

.step-content {
  flex: 1;
}

.step-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-gray-900);
  margin-bottom: var(--spacing-xs);
}

.step-description {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

/* Logs Section */
.logs-section {
  margin-bottom: var(--spacing-2xl);
}

/* Resources Section */
.resources-section {
  margin-bottom: var(--spacing-2xl);
  padding: var(--spacing-xl);
  background: var(--color-gray-50);
  border-radius: var(--radius-lg);
}

.resources-section h2 {
  margin-bottom: var(--spacing-lg);
  color: var(--color-gray-900);
}

.resources-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.resource-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.resource-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-gray-700);
}

.resource-link {
  color: var(--color-primary);
  text-decoration: none;
  word-break: break-all;
}

.resource-link:hover {
  text-decoration: underline;
}

.resource-value {
  color: var(--color-gray-900);
  font-family: 'Courier New', monospace;
}

/* Error Section */
.error-section {
  margin-bottom: var(--spacing-2xl);
}

.error-box {
  padding: var(--spacing-lg);
  background: #fee;
  border: 2px solid var(--color-error);
  border-radius: var(--radius-md);
  color: var(--color-error);
}

/* Actions Section */
.actions-section {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
  flex-wrap: wrap;
}

/* Duration Info */
.duration-info {
  margin-top: var(--spacing-lg);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

@media (max-width: 768px) {
  .progress-card {
    padding: var(--spacing-xl);
  }

  .steps-grid {
    grid-template-columns: 1fr;
  }

  .actions-section {
    flex-direction: column;
  }

  .actions-section .btn {
    width: 100%;
  }
}
</style>
