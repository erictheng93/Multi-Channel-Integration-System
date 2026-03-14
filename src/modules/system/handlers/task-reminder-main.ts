// src/modules/system/handlers/task-reminder-main.ts
// 任務提醒 API 路由處理器

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings, JWTPayload } from '@/types';
import { jwtAuth } from '@/middleware/auth';
import { TaskReminderService } from '@/services/task-reminder-service';
import { globalErrorHandler } from '@/core/error-handler';
import { nowISO } from '@/utils/timestamp'

const app = new Hono<{ Bindings: Bindings }>();

// ==================== Health Check ====================

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    module: 'task-reminders',
    timestamp: nowISO(),
    version: '1.0.0'
  });
});

// ==================== Task Reminder CRUD ====================
// IMPORTANT: Routes ordered from most specific to most general to avoid conflicts

/**
 * 獲取即將到期的提醒
 * GET /api/reminders/upcoming
 */
app.get('/upcoming', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;
    const minutes = parseInt(c.req.query('minutes') || '30');

    const service = new TaskReminderService(c.env.DB, c.env);
    const reminders = await service.getUpcomingReminders(payload.userId.toString(), minutes);

    return c.json({
      success: true,
      data: reminders,
      count: reminders.length,
      minutesAhead: minutes,
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 獲取提醒統計
 * GET /api/reminders/stats
 */
app.get('/stats', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;

    const service = new TaskReminderService(c.env.DB, c.env);
    const stats = await service.getStats(payload.userId.toString());

    return c.json({
      success: true,
      data: stats,
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 手動觸發處理到期提醒 (Admin Only)
 * POST /api/reminders/process
 */
app.post('/process', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;

    // 只有管理員可以手動觸發
    if (payload.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Admin access required',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    const service = new TaskReminderService(c.env.DB, c.env);
    const processedCount = await service.processDueReminders();

    return c.json({
      success: true,
      data: { processedCount },
      message: `Processed ${processedCount} due reminders`,
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 標記任務提醒為已完成
 * PUT /api/reminders/:id/complete
 */
app.put('/:id/complete', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;
    const id = c.req.param('id')!;

    const service = new TaskReminderService(c.env.DB, c.env);
    const success = await service.markComplete(id, payload.userId.toString());

    if (!success) {
      return c.json({
        success: false,
        error: 'Reminder not found',
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }

    return c.json({
      success: true,
      message: 'Reminder marked as complete',
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 獲取單個任務提醒
 * GET /api/reminders/:id
 */
app.get('/:id', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;
    const id = c.req.param('id')!;

    const service = new TaskReminderService(c.env.DB, c.env);
    const reminder = await service.getById(id, payload.userId.toString());

    if (!reminder) {
      return c.json({
        success: false,
        error: 'Reminder not found',
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }

    return c.json({
      success: true,
      data: reminder,
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 更新任務提醒
 * PUT /api/reminders/:id
 */
app.put('/:id', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;
    const id = c.req.param('id')!;
    const body = await c.req.json();

    // 驗證提醒時間
    if (body.remindAt) {
      const remindAt = new Date(body.remindAt);
      if (isNaN(remindAt.getTime())) {
        return c.json({
          success: false,
          error: 'Invalid remindAt date format',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
      body.remindAt = remindAt;
    }

    const service = new TaskReminderService(c.env.DB, c.env);
    const success = await service.update(id, payload.userId.toString(), body);

    if (!success) {
      return c.json({
        success: false,
        error: 'Reminder not found or update failed',
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }

    return c.json({
      success: true,
      message: 'Reminder updated successfully',
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 刪除任務提醒
 * DELETE /api/reminders/:id
 */
app.delete('/:id', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;
    const id = c.req.param('id')!;

    const service = new TaskReminderService(c.env.DB, c.env);
    const success = await service.delete(id, payload.userId.toString());

    if (!success) {
      return c.json({
        success: false,
        error: 'Reminder not found',
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }

    return c.json({
      success: true,
      message: 'Reminder deleted successfully',
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 獲取用戶的任務提醒列表
 * GET /api/reminders
 */
app.get('/', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;
    const includeCompleted = c.req.query('includeCompleted') === 'true';

    const service = new TaskReminderService(c.env.DB, c.env);
    const reminders = await service.getByUserId(payload.userId.toString(), includeCompleted);

    return c.json({
      success: true,
      data: reminders,
      count: reminders.length,
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 創建新的任務提醒
 * POST /api/reminders
 */
app.post('/', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;
    const body = await c.req.json();

    // 驗證必填欄位
    if (!body.title || !body.remindAt) {
      return c.json({
        success: false,
        error: 'Title and remindAt are required',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證提醒時間
    const remindAt = new Date(body.remindAt);
    if (isNaN(remindAt.getTime())) {
      return c.json({
        success: false,
        error: 'Invalid remindAt date format',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證提醒時間不能是過去
    if (remindAt < new Date()) {
      return c.json({
        success: false,
        error: 'remindAt must be in the future',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const service = new TaskReminderService(c.env.DB, c.env);
    const reminderId = await service.create({
      userId: payload.userId.toString(),
      title: body.title,
      content: body.content,
      remindAt,
      conversationId: body.conversationId,
      repeatType: body.repeatType,
      repeatInterval: body.repeatInterval
    });

    return c.json({
      success: true,
      data: { id: reminderId },
      message: 'Reminder created successfully',
      timestamp: nowISO()
    }, HTTP_STATUS.CREATED);
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default app;

/**
 * Cron Handler - 處理定時任務
 * 由 wrangler.toml 中的 cron trigger 調用
 */
export async function handleScheduledEvent(env: Bindings): Promise<void> {
  console.log('[Cron] Processing due task reminders...');

  try {
    const service = new TaskReminderService(env.DB, env);
    const processedCount = await service.processDueReminders();

    console.log(`[Cron] Processed ${processedCount} due reminders`);
  } catch (error) {
    console.error('[Cron] Failed to process reminders:', error);
  }
}
