// src/modules/auto-reply/handlers/auto-reply-rules.ts
// CRUD handler for auto-reply rules management

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth } from '@/middleware/auth';
import { createDbClient } from '@/db/drizzle-factory';
import { autoReplyRules, autoReplyConditions, autoReplyActions } from '@/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { invalidateRulesCache } from '../services/auto-reply-engine';
import {
  successResponse,
  badRequestResponse,
  notFoundResponse,
  handleApiError,
  paginatedResponse,
} from '@/utils/api-response';
import { nowISO } from '@/utils/timestamp';
import type { CreateRuleRequest, UpdateRuleRequest, TriggerType, ConditionType, ActionType, MatchMode } from '../types';

const autoReplyRulesHandler = new Hono<{ Bindings: Bindings }>();

// Apply JWT auth to all endpoints
autoReplyRulesHandler.use('/*', jwtAuth);

// ==================== Health check ====================
autoReplyRulesHandler.get('/health', (c) => {
  return c.json({
    success: true,
    data: { status: 'healthy', handler: 'auto-reply-rules', timestamp: nowISO() },
    message: 'Auto-reply rules handler is operational',
  });
});

// ==================== List rules ====================
autoReplyRulesHandler.get('/', async (c) => {
  try {
    const drizzleDb = createDbClient(c.env.DB);
    const payload = c.get('jwtPayload');
    const scope = c.req.query('scope'); // 'global' | undefined

    // For global scope, no teamId needed
    const teamId = scope === 'global'
      ? null
      : (parseInt(c.req.query('teamId') || '') || c.get('contextTeamId') || payload?.primaryTeamId);

    if (scope !== 'global' && !teamId) {
      return badRequestResponse(c, 'teamId is required (or use scope=global)');
    }

    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50'), 100);
    const offset = (page - 1) * pageSize;

    // Build WHERE clause based on scope
    const whereCondition = scope === 'global'
      ? and(isNull(autoReplyRules.teamId), isNull(autoReplyRules.deletedAt))
      : and(eq(autoReplyRules.teamId, teamId!), isNull(autoReplyRules.deletedAt));

    // Get rules
    const rules = await drizzleDb
      .select()
      .from(autoReplyRules)
      .where(whereCondition)
      .orderBy(autoReplyRules.priority)
      .limit(pageSize)
      .offset(offset);

    // Get total count
    const allRules = await drizzleDb
      .select({ id: autoReplyRules.id })
      .from(autoReplyRules)
      .where(whereCondition);
    const total = allRules.length;

    // Load conditions and actions only for the current page's rules
    const ruleIds = rules.map((r) => r.id);
    const [conditions, actions] = ruleIds.length > 0
      ? await Promise.all([
          drizzleDb.select().from(autoReplyConditions).where(inArray(autoReplyConditions.ruleId, ruleIds)),
          drizzleDb.select().from(autoReplyActions).where(inArray(autoReplyActions.ruleId, ruleIds)),
        ])
      : [[], []];

    const result = rules.map((rule) => ({
      ...rule,
      isActive: rule.isActive ?? true,
      conditions: conditions
        .filter((c) => c.ruleId === rule.id)
        .map((c) => ({
          id: c.id,
          conditionType: c.conditionType,
          value: c.value,
          caseSensitive: c.caseSensitive ?? false,
          matchMode: c.matchMode || 'any',
        })),
      actions: actions
        .filter((a) => a.ruleId === rule.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((a) => ({
          id: a.id,
          actionType: a.actionType,
          content: a.content,
          sortOrder: a.sortOrder ?? 0,
        })),
    }));

    return paginatedResponse(c, result, { page, limit: pageSize, total }, 'Rules retrieved successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
});

// ==================== Create rule ====================
autoReplyRulesHandler.post('/', async (c) => {
  try {
    const drizzleDb = createDbClient(c.env.DB);
    const payload = c.get('jwtPayload');
    const body = await c.req.json<CreateRuleRequest>();

    if (!body.name?.trim()) {
      return badRequestResponse(c, 'Rule name is required');
    }

    const validTriggerTypes: TriggerType[] = ['welcome', 'keyword', 'off_hours', 'fallback'];
    if (!validTriggerTypes.includes(body.triggerType)) {
      return badRequestResponse(c, `Invalid triggerType. Must be one of: ${validTriggerTypes.join(', ')}`);
    }

    const scope = c.req.query('scope'); // 'global' | undefined
    const resolvedTeamId: number | null = scope === 'global'
      ? null
      : (parseInt(c.req.query('teamId') || '') || c.get('contextTeamId') || payload?.primaryTeamId || null);

    if (scope !== 'global' && resolvedTeamId === null) {
      return badRequestResponse(c, 'teamId is required (or use scope=global)');
    }

    const now = nowISO();

    // Insert rule
    const [rule] = await drizzleDb
      .insert(autoReplyRules)
      .values({
        teamId: resolvedTeamId,
        name: body.name.trim(),
        triggerType: body.triggerType,
        priority: body.priority ?? 100,
        isActive: body.isActive ?? true,
        allowPushFallback: body.allowPushFallback ?? false,
        createdBy: payload?.userId?.toString() || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Insert conditions
    if (body.conditions && body.conditions.length > 0) {
      const validConditionTypes: ConditionType[] = ['exact', 'contains', 'regex', 'message_type'];
      for (const cond of body.conditions) {
        if (!validConditionTypes.includes(cond.conditionType)) {
          return badRequestResponse(c, `Invalid conditionType: ${cond.conditionType}`);
        }
      }

      await drizzleDb.insert(autoReplyConditions).values(
        body.conditions.map((cond) => ({
          ruleId: rule.id,
          conditionType: cond.conditionType,
          value: cond.value,
          caseSensitive: cond.caseSensitive ?? false,
          matchMode: (cond.matchMode || 'any') as MatchMode,
          createdAt: now,
        }))
      );
    }

    // Insert actions
    if (body.actions && body.actions.length > 0) {
      const validActionTypes: ActionType[] = ['reply_text', 'reply_image', 'reply_flex'];
      for (const act of body.actions) {
        if (!validActionTypes.includes(act.actionType)) {
          return badRequestResponse(c, `Invalid actionType: ${act.actionType}`);
        }
      }

      await drizzleDb.insert(autoReplyActions).values(
        body.actions.map((act, i) => ({
          ruleId: rule.id,
          actionType: act.actionType,
          content: act.content,
          sortOrder: act.sortOrder ?? i,
          createdAt: now,
        }))
      );
    }

    // Invalidate KV cache
    await invalidateRulesCache(resolvedTeamId, c.env);

    // Re-fetch with relations
    const [conditions, actions] = await Promise.all([
      drizzleDb.select().from(autoReplyConditions).where(eq(autoReplyConditions.ruleId, rule.id)),
      drizzleDb.select().from(autoReplyActions).where(eq(autoReplyActions.ruleId, rule.id)),
    ]);

    return successResponse(
      c,
      {
        ...rule,
        isActive: rule.isActive ?? true,
        conditions: conditions.map((co) => ({
          id: co.id,
          conditionType: co.conditionType,
          value: co.value,
          caseSensitive: co.caseSensitive ?? false,
          matchMode: co.matchMode || 'any',
        })),
        actions: actions.map((a) => ({
          id: a.id,
          actionType: a.actionType,
          content: a.content,
          sortOrder: a.sortOrder ?? 0,
        })),
      },
      'Rule created successfully',
      201
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequestResponse(c, 'Invalid JSON');
    }
    return handleApiError(error, c);
  }
});

// ==================== Update rule ====================
autoReplyRulesHandler.put('/:id', async (c) => {
  try {
    const drizzleDb = createDbClient(c.env.DB);
    const ruleId = parseInt(c.req.param('id'));

    if (isNaN(ruleId)) {
      return badRequestResponse(c, 'Invalid rule ID');
    }

    // Check rule exists
    const existing = await drizzleDb
      .select()
      .from(autoReplyRules)
      .where(and(eq(autoReplyRules.id, ruleId), isNull(autoReplyRules.deletedAt)))
      .get();

    if (!existing) {
      return notFoundResponse(c, 'Rule');
    }

    const body = await c.req.json<UpdateRuleRequest>();
    const now = nowISO();

    // Update rule fields
    const updateFields: Record<string, unknown> = { updatedAt: now };
    if (body.name !== undefined) updateFields.name = body.name.trim();
    if (body.triggerType !== undefined) updateFields.triggerType = body.triggerType;
    if (body.priority !== undefined) updateFields.priority = body.priority;
    if (body.isActive !== undefined) updateFields.isActive = body.isActive;
    if (body.allowPushFallback !== undefined) updateFields.allowPushFallback = body.allowPushFallback;

    await drizzleDb
      .update(autoReplyRules)
      .set(updateFields)
      .where(eq(autoReplyRules.id, ruleId));

    // Replace conditions if provided
    if (body.conditions !== undefined) {
      await drizzleDb.delete(autoReplyConditions).where(eq(autoReplyConditions.ruleId, ruleId));
      if (body.conditions.length > 0) {
        await drizzleDb.insert(autoReplyConditions).values(
          body.conditions.map((cond) => ({
            ruleId,
            conditionType: cond.conditionType,
            value: cond.value,
            caseSensitive: cond.caseSensitive ?? false,
            matchMode: (cond.matchMode || 'any') as MatchMode,
            createdAt: now,
          }))
        );
      }
    }

    // Replace actions if provided
    if (body.actions !== undefined) {
      await drizzleDb.delete(autoReplyActions).where(eq(autoReplyActions.ruleId, ruleId));
      if (body.actions.length > 0) {
        await drizzleDb.insert(autoReplyActions).values(
          body.actions.map((act, i) => ({
            ruleId,
            actionType: act.actionType,
            content: act.content,
            sortOrder: act.sortOrder ?? i,
            createdAt: now,
          }))
        );
      }
    }

    // Invalidate KV cache
    await invalidateRulesCache(existing.teamId, c.env);

    // Re-fetch updated rule
    const updated = await drizzleDb
      .select()
      .from(autoReplyRules)
      .where(eq(autoReplyRules.id, ruleId))
      .get();

    const [conditions, actions] = await Promise.all([
      drizzleDb.select().from(autoReplyConditions).where(eq(autoReplyConditions.ruleId, ruleId)),
      drizzleDb.select().from(autoReplyActions).where(eq(autoReplyActions.ruleId, ruleId)),
    ]);

    return successResponse(c, {
      ...updated,
      isActive: updated?.isActive ?? true,
      conditions: conditions.map((co) => ({
        id: co.id,
        conditionType: co.conditionType,
        value: co.value,
        caseSensitive: co.caseSensitive ?? false,
        matchMode: co.matchMode || 'any',
      })),
      actions: actions.map((a) => ({
        id: a.id,
        actionType: a.actionType,
        content: a.content,
        sortOrder: a.sortOrder ?? 0,
      })),
    }, 'Rule updated successfully');
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequestResponse(c, 'Invalid JSON');
    }
    return handleApiError(error, c);
  }
});

// ==================== Delete rule (soft delete) ====================
autoReplyRulesHandler.delete('/:id', async (c) => {
  try {
    const drizzleDb = createDbClient(c.env.DB);
    const ruleId = parseInt(c.req.param('id'));

    if (isNaN(ruleId)) {
      return badRequestResponse(c, 'Invalid rule ID');
    }

    const existing = await drizzleDb
      .select()
      .from(autoReplyRules)
      .where(and(eq(autoReplyRules.id, ruleId), isNull(autoReplyRules.deletedAt)))
      .get();

    if (!existing) {
      return notFoundResponse(c, 'Rule');
    }

    // Soft delete
    await drizzleDb
      .update(autoReplyRules)
      .set({ deletedAt: nowISO(), isActive: false })
      .where(eq(autoReplyRules.id, ruleId));

    // Invalidate KV cache
    await invalidateRulesCache(existing.teamId, c.env);

    return successResponse(c, { id: ruleId }, 'Rule deleted successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
});

export default autoReplyRulesHandler;
