// 活動記錄處理器 - Updated to use modularized Activities
import { Hono } from 'hono'
import type { Bindings } from '../types'
import { activityHandler as moduleActivityHandler } from '@modules/activities'
import { jwtAuth } from '../middleware/auth'

// Create Hono router for activities
const router = new Hono<{ Bindings: Bindings }>()

// ✅ CORS 處理已移至 src/index.ts 統一管理
// 不再需要 handler 級別的 CORS middleware

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