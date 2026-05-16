// Realtime fine-grained routes — extracted from src/index.ts
// Typing status, broadcast, presence, monitoring dashboard

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { jwtAuth } from '../middleware/auth';
import { realtime } from '@modules/realtime';

const router = new Hono<{ Bindings: Bindings }>();

// Main realtime handler endpoints
router.post('/typing', jwtAuth, realtime.handlers.main.sendTypingStatus);
router.post('/broadcast', jwtAuth, realtime.handlers.main.broadcastToConversation);
router.get('/conversation/:id/status', jwtAuth, realtime.handlers.main.getConversationStatus);
router.post('/online-status', jwtAuth, realtime.handlers.main.updateOnlineStatus);

// Management endpoints
router.get('/config', jwtAuth, realtime.handlers.management.getConfig);
router.put('/config', jwtAuth, realtime.handlers.management.updateConfig);
router.get('/stats', jwtAuth, realtime.handlers.management.getStats);
router.get('/health', jwtAuth, realtime.handlers.management.healthCheck);

// Monitoring endpoints
router.get('/monitoring/dashboard', jwtAuth, realtime.monitoring.dashboard.getOverview);
router.get('/monitoring/metrics', jwtAuth, realtime.monitoring.metricsHistory);
router.get('/monitoring/alerts', jwtAuth, realtime.monitoring.alerts);
router.post('/monitoring/alerts', jwtAuth, realtime.monitoring.alerts);
router.get('/monitoring/health', jwtAuth, realtime.monitoring.health);
router.get('/monitoring/config', jwtAuth, realtime.monitoring.config);
router.post('/monitoring/config', jwtAuth, realtime.monitoring.config);

export default router;
