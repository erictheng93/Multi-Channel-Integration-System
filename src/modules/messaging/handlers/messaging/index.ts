// Messaging Module - Modular Entry Point
// 訊息模組 - 模組化入口
//
// This file serves as the orchestrator for all messaging sub-routes.
// The original messaging-main.ts (2003 lines) has been fully modularized.
//
// Route Modules:
// - routes/health.ts - Health check and module info endpoints
// - routes/search.ts - Search, stats, and tags endpoints
// - routes/export.ts - Message export functionality (JSON/CSV)
// - routes/bulk.ts - Bulk create/delete operations
// - routes/conversation.ts - Conversation messages listing
// - routes/attachments.ts  - Attachment management
// - routes/forwarding.ts - Message forwarding
// - routes/tags.ts - Message tagging (per-message)
// - routes/crud.ts - Basic CRUD operations (GET/PUT/DELETE/:id, POST/)
//
// Route Priority Order (following Hono's first-registered, first-matched priority):
// Priority 1: STATIC GET routes (/health, /info, /search, /stats, /tags, /export)
// Priority 2: STATIC POST routes (/bulk-create, /bulk-delete)
// Priority 3: SPECIFIC multi-segment GET (/conversation/:conversationId)
// Priority 4: MULTI-SEGMENT with /:id prefix (/:id/attachments, /:id/forward, /:id/tags)
// Priority 5: SINGLE PARAM (GET /:id, PUT /:id, DELETE /:id)
// Priority 6: WILDCARD (POST /)

import { Hono } from 'hono';
import type { Bindings } from '@/types';

// Import modular routes
import healthRoutes from './routes/health';
import searchRoutes from './routes/search';
import exportRoutes from './routes/export';
import bulkRoutes from './routes/bulk';
import conversationRoutes from './routes/conversation';
import attachmentRoutes from './routes/attachments';
import forwardingRoutes from './routes/forwarding';
import tagsRoutes from './routes/tags';
import crudRoutes from './routes/crud';

const messagingModule = new Hono<{ Bindings: Bindings }>();

// ======================== Route Mounting Order ========================
// CRITICAL: Routes must be mounted in correct priority order!
// Static routes → Specific patterns → Parameterized routes → Wildcards

// Priority 1: Static health/info routes
messagingModule.route('/', healthRoutes);

// Priority 2: Static search/stats/tags routes
messagingModule.route('/', searchRoutes);

// Priority 3: Static export route
messagingModule.route('/', exportRoutes);

// Priority 4: Static bulk operation routes
messagingModule.route('/', bulkRoutes);

// Priority 5: Specific multi-segment route (/conversation/:conversationId)
messagingModule.route('/', conversationRoutes);

// Priority 6: Multi-segment routes with /:id prefix
messagingModule.route('/', attachmentRoutes); // /:id/attachments
messagingModule.route('/', forwardingRoutes); // /:id/forward
messagingModule.route('/', tagsRoutes); // /:id/tags

// Priority 7 (LAST): CRUD routes - includes single param routes and POST wildcard
messagingModule.route('/', crudRoutes); // GET/PUT/DELETE /:id, POST /

// ======================== Module Exports ========================

export default messagingModule;

// Re-export individual route modules for selective importing
export {
  healthRoutes,
  searchRoutes,
  exportRoutes,
  bulkRoutes,
  conversationRoutes,
  attachmentRoutes,
  forwardingRoutes,
  tagsRoutes,
  crudRoutes
};

// Module metadata
export const MESSAGING_MODULE_INFO = {
  name: 'messaging',
  version: '2.1.0',
  status: 'fully-modularized',
  routes: [
    { path: '/health', method: 'GET', module: 'health' },
    { path: '/info', method: 'GET', module: 'health' },
    { path: '/search', method: 'GET', module: 'search' },
    { path: '/stats', method: 'GET', module: 'search' },
    { path: '/tags', method: 'GET', module: 'search' },
    { path: '/export', method: 'GET', module: 'export' },
    { path: '/bulk-create', method: 'POST', module: 'bulk' },
    { path: '/bulk-delete', method: 'POST', module: 'bulk' },
    { path: '/conversation/:conversationId', method: 'GET', module: 'conversation' },
    { path: '/:id/attachments', method: 'GET', module: 'attachments' },
    { path: '/:id/attachments', method: 'POST', module: 'attachments' },
    { path: '/:id/forward', method: 'POST', module: 'forwarding' },
    { path: '/:id/tags', method: 'PUT', module: 'tags' },
    { path: '/:id/tags', method: 'DELETE', module: 'tags' },
    { path: '/:id', method: 'GET', module: 'crud' },
    { path: '/:id', method: 'PUT', module: 'crud' },
    { path: '/:id', method: 'DELETE', module: 'crud' },
    { path: '/', method: 'POST', module: 'crud' }
  ],
  originalFile: 'messaging-main.ts',
  originalLines: 2003,
  modularizedDate: '2025-01-29'
};
