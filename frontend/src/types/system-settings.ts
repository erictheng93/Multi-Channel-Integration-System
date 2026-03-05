/**
 * System Settings Type Definitions
 *
 * Complete type definitions for SystemSettings component refactoring
 * Includes all settings, integrations, backups, and UI state types
 */

import type { Component, InjectionKey } from 'vue'
import type { useSystemSettingsController } from '@/composables/useSystemSettingsController'

// ============================================================================
// Settings Data Types
// ============================================================================

/**
 * General system settings
 */
export interface GeneralSettings {
  systemName: string
  contactEmail: string
  timezone: string
  language: string
}

/**
 * LINE integration configuration
 */
export interface LineIntegration {
  channelId: string
  channelSecret: string
  accessToken: string
  status: IntegrationStatus
}

/**
 * Facebook integration configuration
 */
export interface FacebookIntegration {
  appId: string
  appSecret: string
  pageId: string
  pageToken: string
  status: IntegrationStatus
}

/**
 * All integration settings
 */
export interface IntegrationSettings {
  line: LineIntegration
  facebook: FacebookIntegration
}

/**
 * Advanced system configuration
 */
export interface AdvancedSettings {
  messageQueueSize: number
  messageTimeout: number
  cacheExpiry: number
  sessionExpiry: number
  enableRateLimit: boolean
  enableLogging: boolean
  enableMetrics: boolean
}

/**
 * Complete system settings
 */
export interface SystemSettings {
  general: GeneralSettings
  integrations: IntegrationSettings
  advanced: AdvancedSettings
}

// ============================================================================
// Status and State Types
// ============================================================================

/**
 * Integration connection status
 */
export type IntegrationStatus = 'connected' | 'disconnected' | 'error'

/**
 * Settings tab identifiers
 */
export type SettingsTab = 'general' | 'integrations' | 'advanced' | 'system'

/**
 * Message types for user feedback
 */
export type MessageType = 'success' | 'error' | 'info'

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Settings API response
 */
export interface SettingsResponse {
  success: boolean
  data?: Partial<SystemSettings>
  message?: string
}

/**
 * Credentials API response
 */
export interface CredentialsResponse {
  success: boolean
  data?: {
    line?: Partial<LineIntegration>
    facebook?: Partial<FacebookIntegration>
  }
  message?: string
}

/**
 * Integration test result
 */
export interface IntegrationTestResult {
  success: boolean
  status: IntegrationStatus
  message: string
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  success: boolean
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    database: boolean
    cache: boolean
    queue: boolean
    integrations: boolean
  }
  message?: string
}

// ============================================================================
// UI Configuration Types
// ============================================================================

/**
 * Tab configuration
 */
export interface TabConfig {
  key: SettingsTab
  label: string
  icon: Component
}

/**
 * Integration status class names
 */
export interface StatusClasses {
  'status-connected': boolean
  'status-disconnected': boolean
  'status-error': boolean
}

// ============================================================================
// Form Data Types
// ============================================================================

/**
 * General settings form data
 */
export interface GeneralSettingsFormData {
  systemName: string
  contactEmail: string
  timezone: string
  language: string
}

/**
 * LINE integration form data
 */
export interface LineIntegrationFormData {
  channelId: string
  channelSecret: string
  accessToken: string
}

/**
 * Facebook integration form data
 */
export interface FacebookIntegrationFormData {
  appId: string
  appSecret: string
  pageId: string
  pageToken: string
}

/**
 * Advanced settings form data
 */
export interface AdvancedSettingsFormData {
  messageQueueSize: number
  messageTimeout: number
  cacheExpiry: number
  sessionExpiry: number
  enableRateLimit: boolean
  enableLogging: boolean
  enableMetrics: boolean
}

// ============================================================================
// Controller State Types
// ============================================================================

/**
 * Controller state interface
 */
export interface SystemSettingsState {
  loading: boolean
  saving: boolean
  testing: boolean
  processing: boolean
  activeTab: SettingsTab
  message: string
  messageType: MessageType
  settings: SystemSettings
}

// ============================================================================
// Event Payload Types
// ============================================================================

/**
 * Save settings event payload
 */
export interface SaveSettingsPayload {
  type: 'general' | 'line' | 'facebook' | 'advanced'
  data: GeneralSettingsFormData | LineIntegrationFormData | FacebookIntegrationFormData | AdvancedSettingsFormData
}

/**
 * Test integration event payload
 */
export interface TestIntegrationPayload {
  platform: 'line' | 'facebook'
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Timezone display format
 */
export interface TimezoneDisplay {
  value: string
  label: string
  offset: string
}

/**
 * File size formatted
 */
export interface FormattedFileSize {
  value: number
  unit: 'B' | 'KB' | 'MB' | 'GB'
  display: string
}

// ============================================================================
// Controller Injection Types
// ============================================================================

/**
 * Return type of useSystemSettingsController composable
 */
export type SystemSettingsController = ReturnType<typeof useSystemSettingsController>

/**
 * InjectionKey for sharing the settings controller across route children
 */
export const SETTINGS_CONTROLLER_KEY: InjectionKey<SystemSettingsController> = Symbol('settingsController')

// ============================================================================
// Note: All types are already exported individually above
// No need for re-export block
// ============================================================================
