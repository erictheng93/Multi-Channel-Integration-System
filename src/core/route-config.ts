// Unified route configuration - all route modules are declared here
import { createRouteGroup, createRouteModule } from './route-registry';
import type { RouteGroup } from './route-registry';

// Import core handlers
import {
  authMainHandler,
  teamMainHandler,
  conversationMainHandler,
  systemMainHandler,
  customerMainHandler,
  tagMainHandler,
  sessionMainHandler,
  agentMainHandler,
  notificationMainHandler,
  healthMainHandler
} from '../handlers';

import messagingMainHandler from '@modules/messaging/handlers/messaging/index';
// REMOVED: Old QR Code module - migrated to new LIFF QR Code system
// import qrCodeRouterSimple from '@modules/qrcode/handlers/qrcode-router-simple';
import fileMainHandler from '@modules/file-management/handlers/file-main';
import { autoReplyRulesHandler, autoReplySchedulesHandler, autoReplyLogsHandler } from '../modules/auto-reply/handlers';

// Import additional handlers
import { analyticsHandler } from '@modules/analytics/handlers/analytics-main';
import { dashboardHandler } from '@modules/analytics/handlers/dashboard-main';
import { realtimeDashboardHandler } from '@modules/analytics/handlers/realtime-dashboard-main';
import reportsHandler from '@modules/reports/handlers/reports-main';
import delayedMessageBufferHandler from '@modules/delayed-message/handlers/delayed-message-buffer';
import websocketAnalyticsHandler from '@modules/websocket/handlers/websocket-analytics-main';
import userExperienceHandler from '@modules/system/handlers/user-experience-main';
import phase2AuthHandler from '@modules/auth/handlers/phase2-auth-management';
import alertConfigHandler from '@modules/system/handlers/alert-config-management';
import dataOptimizationHandler from '@modules/system/handlers/data-optimization-main';
import webhookRouter from '@modules/integrations/handlers/webhook';
import collaborationMainHandler from '@modules/collaboration/handlers/collaboration-main';

/**
 * Core API route group
 */
const coreApiGroup = createRouteGroup({
  name: 'Core API',
  prefix: '/api',
  description: 'Core System API - Authentication, System Management, Health Check',
  modules: [
    createRouteModule({
      name: 'auth',
      path: '/auth',
      handler: authMainHandler,
      description: 'User Authentication and Authorization',
      version: '1.2.0',
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'system',
      path: '/system',
      handler: systemMainHandler,
      description: 'System Management and Configuration',
      version: '1.1.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'health',
      path: '/health',
      handler: healthMainHandler,
      description: 'Unified Health Check System',
      version: '1.0.0',
      healthCheck: '/health'
    })
  ]
});

/**
 * Business logic route group
 */
