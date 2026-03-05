// Barrel re-export for backward compatibility
// All 12 public handler functions split into focused modules:
//   system-settings.ts    — getSystemInfo, getSettings, updateSettings, getMetrics
//   system-integrations.ts — testIntegration (+ private LINE/Facebook test helpers)
//   system-database.ts    — backupDatabase, getBackups, restoreDatabase
//   system-health.ts      — healthCheck, getApiStatus
//   system-crypto-utils.ts — shared decrypt/encryption helpers

export { getSystemInfo, getSettings, updateSettings, getMetrics } from './system-settings';
export { testIntegration } from './system-integrations';
export { backupDatabase, getBackups, restoreDatabase } from './system-database';
export { healthCheck, getApiStatus } from './system-health';
