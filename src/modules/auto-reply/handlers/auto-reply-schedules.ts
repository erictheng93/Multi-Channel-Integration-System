// src/modules/auto-reply/handlers/auto-reply-schedules.ts
// CRUD handler for auto-reply business hours schedules

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth } from '@/middleware/auth';
import { createDbClient } from '@/db/drizzle-factory';
import { autoReplySchedules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateScheduleCache } from '../services/schedule-service';
import {
  badRequestResponse,
  handleApiError,
} from '@/utils/api-response';
import { nowISO } from '@/utils/timestamp';
import type { BulkUpsertScheduleRequest } from '../types';
import { autoReplyContracts, type AutoReplySchedule } from '@shared/api-contracts';
import { contractJson } from '@/utils/api-contract-response';

const autoReplySchedulesHandler = new Hono<{ Bindings: Bindings }>();

type AutoReplyScheduleRow = typeof autoReplySchedules.$inferSelect;

function toContractSchedule(schedule: AutoReplyScheduleRow): AutoReplySchedule {
  return {
    id: schedule.id,
    teamId: schedule.teamId,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    timezone: schedule.timezone ?? 'Asia/Taipei',
    isActive: schedule.isActive ?? true,
  };
}

autoReplySchedulesHandler.use('/*', jwtAuth);

// ==================== Health check ====================
autoReplySchedulesHandler.get('/health', (c) => {
  return c.json({
    success: true,
    data: { status: 'healthy', handler: 'auto-reply-schedules', timestamp: nowISO() },
    message: 'Auto-reply schedules handler is operational',
  });
});

// ==================== Get team schedules ====================
autoReplySchedulesHandler.get('/', async (c) => {
  try {
    const drizzleDb = createDbClient(c.env.DB);
    const payload = c.get('jwtPayload');
    const teamId = parseInt(c.req.query('teamId') || '') || c.get('contextTeamId') || payload?.primaryTeamId;

    if (!teamId) {
      return badRequestResponse(c, 'teamId is required');
    }

    const schedules = await drizzleDb
      .select()
      .from(autoReplySchedules)
      .where(eq(autoReplySchedules.teamId, teamId))
      .orderBy(autoReplySchedules.dayOfWeek);

    return contractJson(c, autoReplyContracts.getSchedules, {
      success: true,
      data: schedules.map(toContractSchedule),
      message: 'Schedules retrieved successfully',
    });
  } catch (error) {
    return handleApiError(error, c);
  }
});

// ==================== Bulk upsert schedules ====================
autoReplySchedulesHandler.post('/', async (c) => {
  try {
    const drizzleDb = createDbClient(c.env.DB);
    const payload = c.get('jwtPayload');
    const body = await c.req.json<BulkUpsertScheduleRequest>();

    const teamId = parseInt(c.req.query('teamId') || '') || c.get('contextTeamId') || payload?.primaryTeamId;
    if (!teamId) {
      return badRequestResponse(c, 'teamId is required');
    }

    if (!body.schedules || !Array.isArray(body.schedules) || body.schedules.length === 0) {
      return badRequestResponse(c, 'schedules array is required');
    }

    // Validate schedule entries
    for (const sched of body.schedules) {
      if (sched.dayOfWeek < 0 || sched.dayOfWeek > 6) {
        return badRequestResponse(c, `Invalid dayOfWeek: ${sched.dayOfWeek}. Must be 0-6`);
      }
      if (!isValidTime(sched.startTime)) {
        return badRequestResponse(c, `Invalid startTime format: ${sched.startTime}. Use HH:mm`);
      }
      if (!isValidTime(sched.endTime)) {
        return badRequestResponse(c, `Invalid endTime format: ${sched.endTime}. Use HH:mm`);
      }
    }

    const now = nowISO();
    const timezone = body.timezone || 'Asia/Taipei';

    // Delete existing schedules for this team, then insert new ones
    await drizzleDb.delete(autoReplySchedules).where(eq(autoReplySchedules.teamId, teamId));

    const values = body.schedules.map((sched) => ({
      teamId,
      dayOfWeek: sched.dayOfWeek,
      startTime: sched.startTime,
      endTime: sched.endTime,
      timezone,
      isActive: sched.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    }));

    const inserted = await drizzleDb
      .insert(autoReplySchedules)
      .values(values)
      .returning();

    // Invalidate KV cache
    await invalidateScheduleCache(teamId, c.env);

    return contractJson(c, autoReplyContracts.saveSchedules, {
      success: true,
      data: inserted.map(toContractSchedule),
      message: 'Schedules updated successfully',
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequestResponse(c, 'Invalid JSON');
    }
    return handleApiError(error, c);
  }
});

// ==================== Helpers ====================

function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export default autoReplySchedulesHandler;
