<template>
  <div class="success-page">
    <div class="container container-lg">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner-lg"></div>
        <p>Loading deployment results...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="loadError" class="error-state">
        <div class="error-card">
          <div class="error-icon"></div>
          <h2>Unable to Load Deployment Data</h2>
          <p class="error-message">{{ loadError }}</p>
          <div class="error-actions">
            <button @click="retryLoad" class="btn btn-primary">
               Retry
            </button>
            <button @click="goToLanding" class="btn btn-secondary">
              ← Back to Home
            </button>
          </div>
        </div>
      </div>

      <!-- Success Content -->
      <template v-else>
      <!-- Success Animation -->
      <div class="success-animation">
        <div class="success-checkmark">
          <div class="check-icon">
            <span class="icon-line line-tip"></span>
            <span class="icon-line line-long"></span>
            <div class="icon-circle"></div>
            <div class="icon-fix"></div>
          </div>
        </div>
        <h1 class="success-title"> Deployment Successful!</h1>
        <p class="success-subtitle">
          Your Multi-Channel CRM is now live and ready to use
        </p>
      </div>

      <!-- Credentials Box -->
      <div v-if="credentials" class="credentials-section">
        <CredentialsBox :credentials="credentials" />
      </div>

      <!-- Quick Start Guide -->
      <div class="guide-section">
        <h2> Quick Start Guide</h2>
        <div class="steps-list">
          <div class="guide-step">
            <div class="guide-step-number">1</div>
            <div class="guide-step-content">
              <h3>Access Your CRM</h3>
              <p>Click the button below to open your CRM dashboard</p>
              <a
                v-if="resources.pagesUrl"
                :href="resources.pagesUrl"
                target="_blank"
                class="btn btn-primary"
              >
                 Open CRM Dashboard
              </a>
            </div>
          </div>

          <div class="guide-step">
            <div class="guide-step-number">2</div>
            <div class="guide-step-content">
              <h3>Login with Admin Credentials</h3>
              <p>Use the username and password shown above to login</p>
            </div>
          </div>

          <div class="guide-step">
            <div class="guide-step-number">3</div>
            <div class="guide-step-content">
              <h3>Connect LINE OA</h3>
              <p>
                Go to Settings → Integrations and connect your LINE Official Account webhook
              </p>
            </div>
          </div>

          <div class="guide-step">
            <div class="guide-step-number">4</div>
            <div class="guide-step-content">
              <h3>Start Managing Conversations</h3>
              <p>
                Your CRM is now ready to receive and manage customer messages from LINE
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Resources Summary -->
      <div class="resources-summary">
        <h2> Deployed Resources</h2>
        <div class="resources-table">
          <div v-if="resources.workerUrl" class="resource-row">
            <span class="resource-name">Backend API (Worker)</span>
            <a :href="resources.workerUrl" target="_blank" class="resource-url">
              {{ resources.workerUrl }}
            </a>
          </div>
          <div v-if="resources.pagesUrl" class="resource-row">
            <span class="resource-name">Frontend Dashboard (Pages)</span>
            <a :href="resources.pagesUrl" target="_blank" class="resource-url">
              {{ resources.pagesUrl }}
            </a>
          </div>
          <div v-if="resources.customDomain" class="resource-row">
            <span class="resource-name">Custom Domain</span>
            <span class="resource-url">{{ resources.customDomain }}</span>
          </div>
          <div v-if="resources.d1DatabaseId" class="resource-row">
            <span class="resource-name">D1 Database</span>
            <span class="resource-id">{{ resources.d1DatabaseId }}</span>
          </div>
          <div v-if="resources.r2BucketName" class="resource-row">
            <span class="resource-name">R2 Storage Bucket</span>
            <span class="resource-id">{{ resources.r2BucketName }}</span>
          </div>
        </div>
      </div>

      <!-- Deployment Stats -->
      <div class="stats-section">
        <div class="stat-item">
          <div class="stat-icon"></div>
          <div class="stat-content">
            <div class="stat-value">{{ formatDuration(deploymentStore.duration) }}</div>
            <div class="stat-label">Deployment Time</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon"></div>
          <div class="stat-content">
            <div class="stat-value">15/15</div>
            <div class="stat-label">Steps Completed</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon"></div>
          <div class="stat-content">
            <div class="stat-value">100%</div>
            <div class="stat-label">Success Rate</div>
          </div>
        </div>
      </div>

      <!-- Next Steps -->
      <div class="next-steps">
        <h2> What's Next?</h2>
        <div class="next-steps-grid">
          <div class="next-step-card">
            <div class="next-step-icon"></div>
            <h3>Read Documentation</h3>
            <p>Learn about features, configuration, and best practices</p>
            <a href="https://docs.yourcompany.com" target="_blank" class="btn btn-secondary btn-sm">
              View Docs
            </a>
          </div>
          <div class="next-step-card">
            <div class="next-step-icon"></div>
            <h3>Join Community</h3>
            <p>Get help and share experiences with other users</p>
            <a href="https://discord.gg/yourcompany" target="_blank" class="btn btn-secondary btn-sm">
              Join Discord
            </a>
          </div>
          <div class="next-step-card">
            <div class="next-step-icon"></div>
            <h3>Report Issues</h3>
            <p>Found a bug or have a feature request?</p>
            <a href="https://github.com/yourcompany/crm/issues" target="_blank" class="btn btn-secondary btn-sm">
              GitHub Issues
            </a>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="actions-section">
        <button @click="goToLanding" class="btn btn-secondary">
          ← Back to Home
        </button>
        <a
          v-if="resources.pagesUrl"
          :href="resources.pagesUrl"
          target="_blank"
          class="btn btn-primary btn-lg"
        >
           Launch CRM Dashboard
        </a>
      </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDeploymentStore } from '@/stores/deploymentStore';
