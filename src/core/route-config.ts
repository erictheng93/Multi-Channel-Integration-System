// 統�?路由?�置 - ?�?�路?��??��?來�?實現
import { createRouteGroup, createRouteModule } from './route-registry';
import type { RouteGroup } from './route-registry';

// 導入?��??��???
import {
  authMainHandler,
  teamMainHandler,
  delayedMessageMainHandler,
  conversationMainHandler,
  systemMainHandler,
  customerMainHandler,
  tagMainHandler,
  sessionMainHandler,
  agentMainHandler,
  notificationMainHandler,
  healthMainHandler
} from '../handlers';

import messagingMainHandler from '../handlers/messaging-main';
import qrCodeRouterSimple from '@modules/qrcode/handlers/qrcode-router-simple';

// 導入額�??��???
import { analyticsHandler } from '@modules/analytics/handlers/analytics-main';
import { dashboardHandler } from '@modules/analytics/handlers/dashboard-main';
import { realtimeDashboardHandler } from '@modules/analytics/handlers/realtime-dashboard-main';
import reportsHandler from '@modules/reports/handlers/reports-main';
import { activityHandler } from '../handlers/activity';
// REMOVED: activityStreamHandler (Phase 4 cleanup - SSE-based, replaced by WebSocket)
// import { activityStreamHandler } from '../handlers/activity-stream';
import websocketMainHandler from '../handlers/websocket-main';
import delayedMessageBufferHandler from '../handlers/delayed-message-buffer';
import websocketAnalyticsHandler from '../handlers/websocket-analytics-main';
import userExperienceHandler from '../handlers/user-experience-main';
import phase2AuthHandler from '../handlers/phase2-auth-management';
import alertConfigHandler from '../handlers/alert-config-management';
import dataOptimizationHandler from '../handlers/data-optimization-main';
// REMOVED: sseMonitoringHandler (Phase 5 cleanup - SSE removed, WebSocket monitoring in place)
// import sseMonitoringHandler from '../handlers/sse-monitoring-main';
import { realtime } from '@modules/realtime';
import { queueMonitorHandler } from '../handlers/queue-monitor';
import webhookRouter from '../handlers/webhook';
import modularSystemRouter from './modular-system-integration';
import { createMonitoringHandlerMethods } from '../handlers/monitoring-dashboard';
import collaborationMainHandler from '@modules/collaboration/handlers/collaboration-main';

/**
 * ?��?API路由�?- ?��??�能
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
 * 業�??�輯路由�?- ?��?業�??�能
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
      name: 'delayed-messages',
      path: '/delayed-messages',
      handler: delayedMessageMainHandler,
      description: 'Delayed Message Processing',
      version: '1.1.0',
      dependencies: ['auth', 'messages'],
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
    })
  ]
});

/**
 * ?��??��?路由�?- ?��?管�??�能
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
 * 平台?��?路由�?- 外部平台?��?
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
    }),
    createRouteModule({
      name: 'qr-codes',
      path: '/qr-codes',
      handler: qrCodeRouterSimple,
      description: 'QR Code Generation and Management (Simple Router - WORKING)',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    })
  ]
});

/**
 * ??��?��?路由�?- 系統??��?��???
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
      description: '統�??��?模�??��?',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'analytics-dashboard',
      path: '/analytics/dashboard',
      handler: dashboardHandler,
      description: '?�表?�系�?��?',
      version: '1.0.0',
      dependencies: ['auth', 'analytics'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'analytics-realtime',
      path: '/analytics/realtime',
      handler: realtimeDashboardHandler,
      description: '實�??�表??��?',
      version: '1.0.0',
      dependencies: ['auth', 'analytics'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'reports',
      path: '/reports',
      handler: reportsHandler,
      description: '?�表系統?��?',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    })
    // REMOVED: SSE activity stream (Phase 4 cleanup - replaced by WebSocket)
    // NOTE: /api/activities/stream was removed in Phase 4 (SSE-based, replaced by WebSocket real-time events)
  ]
});

/**
 * WebSocket?�即?�通�?路由�? */
