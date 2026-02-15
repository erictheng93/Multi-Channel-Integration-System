// System settings and management routes — extracted from src/index.ts
// Fine-grained system administration endpoints

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { jwtAuth } from '../middleware/auth';
import {
  getSystemInfo,
  getSettings,
  updateSettings,
  testIntegration,
  getMetrics,
  backupDatabase,
  getBackups,
  restoreDatabase,
  clearCache,
  restartSystem,
  healthCheck,
  getApiStatus
} from '@modules/system/handlers/system-legacy';

const router = new Hono<{ Bindings: Bindings }>();

// Authenticated system management routes
router.get('/info', jwtAuth, getSystemInfo);
router.get('/settings', jwtAuth, getSettings);
router.put('/settings', jwtAuth, updateSettings);
router.post('/integrations/:platform/test', jwtAuth, testIntegration);
router.get('/metrics', jwtAuth, getMetrics);
router.post('/database/backup', jwtAuth, backupDatabase);
router.get('/database/backups', jwtAuth, getBackups);
router.post('/database/restore/:backupId', jwtAuth, restoreDatabase);
router.post('/cache/clear', jwtAuth, clearCache);
router.post('/restart', jwtAuth, restartSystem);

// Public system endpoints (no auth)
router.get('/health', healthCheck);
router.get('/api-status', getApiStatus);

export default router;
