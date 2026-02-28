/**
 * Deployment Store - Pinia State Management
 *
 * Manages deployment state via polling GET /status every 3 seconds.
 * Simple, reliable, works in all environments.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { deploymentAPI } from '@/api/installer';
import type {
  DeploymentConfig,
  DeploymentStatus,
  CloudflareResources,
  LogEntry,
  AdminCredentials
} from '@/types';

export const useDeploymentStore = defineStore('deployment', () => {
  // ========================================
  // STATE
  // ========================================

  const projectName = ref<string>('');
  const deploymentId = ref<string>('');
  const status = ref<DeploymentStatus>('idle');
  const currentStep = ref<string | null>(null);
  const currentStepProgress = ref<number>(0);
  const totalProgress = ref<number>(0);
  const error = ref<string | null>(null);
  const resources = ref<CloudflareResources>({});
  const logs = ref<LogEntry[]>([]);
  const credentials = ref<AdminCredentials | null>(null);
  const startedAt = ref<number>(0);
  const completedAt = ref<number | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  // ========================================
  // COMPUTED
  // ========================================

  const isDeploying = computed(() => status.value === 'in_progress');
  const isCompleted = computed(() => status.value === 'completed');
  const isFailed = computed(() => status.value === 'failed');
  const isCancelled = computed(() => status.value === 'cancelled');

  const duration = computed(() => {
    if (!startedAt.value) return 0;
    const endTime = completedAt.value || Date.now();
    return Math.floor((endTime - startedAt.value) / 1000);
  });

  const hasResources = computed(() => Object.keys(resources.value).length > 0);

  // ========================================
  // ACTIONS
  // ========================================

  async function startDeployment(config: DeploymentConfig): Promise<void> {
    try {
      resetState();
      projectName.value = config.projectName;
      status.value = 'in_progress';
      startedAt.value = Date.now();

      const response = await deploymentAPI.startDeployment(config);
      deploymentId.value = response.deploymentId;

      addLog('info', 'Deployment started successfully');

      // Start polling for progress updates
      startPolling(config.projectName);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start deployment';
      error.value = errorMessage;
      status.value = 'failed';
      addLog('error', errorMessage);
      throw err;
    }
  }

  async function cancelDeployment(): Promise<void> {
    if (!projectName.value) {
      throw new Error('No active deployment to cancel');
    }

    try {
      await deploymentAPI.cancelDeployment(projectName.value);
      status.value = 'cancelled';
      stopPolling();
      addLog('warning', 'Deployment cancelled by user');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel deployment';
      error.value = errorMessage;
      addLog('error', errorMessage);
      throw err;
    }
  }

  // ========================================
  // POLLING
  // ========================================

  function startPolling(name: string): void {
    stopPolling();

    // Immediate first poll
    fetchDeploymentStatus(name);

    pollTimer = setInterval(() => {
      if (status.value === 'in_progress') {
        fetchDeploymentStatus(name);
      } else {
        stopPolling();
      }
    }, 3000);
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function fetchDeploymentStatus(name: string): Promise<void> {
    try {
      const response = await deploymentAPI.getDeploymentStatus(name);

      projectName.value = name;
      deploymentId.value = response.deploymentId;
      status.value = response.status;
      currentStep.value = response.currentStep;
      currentStepProgress.value = response.currentStepProgress;
      totalProgress.value = response.totalProgress;
      resources.value = response.resources;

      // Merge backend logs (dedup by message)
      if (response.logs && response.logs.length > 0) {
        mergeLogs(response.logs);
      }

      if (response.error) {
        error.value = response.error;
      }

      if (response.credentials) {
        credentials.value = response.credentials;
      }

      // Terminal state — stop polling
      if (response.status === 'completed' || response.status === 'failed' || response.status === 'cancelled') {
        completedAt.value = completedAt.value || Date.now();
        stopPolling();

        if (response.status === 'completed') {
          addLog('success', 'Deployment completed successfully!');
        }
      }
    } catch (err) {
      console.warn('Poll failed:', err);
    }
  }

  // ========================================
  // UTILITIES
  // ========================================

  const MAX_LOG_ENTRIES = 500;

  /** Persistent set for O(1) dedup — rebuilt only on resetState() */
  const knownMessages = new Set<string>();

  function trimLogs(): void {
    if (logs.value.length > MAX_LOG_ENTRIES) {
      logs.value = logs.value.slice(-MAX_LOG_ENTRIES);
    }
  }

  function addLog(level: LogEntry['level'], message: string, step?: string): void {
    logs.value.push({
      timestamp: Date.now(),
      level,
      message,
      step: step as LogEntry['step']
    });
    knownMessages.add(message);
    trimLogs();
  }

  function mergeLogs(backendLogs: LogEntry[]): void {
    let added = 0;
    for (const log of backendLogs) {
      if (!knownMessages.has(log.message)) {
        logs.value.push(log);
        knownMessages.add(log.message);
        added++;
      }
    }

    // Only sort if new entries were added
    if (added > 0) {
      logs.value.sort((a, b) => a.timestamp - b.timestamp);
      trimLogs();
    }
  }

  function resetState(): void {
    projectName.value = '';
    deploymentId.value = '';
    status.value = 'idle';
    currentStep.value = null;
    currentStepProgress.value = 0;
    totalProgress.value = 0;
    error.value = null;
    resources.value = {};
    logs.value = [];
    knownMessages.clear();
    credentials.value = null;
    startedAt.value = 0;
    completedAt.value = null;
    stopPolling();
  }

  function $dispose(): void {
    stopPolling();
  }

  return {
    // State
    projectName, deploymentId, status, currentStep,
    currentStepProgress, totalProgress, error,
    resources, logs, credentials, startedAt, completedAt,

    // Computed
    isDeploying, isCompleted, isFailed, isCancelled, duration, hasResources,

    // Actions
    startDeployment, cancelDeployment, fetchDeploymentStatus,
    addLog, resetState, $dispose
  };
});
