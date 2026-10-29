// System settings and management routes — extracted from src/index.ts
// Fine-grained system administration endpoints

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { jwtAuth, requireAdmin } from '../middleware/auth';
import {
  getSystemInfo,
  getSettings,
  updateSettings,
  testIntegration,
  getMetrics,
  healthCheck,
  getApiStatus
} from '@modules/system/handlers/system-legacy';

const router = new Hono<{ Bindings: Bindings }>();

// Authenticated system management routes
router.get('/info', jwtAuth, getSystemInfo);
router.get('/settings', jwtAuth, getSettings);
router.put('/settings', jwtAuth, requireAdmin(), updateSettings);
router.post('/integrations/:platform/test', jwtAuth, requireAdmin(), testIntegration);
router.get('/metrics', jwtAuth, getMetrics);

// Public system endpoints (no auth)
router.get('/health', healthCheck);

// Admin-only: fans out to LINE/FB APIs (cached 60 s in KV)
router.get('/api-status', jwtAuth, requireAdmin(), getApiStatus);

export default router;
