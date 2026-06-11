import type { Hono } from 'hono';
import { jwtAuth, requireAdmin } from '@/middleware/auth';
import type { Bindings } from '@/types';
import { createContextLogger } from '@/utils/logger';
import { modularSystemApiHandler } from '@/core/modular-system-integration';
import { createMonitoringHandlerMethods } from '@modules/monitoring/handlers/monitoring-dashboard';

const log = createContextLogger('ProtectedAdminRoutes');

export function registerProtectedAdminRoutes(app: Hono<{ Bindings: Bindings }>): void {
  log.info('Registering protected admin routes');

  app.use('/api/modular/*', jwtAuth, requireAdmin());
  app.get('/api/modular/status', modularSystemApiHandler.getSystemStatus.bind(modularSystemApiHandler));
  app.get('/api/modular/modules', modularSystemApiHandler.getModules.bind(modularSystemApiHandler));
  app.post('/api/modular/modules', modularSystemApiHandler.createModule.bind(modularSystemApiHandler));
  app.get('/api/modular/health', modularSystemApiHandler.getModuleHealth.bind(modularSystemApiHandler));

  const monitoringHandlers = createMonitoringHandlerMethods();
  app.get('/api/monitoring/dashboard', jwtAuth, requireAdmin(), monitoringHandlers.getDashboard);
  app.get('/api/monitoring/health/history', jwtAuth, requireAdmin(), monitoringHandlers.getHealthHistory);
  app.get('/api/monitoring/alerts', jwtAuth, requireAdmin(), monitoringHandlers.getAlertHistory);
  app.put('/api/monitoring/config', jwtAuth, requireAdmin(), monitoringHandlers.updateConfig);
  app.post('/api/monitoring/health/check', jwtAuth, requireAdmin(), monitoringHandlers.triggerHealthCheck);
  app.get('/api/monitoring/metrics', jwtAuth, requireAdmin(), monitoringHandlers.getMetrics);
  app.get('/api/monitoring/stats', jwtAuth, requireAdmin(), monitoringHandlers.getStats);
}