const businessLogicGroup = createRouteGroup({
  name: 'Business Logic',
  prefix: '/api',
  description: 'Business Logic - Conversation Management, Customer Management',
  modules: [
    createRouteModule({
      name: 'conversations',
      path: '/conversations',
      handler: conversationMainHandler,
      description: 'Conversation Management',
      version: '1.3.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'messages',
      path: '/messages',
      handler: messagingMainHandler,
      description: 'Message Processing',
      version: '1.2.0',
      dependencies: ['auth', 'conversations'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'customers',
      path: '/customers',
      handler: customerMainHandler,
      description: 'Customer Data Management',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'tags',
      path: '/tags',
      handler: tagMainHandler,
      description: 'Tag Management System',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'files',
      path: '/files',
      handler: fileMainHandler,
      description: 'File Management and Storage (R2)',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'auto-reply-rules',
      path: '/auto-reply/rules',
      handler: autoReplyRulesHandler,
      description: 'Auto-Reply Rules Management',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'auto-reply-schedules',
      path: '/auto-reply/schedules',
      handler: autoReplySchedulesHandler,
      description: 'Auto-Reply Business Hours Schedules',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'auto-reply-logs',
      path: '/auto-reply/logs',
      handler: autoReplyLogsHandler,
      description: 'Auto-Reply Audit Logs (Read-only)',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    })
  ]
});

/**
 * Team collaboration route group
 */
const collaborationGroup = createRouteGroup({
  name: 'Team Collaboration',
  prefix: '/api',
  description: 'Team Collaboration - Team and Agent Management, Session Management',
  modules: [
    createRouteModule({
      name: 'teams',
      path: '/teams',
      handler: teamMainHandler,
      description: 'Team Management',
      version: '1.1.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'agents',
      path: '',
      handler: agentMainHandler(),
      description: 'Agent Management',
      version: '1.0.0',
      dependencies: ['auth', 'teams'],
      healthCheck: '/agents/health'
    }),
    createRouteModule({
      name: 'sessions',
      path: '/sessions',
      handler: sessionMainHandler,
      description: 'Session Management',
      version: '1.0.0',
      dependencies: ['auth', 'conversations'],
      healthCheck: '/health'
    })
  ]
});

/**
 * Platform integration route group
 */
const integrationGroup = createRouteGroup({
  name: 'Platform Integration',
  prefix: '/api',
  description: 'Platform Integration - Notifications and QR Code Generation',
  modules: [
    createRouteModule({
      name: 'notifications',
      path: '/notifications',
      handler: notificationMainHandler,
      description: 'Unified Notification System',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    })
    // REMOVED: Old QR Code module - migrated to new LIFF QR Code system
    // createRouteModule({
    // name: 'qr-codes',
    // path: '/qr-codes',
    // handler: qrCodeRouterSimple,
    // description: 'QR Code Generation and Management (Simple Router - WORKING)',
    // version: '1.0.0',
    // dependencies: ['auth'],
    // healthCheck: '/health'
    // })
  ]
});

/**
 * Monitoring and analytics route group
 */
const monitoringGroup = createRouteGroup({
  name: 'Monitoring & Analytics',
  prefix: '/api',
  description: 'System Monitoring and Analytics',
  modules: [
    createRouteModule({
      name: 'analytics',
      path: '/analytics',
      handler: analyticsHandler,
      description: 'Analytics Module',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'analytics-dashboard',
      path: '/analytics/dashboard',
      handler: dashboardHandler,
      description: 'Analytics Dashboard',
      version: '1.0.0',
      dependencies: ['auth', 'analytics'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'analytics-realtime',
      path: '/analytics/realtime',
      handler: realtimeDashboardHandler,
      description: 'Realtime Analytics Dashboard',
      version: '1.0.0',
      dependencies: ['auth', 'analytics'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'reports',
      path: '/reports',
      handler: reportsHandler,
      description: 'Reporting System',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    })
  ]
});

/**
 * WebSocket real-time communication route group
 */
const realtimeGroup = createRouteGroup({
  name: 'Real-time Communication',
  prefix: '/api',
  description: 'WebSocket Real-time Communication',
  modules: [
    // DISABLED: websocket is manually registered in index.ts to avoid route conflicts with websocketHealthApp
    // createRouteModule({
    // name: 'websocket',
    // path: '/websocket',
    // handler: websocketMainHandler,
    // description: 'WebSocket Connection Handler',
    // version: '1.0.0',
    // dependencies: [], // Auth handled per-endpoint by websocketAuth middleware
    // healthCheck: '/health'
    // }),
    createRouteModule({
      name: 'websocket-analytics',
      path: '/websocket/analytics',
      handler: websocketAnalyticsHandler,
      description: 'WebSocket Performance Monitoring',
      version: '1.0.0',
      dependencies: ['auth'], // websocket dependency removed as it's manually registered
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'collaboration',
      path: '/collaboration',
      handler: collaborationMainHandler,
      description: '統一多客服協作模組 (WebSocket)',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    // Note: Realtime routes are registered directly in src/index.ts (lines 1143-1154)
    // for explicit endpoint control. This module is intentionally not included here.
  ]
});

/**
 * Advanced features route group - Phase 2/3 features
 */
const advancedFeaturesGroup = createRouteGroup({
  name: 'Advanced Features',
  prefix: '/api',
  description: 'Phase 2/3 Advanced Features',
  modules: [
    createRouteModule({
      name: 'delayed-messages-v2',
      path: '/delayed-messages-v2',
      handler: delayedMessageBufferHandler,
      description: '延遲訊息緩衝區 (Durable Objects)',
      version: '2.0.0',
      dependencies: [], // Auth handled per-endpoint by jwtAuth middleware
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'user-experience',
      path: '/user-experience',
      handler: userExperienceHandler,
      description: 'User Experience Management',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'phase2-auth',
      path: '/phase2-auth',
      handler: phase2AuthHandler,
      description: 'Phase 2 Authentication Management',
      version: '2.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'alert-config',
      path: '/alert-config',
      handler: alertConfigHandler,
      description: 'Alert Notification Configuration',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'data-optimization',
      path: '/data-optimization',
      handler: dataOptimizationHandler,
      description: 'Data Optimization Management',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    })
    // Note: Queue monitor routes are registered directly in src/index.ts (lines 1172-1176)
    // for explicit endpoint control. This module is intentionally not included here.
  ]
});

/**
 * Webhook integration route group
 */
const webhookGroup = createRouteGroup({
  name: 'Webhook Integration',
  prefix: '/api',
  description: 'Webhook Processing and Integration',
  modules: [
    createRouteModule({
      name: 'webhooks',
      path: '/webhook',
      handler: webhookRouter,
      description: 'Webhook Processing',
      version: '1.0.0',
      dependencies: [],
      healthCheck: '/health'
    })
  ]
});

/**
 * Export all route groups
 */
export const routeGroups: RouteGroup[] = [
  coreApiGroup,
  businessLogicGroup,
  collaborationGroup,
  integrationGroup,
  monitoringGroup,
  realtimeGroup,
  advancedFeaturesGroup,
  webhookGroup
];

/**
 * Route configuration summary
 */
export const routeConfigStats = {
  totalGroups: routeGroups.length,
  totalModules: routeGroups.reduce((sum, group) => sum + group.modules.length, 0),
  modulesByGroup: routeGroups.map(group => ({
    name: group.name,
    count: group.modules.length,
    modules: group.modules.map(m => m.name)
  }))
};

/**
 * Build module dependency graph
 */
export function getModuleDependencyGraph(): { [key: string]: string[] } {
  const graph: { [key: string]: string[] } = {};

  for (const group of routeGroups) {
    for (const module of group.modules) {
      graph[module.name] = module.dependencies || [];
    }
  }

  return graph;
}

/**
 * Validate route configuration completeness
 */
export function validateRouteConfig(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const allModules = new Set<string>();

  for (const group of routeGroups) {
    for (const module of group.modules) {
      if (allModules.has(module.name)) {
        issues.push(`Duplicate module name: ${module.name}`);
      }
      allModules.add(module.name);
    }
  }

  // Check dependency references
  for (const group of routeGroups) {
    for (const module of group.modules) {
      if (module.dependencies) {
        for (const dep of module.dependencies) {
          if (!allModules.has(dep)) {
            issues.push(`Module ${module.name} depends on non-existent module: ${dep}`);
          }
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

// Validate configuration at module load
const validation = validateRouteConfig();
if (!validation.valid) {
  console.warn('Route configuration issues detected:', validation.issues);
} else {
  console.log('Route configuration validated successfully');
}
