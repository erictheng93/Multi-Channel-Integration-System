/**
 * System Settings Components
 *
 * Barrel export for all system settings related components
 * Part of SystemSettings.vue refactoring
 */

// Core form components (existing)
export { default as SettingsHeader } from './SettingsHeader.vue'
export { default as SettingsNav } from './SettingsNav.vue'
export { default as GeneralSettingsForm } from './GeneralSettingsForm.vue'
export { default as LineIntegrationForm } from './LineIntegrationForm.vue'
export { default as FacebookIntegrationForm } from './FacebookIntegrationForm.vue'
export { default as AdvancedSettingsForm } from './AdvancedSettingsForm.vue'

// Sidebar navigation
export { default as SettingsSidebar } from './SettingsSidebar.vue'

// Page wrappers (for nested routes)
export {
  GeneralSettingsPage,
  LineIntegrationPage,
  FacebookIntegrationPage,
  AdvancedSettingsPage,
  SystemHealthPage
} from './pages'
