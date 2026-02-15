// Queue monitoring routes — extracted from src/index.ts
// Unified queue stats, health, performance, and maintenance

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { jwtAuth } from '../middleware/auth';
import { queueMonitorHandler } from '@modules/queue/handlers/queue-monitor';

const router = new Hono<{ Bindings: Bindings }>();

router.get('/stats', jwtAuth, queueMonitorHandler.getUnifiedStats);
router.get('/health', jwtAuth, queueMonitorHandler.getHealthCheck);
router.get('/performance', jwtAuth, queueMonitorHandler.getPerformanceMetrics);
router.post('/maintenance', jwtAuth, queueMonitorHandler.maintenanceOperations);

export default router;
