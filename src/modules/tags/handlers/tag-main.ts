// src/modules/tags/handlers/tag-main.ts
// Tag management handler - main router

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { tagHandler } from '../services/tag-service';
import { jwtAuth } from '@/middleware/auth';
import { nowISO } from '@/utils/timestamp'

const tagMainHandler = new Hono<{ Bindings: Bindings }>();

// CORS handling moved to src/index.ts unified management
// No handler-level CORS middleware needed

// Apply JWT auth middleware to all endpoints (except health check)
tagMainHandler.use('/*', async (c, next) => {
  // Health check endpoint does not require authentication
  if (c.req.path.endsWith('/health')) {
    return next();
  }
  return jwtAuth(c, next);
});

// ========================================
// Tag management endpoints
// Route registration order: STATIC -> SPECIFIC -> PARAMETERIZED -> WILDCARD
// ========================================

// ========================================
// Health check endpoint
// Route Order: Registered first to prevent any potential interception
// ========================================
tagMainHandler.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      handler: 'tag-main',
      timestamp: nowISO()
    },
    message: 'Tag handler is operational'
  });
});

// ==================== Priority 1: SPECIFIC multi-segment routes ====================
// Bulk tag operations (must be before /:id routes)
tagMainHandler.post('/bulk', tagHandler.bulkOperation);

// ==================== Priority 2: PARAMETERIZED multi-segment routes ====================
// Get tag usage statistics
tagMainHandler.get('/:id/stats', tagHandler.getUsageStats);

// Get tag's customer list
tagMainHandler.get('/:id/customers', tagHandler.getTagCustomers);

// ==================== Priority 3: PARAMETERIZED single-segment routes ====================
// Get single tag details
tagMainHandler.get('/:id', tagHandler.get);

// Update tag
tagMainHandler.put('/:id', tagHandler.update);

// Delete tag (soft delete)
tagMainHandler.delete('/:id', tagHandler.delete);

// ==================== Priority 4: WILDCARD routes ====================
// Get tag list
tagMainHandler.get('/', tagHandler.list);

// Create tag
tagMainHandler.post('/', tagHandler.create);

export default tagMainHandler;