const realtimeGroup = createRouteGroup({
  name: 'Real-time Communication',
  prefix: '/api',
  description: 'WebSocket ?�即?�通�??�能',
  modules: [
    // DISABLED: websocket is manually registered in index.ts to avoid route conflicts with websocketHealthApp
    // createRouteModule({
    //   name: 'websocket',
    //   path: '/websocket',
    //   handler: websocketMainHandler,
    //   description: 'WebSocket Connection Handler',
    //   version: '1.0.0',
    //   dependencies: [], // Auth handled per-endpoint by websocketAuth middleware
    //   healthCheck: '/health'
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
      description: '統一多客服協作模組 (SSE + WebSocket)',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    // TEMPORARILY DISABLED: realtime module needs Hono router wrapper
    // createRouteModule({
    //   name: 'realtime',
    //   path: '/realtime',
    //   handler: realtime as any,
    //   description: '統�??��??��?模�?',
    //   version: '1.0.0',
    //   dependencies: ['auth'],
    //   healthCheck: '/health'
    // }),
    // REMOVED: SSE Monitoring route (Phase 5 cleanup - SSE removed, WebSocket monitoring in place)
    // createRouteModule({
    //   name: 'sse-monitoring',
    //   path: '/sse/monitoring',
    //   handler: sseMonitoringHandler,
    //   description: 'SSE Performance Monitoring',
    //   version: '1.0.0',
    //   dependencies: [], // Health endpoint is public, no auth dependency
    //   // healthCheck: '/health' // Disabled - handler already provides /health endpoint
    // })
  ]
});

/**
 * ?��??�能路由�?- Phase 2/3 ?�能
 */
const advancedFeaturesGroup = createRouteGroup({
  name: 'Advanced Features',
  prefix: '/api',
  description: 'Phase 2/3 ?��??�能',
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
      description: '?�戶體�???��?��?',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'phase2-auth',
      path: '/phase2-auth',
      handler: phase2AuthHandler,
      description: 'Phase 2 認�?管�??��?',
      version: '2.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'alert-config',
      path: '/alert-config',
      handler: alertConfigHandler,
      description: '?�警?�知?�置管�?',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    }),
    createRouteModule({
      name: 'data-optimization',
      path: '/data-optimization',
      handler: dataOptimizationHandler,
      description: '?��??��?管�??��?',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    })
    // TEMPORARILY DISABLED: queue-monitor needs Hono router wrapper
    // createRouteModule({
    //   name: 'queue-monitor',
    //   path: '/queues',
    //   handler: queueMonitorHandler as any,
    //   description: '?��?統�???��?��?',
    //   version: '1.0.0',
    //   dependencies: ['auth'],
    //   healthCheck: '/health'
    // })
  ]
});

/**
 * Webhook ?��?路由�? */
const webhookGroup = createRouteGroup({
  name: 'Webhook Integration',
  prefix: '/api',
  description: 'Webhook Processing and Integration',
  modules: [
    createRouteModule({
      name: 'webhooks',
      path: '/webhook',
      handler: webhookRouter,
      description: 'Webhook ?��??��?',
      version: '1.0.0',
      dependencies: [],
      healthCheck: '/health'
    })
  ]
});

/**
 * 系統管�?路由�?- ?�部系統管�?
 */
const systemManagementGroup = createRouteGroup({
  name: 'System Management',
  prefix: '/api',
  description: '系統?�部管�??�能',
  modules: [
    createRouteModule({
      name: 'modular-system',
      path: '/modular',
      handler: modularSystemRouter,
      description: 'Modular System Management',
      version: '1.0.0',
      dependencies: ['auth'],
      healthCheck: '/health'
    })
  ]
});

/**
 * 導出?�?�路?��??�置
 */
export const routeGroups: RouteGroup[] = [
  coreApiGroup,
  businessLogicGroup,
  collaborationGroup,
  integrationGroup,
  monitoringGroup,
  realtimeGroup,
  advancedFeaturesGroup,
  webhookGroup,
  systemManagementGroup
];

/**
 * 路由?�置統�?信息
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
 * ?��?模�?依賴?? */
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
 * 驗�?路由?�置完整?? */
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

  // 檢查依賴?��?
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

// ?��??�置驗�?
const validation = validateRouteConfig();
if (!validation.valid) {
  console.warn('?��? Route configuration issues detected:', validation.issues);
} else {
  console.log('??Route configuration validated successfully');
}