import CredentialsBox from '@/components/CredentialsBox.vue';
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
const loadError = ref<string | null>(null);
const isLoading = ref(true);

// Read directly from store — no redundant local copies
const credentials = computed(() => deploymentStore.credentials);
const resources = computed(() => deploymentStore.resources);

// ========================================
// LIFECYCLE
// ========================================

onMounted(async () => {
  projectName.value = route.params.projectName as string;
  await loadDeploymentData();
});

// ========================================
// METHODS
// ========================================

/**
 * Fetch deployment data from the backend and validate required fields.
 * Shared by onMounted and retryLoad.
 */
async function loadDeploymentData(): Promise<void> {
  isLoading.value = true;
  loadError.value = null;

  try {
    if (!deploymentStore.credentials) {
      await deploymentStore.fetchDeploymentStatus(projectName.value);
    }

    // Validate required data
    if (!credentials.value || !resources.value.pagesUrl) {
      loadError.value = 'Deployment data could not be loaded. The deployment session may have expired. You can try refreshing or return to the home page.';
    }
  } catch (error) {
    console.error('Failed to load deployment data:', error);
    loadError.value = 'Failed to connect to the deployment server. Please check your network connection and try again.';
  } finally {
    isLoading.value = false;
  }
}

async function retryLoad(): Promise<void> {
  // Force re-fetch on retry
  await deploymentStore.fetchDeploymentStatus(projectName.value).catch(() => {});
  await loadDeploymentData();
}

function goToLanding(): void {
  deploymentStore.resetState();
  router.push({ name: 'landing' });
}
</script>

<style scoped>
.success-page {
  min-height: 100vh;
  padding: var(--spacing-2xl) 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: white;
  gap: var(--spacing-lg);
  font-size: var(--font-size-lg);
}

/* Error State */
.error-state {
  display: flex;
  justify-content: center;
  min-height: 400px;
  align-items: center;
}

.error-card {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--spacing-3xl);
  text-align: center;
  max-width: 500px;
  width: 100%;
  box-shadow: var(--shadow-xl);
}

.error-icon {
  font-size: 4rem;
  margin-bottom: var(--spacing-lg);
}

.error-card h2 {
  color: var(--color-gray-900);
  margin-bottom: var(--spacing-md);
}

.error-message {
  color: var(--color-gray-600);
  margin-bottom: var(--spacing-xl);
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
}

/* Success Animation */
.success-animation {
  text-align: center;
  margin-bottom: var(--spacing-3xl);
}

.success-checkmark {
  width: 120px;
  height: 120px;
  margin: 0 auto var(--spacing-xl);
  border-radius: 50%;
  display: block;
  stroke-width: 3;
  stroke: #10b981;
  stroke-miterlimit: 10;
  box-shadow: inset 0px 0px 0px #10b981;
  animation: fill 0.4s ease-in-out 0.4s forwards, scale 0.3s ease-in-out 0.9s both;
  position: relative;
}

