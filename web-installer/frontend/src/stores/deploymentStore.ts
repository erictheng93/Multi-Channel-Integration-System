/**
 * Deployment Store - Pinia State Management
 *
 * Manages deployment state, SSE connection, and real-time updates
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { deploymentAPI } from '@/api/installer';
import type {
  DeploymentConfig,
  DeploymentState,
  DeploymentStatus,
  CloudflareResources,
  LogEntry,
  AdminCredentials,
  SSEEvent,
  ProgressEventData,
  LogEventData,
  ErrorEventData,
  CompleteEventData
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

  // SSE connection
  const eventSource = ref<EventSource | null>(null);

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
    return Math.floor((endTime - startedAt.value) / 1000); // seconds
  });

  const hasResources = computed(() => Object.keys(resources.value).length > 0);

  // ========================================
  // ACTIONS
  // ========================================

  /**
   * Start a new deployment
   */
  async function startDeployment(config: DeploymentConfig): Promise<void> {
    try {
      // Reset state
      resetState();
      projectName.value = config.projectName;
      status.value = 'in_progress';
      startedAt.value = Date.now();

      // Call API to start deployment
      const response = await deploymentAPI.startDeployment(config);
      deploymentId.value = response.deploymentId;

      // Connect to SSE stream for real-time updates
      connectToEventStream(config.projectName);

      addLog('info', 'Deployment started successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start deployment';
      error.value = errorMessage;
      status.value = 'failed';
      addLog('error', errorMessage);
      throw err;
    }
  }

  /**
   * Cancel ongoing deployment
   */
  async function cancelDeployment(): Promise<void> {
    if (!projectName.value) {
      throw new Error('No active deployment to cancel');
    }

    try {
      await deploymentAPI.cancelDeployment(projectName.value);
      status.value = 'cancelled';
      disconnectEventStream();
      addLog('warning', 'Deployment cancelled by user');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel deployment';
      error.value = errorMessage;
      addLog('error', errorMessage);
      throw err;
    }
  }

  /**
   * Fetch current deployment status
   */
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
      logs.value = response.logs;

      if (response.error) {
        error.value = response.error;
      }

      if (response.credentials) {
        credentials.value = response.credentials;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch deployment status';
      error.value = errorMessage;
      throw err;
    }
  }

  /**
   * Connect to SSE event stream for real-time updates
   */
  function connectToEventStream(name: string): void {
    // Close existing connection if any
    disconnectEventStream();

    const url = deploymentAPI.getEventStreamUrl(name);
    eventSource.value = new EventSource(url);

    eventSource.value.onmessage = (event) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);
        handleSSEEvent(sseEvent);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.value.onerror = (err) => {
      console.error('SSE connection error:', err);
      addLog('error', 'Lost connection to deployment server');

      // Auto-reconnect if deployment is still in progress
      if (status.value === 'in_progress') {
        setTimeout(() => {
          if (status.value === 'in_progress') {
            connectToEventStream(name);
          }
        }, 5000);
      }
    };

    addLog('info', 'Connected to deployment stream');
  }

  /**
   * Disconnect from SSE event stream
   */
  function disconnectEventStream(): void {
    if (eventSource.value) {
      eventSource.value.close();
      eventSource.value = null;
    }
  }

  /**
   * Handle incoming SSE events
   */
  function handleSSEEvent(event: SSEEvent): void {
    switch (event.type) {
      case 'progress':
        handleProgressEvent(event.data as ProgressEventData);
        break;
      case 'log':
        handleLogEvent(event.data as LogEventData);
        break;
      case 'error':
        handleErrorEvent(event.data as ErrorEventData);
        break;
      case 'complete':
        handleCompleteEvent(event.data as CompleteEventData);
        break;
      case 'cancelled':
        status.value = 'cancelled';
        disconnectEventStream();
        addLog('warning', 'Deployment was cancelled');
        break;
    }
  }

  function handleProgressEvent(data: ProgressEventData): void {
    currentStep.value = data.step;
    currentStepProgress.value = data.stepProgress;
    totalProgress.value = data.totalProgress;
  }

  function handleLogEvent(data: LogEventData): void {
    addLog(data.level, data.message, data.step);
  }

  function handleErrorEvent(data: ErrorEventData): void {
    error.value = data.error;
    status.value = 'failed';
    completedAt.value = Date.now();
    disconnectEventStream();
    addLog('error', data.error, data.step);
  }

  function handleCompleteEvent(data: CompleteEventData): void {
    status.value = 'completed';
    completedAt.value = Date.now();
    resources.value = data.resources;
    credentials.value = data.credentials;
    disconnectEventStream();
    addLog('success', `Deployment completed successfully in ${data.duration}s`);
  }

  /**
   * Add log entry
   */
  function addLog(level: LogEntry['level'], message: string, step?: string): void {
    logs.value.push({
      timestamp: Date.now(),
      level,
      message,
      step: step as any
    });

    // Keep only last 500 log entries to prevent memory issues
    if (logs.value.length > 500) {
      logs.value = logs.value.slice(-500);
    }
  }

  /**
   * Reset deployment state
   */
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
    credentials.value = null;
    startedAt.value = 0;
    completedAt.value = null;
    disconnectEventStream();
  }

  // ========================================
  // LIFECYCLE
  // ========================================

  // Auto-cleanup on store disposal
  function $dispose(): void {
    disconnectEventStream();
  }

  return {
    // State
    projectName,
    deploymentId,
    status,
    currentStep,
    currentStepProgress,
    totalProgress,
    error,
    resources,
    logs,
    credentials,
    startedAt,
    completedAt,

    // Computed
    isDeploying,
    isCompleted,
    isFailed,
    isCancelled,
    duration,
    hasResources,

    // Actions
    startDeployment,
    cancelDeployment,
    fetchDeploymentStatus,
    connectToEventStream,
    disconnectEventStream,
    addLog,
    resetState,
    $dispose
  };
});
