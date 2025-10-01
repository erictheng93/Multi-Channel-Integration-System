// 活動記錄處理器 - Updated to use modularized Activities
import { Hono } from 'hono'
import type { Bindings } from '../types'
import { activityHandler as moduleActivityHandler } from '@modules/activities'
import { jwtAuth } from '../middleware/auth'

// Create Hono router for activities
const router = new Hono<{ Bindings: Bindings }>()

// 🔥 CORS Preflight Handler - Must come FIRST, before all routes
router.options('*', (c) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = [
    'https://multi-channel.imfinethankyouandyou.com',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8787',
  ];

  const response = new Response(null, { status: 204 });

  if (allowedOrigins.includes(origin) && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Max-Age', '86400');

  // Prevent Cloudflare edge caching
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
});

// Register all activity routes
router.get('/', jwtAuth, moduleActivityHandler.list)
router.get('/user/:userId/stats', jwtAuth, moduleActivityHandler.getUserStats)
router.post('/cleanup', jwtAuth, moduleActivityHandler.cleanup)
router.get('/overview', jwtAuth, moduleActivityHandler.getOverview)
router.get('/stats/resources', jwtAuth, moduleActivityHandler.getResourceStats)
router.get('/stats/roles', jwtAuth, moduleActivityHandler.getRoleStats)
router.get('/trends', jwtAuth, moduleActivityHandler.getTrends)
router.get('/heatmap', jwtAuth, moduleActivityHandler.getHeatmap)
router.get('/metrics', jwtAuth, moduleActivityHandler.getMetrics)
router.get('/stats/custom', jwtAuth, moduleActivityHandler.getCustomStats)
router.get('/:id', jwtAuth, moduleActivityHandler.getById)

// Export the Hono router
export const activityHandler = router