.check-icon {
  width: 120px;
  height: 120px;
  position: relative;
  border-radius: 50%;
  box-sizing: content-box;
  border: 4px solid #10b981;
  background: white;
}

.icon-line {
  height: 5px;
  background-color: #10b981;
  display: block;
  border-radius: 2px;
  position: absolute;
  z-index: 10;
}

.icon-line.line-tip {
  top: 58px;
  left: 25px;
  width: 35px;
  transform: rotate(45deg);
  animation: icon-line-tip 0.75s;
}

.icon-line.line-long {
  top: 50px;
  right: 15px;
  width: 70px;
  transform: rotate(-45deg);
  animation: icon-line-long 0.75s;
}

@keyframes icon-line-tip {
  0% {
    width: 0;
    left: 1px;
    top: 19px;
  }
  54% {
    width: 0;
    left: 1px;
    top: 19px;
  }
  70% {
    width: 50px;
    left: -8px;
    top: 37px;
  }
  84% {
    width: 17px;
    left: 21px;
    top: 48px;
  }
  100% {
    width: 35px;
    left: 25px;
    top: 58px;
  }
}

@keyframes icon-line-long {
  0% {
    width: 0;
    right: 46px;
    top: 54px;
  }
  65% {
    width: 0;
    right: 46px;
    top: 54px;
  }
  84% {
    width: 55px;
    right: 0px;
    top: 35px;
  }
  100% {
    width: 70px;
    right: 15px;
    top: 50px;
  }
}

.success-title {
  font-size: var(--font-size-4xl);
  color: white;
  margin-bottom: var(--spacing-sm);
}

.success-subtitle {
  font-size: var(--font-size-xl);
  color: rgba(255, 255, 255, 0.9);
}

/* Credentials Section */
.credentials-section {
  margin-bottom: var(--spacing-3xl);
}

/* Guide Section */
.guide-section {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--spacing-2xl);
  margin-bottom: var(--spacing-2xl);
}

.guide-section h2 {
  margin-bottom: var(--spacing-xl);
  color: var(--color-gray-900);
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.guide-step {
  display: flex;
  gap: var(--spacing-lg);
}

.guide-step-number {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: white;
  border-radius: 50%;
  font-weight: var(--font-weight-bold);
}

.guide-step-content h3 {
  margin-bottom: var(--spacing-sm);
  color: var(--color-gray-900);
}

.guide-step-content p {
  margin-bottom: var(--spacing-md);
  color: var(--color-gray-600);
}

/* Resources Summary */
.resources-summary {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--spacing-2xl);
  margin-bottom: var(--spacing-2xl);
}

.resources-summary h2 {
  margin-bottom: var(--spacing-lg);
  color: var(--color-gray-900);
}

.resources-table {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.resource-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--color-gray-50);
  border-radius: var(--radius-md);
}

.resource-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-gray-700);
}

.resource-url,
.resource-id {
  color: var(--color-primary);
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-sm);
  text-align: right;
}

.resource-url {
  text-decoration: none;
}

.resource-url:hover {
  text-decoration: underline;
}

/* Stats Section */
.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.stat-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: white;
  border-radius: var(--radius-lg);
  align-items: center;
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

/* Next Steps */
.next-steps {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--spacing-2xl);
  margin-bottom: var(--spacing-2xl);
}

.next-steps h2 {
  margin-bottom: var(--spacing-xl);
  color: var(--color-gray-900);
}

.next-steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-lg);
}

.next-step-card {
  text-align: center;
  padding: var(--spacing-xl);
  border: 2px solid var(--color-gray-200);
  border-radius: var(--radius-lg);
}

.next-step-icon {
  font-size: 3rem;
  margin-bottom: var(--spacing-md);
}

.next-step-card h3 {
  margin-bottom: var(--spacing-sm);
  color: var(--color-gray-900);
}

.next-step-card p {
  margin-bottom: var(--spacing-md);
  color: var(--color-gray-600);
}

/* Actions */
.actions-section {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
}

@media (max-width: 768px) {
  .resource-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }

  .resource-url,
  .resource-id {
    text-align: left;
    word-break: break-all;
  }

  .stats-section {
    grid-template-columns: 1fr;
  }

  .next-steps-grid {
    grid-template-columns: 1fr;
  }

  .actions-section {
    flex-direction: column;
  }
}
</style>
