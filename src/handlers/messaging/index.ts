// Messaging Module - Modular Entry Point
// 訊息模組 - 模組化入口
//
// This file serves as the orchestrator for all messaging sub-routes.
// The original messaging-main.ts (2003 lines) has been split into logical modules:
//
// Route Modules:
// - routes/health.ts    - Health check and module info endpoints
// - routes/search.ts    - Search, stats, and tags endpoints
// - routes/export.ts    - Message export functionality (JSON/CSV)
//
// TODO: Complete modularization of remaining routes:
// - routes/bulk.ts      - Bulk create/delete operations (~300 lines)
// - routes/attachments.ts - Attachment management (~230 lines)
// - routes/forwarding.ts  - Message forwarding (~190 lines)
// - routes/tags.ts        - Message tagging (~120 lines)
// - routes/crud.ts        - Basic CRUD operations (~530 lines)
// - routes/conversation.ts - Conversation messages (~170 lines)
//
// Migration Strategy:
// 1. New modular routes are imported and mounted here
// 2. Legacy routes continue to work from messaging-main.ts
// 3. Gradually migrate remaining routes to sub-modules
// 4. Once complete, deprecate messaging-main.ts

import { Hono } from 'hono';
import type { Bindings } from '../../types';

// Import modular routes
import healthRoutes from './routes/health';
import searchRoutes from './routes/search';
import exportRoutes from './routes/export';

const messagingModule = new Hono<{ Bindings: Bindings }>();

// Mount modular routes
// Priority 1: Static routes (health, info)
messagingModule.route('/', healthRoutes);

// Priority 2: Search, stats, tags
messagingModule.route('/', searchRoutes);

// Priority 3: Export
messagingModule.route('/', exportRoutes);

// Note: For backward compatibility, the original messaging-main.ts
// is still the primary handler. This module can be used for:
// 1. New development following modular patterns
// 2. Testing modular architecture
// 3. Gradual migration

export default messagingModule;

// Re-export individual route modules for selective importing
export { healthRoutes, searchRoutes, exportRoutes };
