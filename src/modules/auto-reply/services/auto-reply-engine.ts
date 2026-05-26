// src/modules/auto-reply/services/auto-reply-engine.ts
// Core auto-reply evaluation engine: loads rules, matches conditions, executes actions

import type { Bindings } from '@/types';
import type { AutoReplyEvaluateInput, AutoReplyEvaluateResult, AutoReplyRuleWithRelations, TriggerType } from '../types';
import { matchConditions } from './condition-matcher';
import { isWithinBusinessHours } from './schedule-service';
import { executeActions } from './action-executor';
import { createDbClient } from '@/db/drizzle-factory';
import { autoReplyRules, autoReplyConditions, autoReplyActions, autoReplyLogs, autoReplyDeliveries, messages, conversations } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { v4 as uuidv4 } from 'uuid';
import { createContextLogger } from '@/utils/logger';
import { nowISO, nowMs } from '@/utils/timestamp';

const log = createContextLogger('AutoReplyEngine');

const KV_RULES_PREFIX = 'auto-reply:rules:';
const KV_RULES_TTL = 300; // 5 minutes

/**
 * Main evaluation function: check incoming message against auto-reply rules.
 * First matching rule (by priority) wins — its actions are executed and logged.
 */
export async function evaluate(
  input: AutoReplyEvaluateInput,
  env: Bindings
): Promise<AutoReplyEvaluateResult> {
  const { message, teamId, replyToken, conversationId, customerId, platformUserId } = input;

  try {
    // 1. Load active rules: global + team-specific (KV cached)
    log.info('evaluate() called', { teamId, conversationId, messageContent: message.content.slice(0, 50) });
    const rules = await getRulesForEvaluation(teamId, env);
    log.info('Rules loaded for evaluation', { ruleCount: rules.length, teamId, ruleNames: rules.map(r => r.name) });

    if (rules.length === 0) {
      return { matched: false };
    }

    // 2. Rules are pre-sorted by priority ASC (lower = higher priority)
    for (const rule of rules) {
      // 3a. Check triggerType eligibility (use rule's teamId for schedule lookup)
      const eligible = await isTriggerEligible(rule.triggerType, message, teamId, rule.teamId, env);
      if (!eligible) {
        continue;
      }

      // 3b. For keyword rules, check conditions
      if (rule.triggerType === 'keyword') {
        if (rule.conditions.length === 0) {
          continue; // keyword rule with no conditions can't match
        }
        const matched = matchConditions(message.content, message.messageType, rule.conditions);
        if (!matched) {
          continue;
        }
      }

      // 3c. Match found! Execute actions
      log.info('Auto-reply rule matched', {
        ruleId: rule.id,
        ruleName: rule.name,
        triggerType: rule.triggerType,
        conversationId,
        isGlobalRule: rule.teamId === null,
      });

      const delivery = input.platformMessageId
        ? await prepareAutoReplyDelivery(env, {
          platform: message.platform,
          platformMessageId: input.platformMessageId,
          ruleId: rule.id,
          conversationId,
          customerId,
        })
        : { shouldExecute: true, attemptCount: 0 };

      if (!delivery.shouldExecute) {
        return {
          matched: true,
          ruleId: delivery.ruleId ?? rule.id,
          ruleName: rule.name,
          replyMethod: delivery.replyMethod,
          error: delivery.error,
        };
      }

      const execResult = await executeActions(rule.actions, replyToken, platformUserId, env, {
        allowPushFallback: rule.allowPushFallback,
      });

      if (input.platformMessageId) {
        await markAutoReplyDeliveryResult(env, {
          platform: message.platform,
          platformMessageId: input.platformMessageId,
          status: execResult.success ? 'success' : 'failed',
          replyMethod: execResult.replyMethod,
          error: execResult.success ? null : (execResult.error || 'Unknown auto-reply delivery error'),
        });
      }

      if (execResult.success) {
        // Post-send operations are independent — run in parallel for ~100ms savings.
        // Each has its own error handling; one failure does not block the others.
        const responseContentSummary = buildResponseSummary(rule.actions);

        await Promise.allSettled([
          saveAutoReplyMessage(env, conversationId, responseContentSummary)
            .catch((e) => log.error('Failed to save auto-reply message to DB', {
              conversationId, error: e instanceof Error ? e.message : String(e),
            })),
          insertAutoReplyLog(env, {
            ruleId: rule.id,
            conversationId,
            customerId,
            triggerContent: message.content,
            responseContent: responseContentSummary,
            matchedCondition: rule.triggerType === 'keyword'
              ? JSON.stringify(rule.conditions.map((c) => ({ type: c.conditionType, value: c.value })))
              : JSON.stringify({ triggerType: rule.triggerType }),
            platform: message.platform,
            replyMethod: execResult.replyMethod,
          }),
          broadcastAutoReply(env, conversationId, responseContentSummary, teamId ?? undefined),
        ]);
      }

      return {
        matched: true,
        ruleId: rule.id,
        ruleName: rule.name,
        replyMethod: execResult.replyMethod,
        error: execResult.success ? undefined : execResult.error,
      };
    }

    // 4. No match
    return { matched: false };
  } catch (error) {
    log.error('Auto-reply evaluation error', {
      teamId,
      conversationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { matched: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Evaluate for follow events (welcome trigger type).
 */
export async function evaluateWelcome(
  teamId: number | null,
  replyToken: string | null,
  conversationId: string,
  customerId: number,
  platformUserId: string,
  env: Bindings
): Promise<AutoReplyEvaluateResult> {
  try {
    const rules = await getRulesForEvaluation(teamId, env);
    const welcomeRules = rules.filter((r) => r.triggerType === 'welcome');

    if (welcomeRules.length === 0) {
      return { matched: false };
    }

    // Use highest priority welcome rule
    const rule = welcomeRules[0];

    const execResult = await executeActions(rule.actions, replyToken, platformUserId, env, {
      allowPushFallback: rule.allowPushFallback,
    });

    if (execResult.success) {
      const responseContentSummary = buildResponseSummary(rule.actions);

      await Promise.allSettled([
        saveAutoReplyMessage(env, conversationId, responseContentSummary)
          .catch((e) => log.error('Failed to save welcome auto-reply message to DB', {
            conversationId, error: e instanceof Error ? e.message : String(e),
          })),
        insertAutoReplyLog(env, {
          ruleId: rule.id,
          conversationId,
          customerId,
          triggerContent: '[follow_event]',
          responseContent: responseContentSummary,
          matchedCondition: JSON.stringify({ triggerType: 'welcome' }),
          platform: 'line',
          replyMethod: execResult.replyMethod,
        }),
        broadcastAutoReply(env, conversationId, responseContentSummary, teamId ?? undefined),
      ]);
    }

    return {
      matched: true,
      ruleId: rule.id,
      ruleName: rule.name,
      replyMethod: execResult.replyMethod,
      error: execResult.success ? undefined : execResult.error,
    };
  } catch (error) {
    log.error('Auto-reply welcome evaluation error', {
      teamId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { matched: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Re-evaluate auto-reply for a redelivered platform message that was already
 * saved. The delivery ledger prevents duplicate sends when the previous attempt
 * already succeeded or is still pending.
 */
export async function retryAutoReplyForPlatformMessage(
  env: Bindings,
  input: {
    platform: 'line';
    platformMessageId: string;
    replyToken: string | null;
    platformUserId: string;
  }
): Promise<AutoReplyEvaluateResult> {
  try {
    const drizzleDb = createDbClient(env.DB);
    const existingMessage = await drizzleDb
      .select({
        content: messages.content,
        messageType: messages.messageType,
        conversationId: messages.conversationId,
        customerId: messages.customerSenderId,
      })
      .from(messages)
      .where(eq(messages.platformMessageId, input.platformMessageId))
      .get();

    if (!existingMessage?.conversationId || !existingMessage.customerId) {
      return { matched: false, error: 'Original message not found for auto-reply retry' };
    }

    const conversation = await drizzleDb
      .select({ assignedTeamId: conversations.assignedTeamId })
      .from(conversations)
      .where(eq(conversations.id, existingMessage.conversationId))
      .get();

    return await evaluate(
      {
        message: {
          content: existingMessage.content,
          messageType: existingMessage.messageType,
          platform: input.platform,
        },
        conversationId: existingMessage.conversationId,
        teamId: conversation?.assignedTeamId ?? null,
        replyToken: input.replyToken,
        customerId: existingMessage.customerId,
        platformUserId: input.platformUserId,
        platformMessageId: input.platformMessageId,
      },
      env
    );
  } catch (error) {
    log.error('Failed to retry auto-reply for platform message', {
      platform: input.platform,
      platformMessageId: input.platformMessageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { matched: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ==================== Internal Helpers ====================

type DeliveryStatus = 'pending' | 'success' | 'failed';

interface DeliveryPrepareResult {
  shouldExecute: boolean;
  ruleId?: number | null;
  replyMethod?: 'reply_api' | 'push_api';
  attemptCount: number;
  error?: string;
}

async function prepareAutoReplyDelivery(
  env: Bindings,
  data: {
    platform: string;
    platformMessageId: string;
    ruleId: number;
    conversationId: string;
    customerId: number;
  }
): Promise<DeliveryPrepareResult> {
  const drizzleDb = createDbClient(env.DB);
  const now = nowISO();

  const existing = await drizzleDb
    .select()
    .from(autoReplyDeliveries)
    .where(
      and(
        eq(autoReplyDeliveries.platform, data.platform),
        eq(autoReplyDeliveries.platformMessageId, data.platformMessageId)
      )
    )
    .get();

  if (existing?.status === 'success') {
    log.info('Auto-reply delivery already succeeded; skipping duplicate execution', {
      platform: data.platform,
      platformMessageId: data.platformMessageId,
      ruleId: existing.ruleId,
    });
    return {
      shouldExecute: false,
      ruleId: existing.ruleId,
      replyMethod: existing.replyMethod as 'reply_api' | 'push_api' | undefined,
      attemptCount: existing.attemptCount ?? 0,
    };
  }

  if (existing?.status === 'pending') {
    log.info('Auto-reply delivery already pending; skipping concurrent duplicate execution', {
      platform: data.platform,
      platformMessageId: data.platformMessageId,
      ruleId: existing.ruleId,
    });
    return {
      shouldExecute: false,
      ruleId: existing.ruleId,
      replyMethod: existing.replyMethod as 'reply_api' | 'push_api' | undefined,
      attemptCount: existing.attemptCount ?? 0,
      error: 'Auto-reply delivery already pending',
    };
  }

  const attemptCount = (existing?.attemptCount ?? 0) + 1;

  if (existing) {
    await drizzleDb
      .update(autoReplyDeliveries)
      .set({
        ruleId: data.ruleId,
        conversationId: data.conversationId,
        customerId: data.customerId,
        status: 'pending',
        attemptCount,
        lastError: null,
        lastAttemptAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(autoReplyDeliveries.platform, data.platform),
          eq(autoReplyDeliveries.platformMessageId, data.platformMessageId)
        )
      );
  } else {
    try {
      await drizzleDb.insert(autoReplyDeliveries).values({
        platform: data.platform,
        platformMessageId: data.platformMessageId,
        ruleId: data.ruleId,
        conversationId: data.conversationId,
        customerId: data.customerId,
        status: 'pending',
        attemptCount,
        lastAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      log.warn('Failed to create auto-reply delivery; duplicate execution is blocked', {
        platform: data.platform,
        platformMessageId: data.platformMessageId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        shouldExecute: false,
        attemptCount,
        error: 'Auto-reply delivery could not be reserved',
      };
    }
  }

  return { shouldExecute: true, attemptCount };
}

async function markAutoReplyDeliveryResult(
  env: Bindings,
  data: {
    platform: string;
    platformMessageId: string;
    status: DeliveryStatus;
    replyMethod: string;
    error: string | null;
  }
): Promise<void> {
  try {
    const drizzleDb = createDbClient(env.DB);
    const now = nowISO();
    await drizzleDb
      .update(autoReplyDeliveries)
      .set({
        status: data.status,
        replyMethod: data.replyMethod,
        lastError: data.error,
        sentAt: data.status === 'success' ? now : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(autoReplyDeliveries.platform, data.platform),
          eq(autoReplyDeliveries.platformMessageId, data.platformMessageId)
        )
      );
  } catch (error) {
    log.error('Failed to update auto-reply delivery result', {
      platform: data.platform,
      platformMessageId: data.platformMessageId,
      status: data.status,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check if a trigger type is eligible based on the current context.
 * For off_hours, uses the rule's own teamId for schedule lookup;
 * falls back to the conversation's teamId if the rule is global.
 */
async function isTriggerEligible(
  triggerType: TriggerType,
  message: AutoReplyEvaluateInput['message'],
  conversationTeamId: number | null,
  ruleTeamId: number | null,
  env: Bindings
): Promise<boolean> {
  switch (triggerType) {
    case 'welcome':
      // Welcome rules are handled separately via evaluateWelcome()
      return false;

    case 'keyword':
      // Only for text messages
      return message.messageType === 'text' && message.content.length > 0;

    case 'off_hours': {
      // Use rule's team for schedule lookup; fall back to conversation's team
      const scheduleTeamId = ruleTeamId ?? conversationTeamId;
      // null is valid — isWithinBusinessHours handles it by checking global schedules
      return !(await isWithinBusinessHours(scheduleTeamId, env));
    }

    case 'fallback':
      // Always eligible (catch-all)
      return true;

    default:
      return false;
  }
}

/**
 * Load global rules (team_id IS NULL) from KV or D1.
 */
async function getGlobalRules(
  env: Bindings
): Promise<AutoReplyRuleWithRelations[]> {
  const kvKey = `${KV_RULES_PREFIX}global`;

  // Try KV cache
  try {
    const cached = await env.CACHE.get(kvKey, 'json');
    if (cached) {
      return cached as AutoReplyRuleWithRelations[];
    }
  } catch {
    // KV miss
  }

  // Query D1
  const drizzleDb = createDbClient(env.DB);

  const ruleRows = await drizzleDb
    .select()
    .from(autoReplyRules)
    .where(
      and(
        isNull(autoReplyRules.teamId),
        eq(autoReplyRules.isActive, true),
        isNull(autoReplyRules.deletedAt)
      )
    )
    .orderBy(autoReplyRules.priority);

  const rules = await hydrateRulesWithRelations(drizzleDb, ruleRows);

  // Cache result
  try {
    await env.CACHE.put(kvKey, JSON.stringify(rules), { expirationTtl: KV_RULES_TTL });
  } catch { /* non-fatal */ }

  return rules;
}

/**
 * Load active rules (with conditions + actions) for a specific team from KV or D1.
 */
async function getTeamRules(
  teamId: number,
  env: Bindings
): Promise<AutoReplyRuleWithRelations[]> {
  const kvKey = `${KV_RULES_PREFIX}${teamId}`;

  // Try KV cache
  try {
    const cached = await env.CACHE.get(kvKey, 'json');
    if (cached) {
      return cached as AutoReplyRuleWithRelations[];
    }
  } catch {
    // KV miss
  }

  // Query D1
  const drizzleDb = createDbClient(env.DB);

  const ruleRows = await drizzleDb
    .select()
    .from(autoReplyRules)
    .where(
      and(
        eq(autoReplyRules.teamId, teamId),
        eq(autoReplyRules.isActive, true),
        isNull(autoReplyRules.deletedAt)
      )
    )
    .orderBy(autoReplyRules.priority);

  const rules = await hydrateRulesWithRelations(drizzleDb, ruleRows);

  // Cache result
  try {
    await env.CACHE.put(kvKey, JSON.stringify(rules), { expirationTtl: KV_RULES_TTL });
  } catch { /* non-fatal */ }

  return rules;
}

/**
 * Get all applicable rules for evaluation: global rules + team-specific rules.
 * Merged and sorted by priority ASC. At same priority, team-specific wins over global.
 */
async function getRulesForEvaluation(
  teamId: number | null,
  env: Bindings
): Promise<AutoReplyRuleWithRelations[]> {
  // Always load global rules
  const globalRules = await getGlobalRules(env);

  // If team is specified, also load team-specific rules
  const teamRules = teamId !== null ? await getTeamRules(teamId, env) : [];

  // Merge: sort by priority ASC; at same priority, team-specific first (non-null teamId)
  const merged = [...globalRules, ...teamRules];
  merged.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // At same priority: team-specific rules first (they override global)
    if (a.teamId !== null && b.teamId === null) return -1;
    if (a.teamId === null && b.teamId !== null) return 1;
    return 0;
  });

  return merged;
}

/**
 * Hydrate rule rows with their conditions and actions.
 */
async function hydrateRulesWithRelations(
  drizzleDb: ReturnType<typeof createDbClient>,
  ruleRows: (typeof autoReplyRules.$inferSelect)[]
): Promise<AutoReplyRuleWithRelations[]> {
  if (ruleRows.length === 0) {
    return [];
  }

  // Load conditions and actions for all rules in bulk
  const ruleIds = ruleRows.map((r) => r.id);

  const [conditionRows, actionRows] = await Promise.all([
    drizzleDb.select().from(autoReplyConditions),
    drizzleDb.select().from(autoReplyActions),
  ]);

  // Filter to relevant rules and group
  const conditionsByRule = new Map<number, typeof conditionRows>();
  for (const c of conditionRows) {
    if (ruleIds.includes(c.ruleId)) {
      const list = conditionsByRule.get(c.ruleId) || [];
      list.push(c);
      conditionsByRule.set(c.ruleId, list);
    }
  }

  const actionsByRule = new Map<number, typeof actionRows>();
  for (const a of actionRows) {
    if (ruleIds.includes(a.ruleId)) {
      const list = actionsByRule.get(a.ruleId) || [];
      list.push(a);
      actionsByRule.set(a.ruleId, list);
    }
  }

  return ruleRows.map((rule) => ({
    id: rule.id,
    teamId: rule.teamId,
    name: rule.name,
    triggerType: rule.triggerType as TriggerType,
    priority: rule.priority,
    isActive: rule.isActive ?? true,
    allowPushFallback: rule.allowPushFallback ?? false,
    createdBy: rule.createdBy,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    deletedAt: rule.deletedAt,
    conditions: (conditionsByRule.get(rule.id) || []).map((c) => ({
      id: c.id,
      ruleId: c.ruleId,
      conditionType: c.conditionType as 'exact' | 'contains' | 'regex' | 'message_type',
      value: c.value,
      caseSensitive: c.caseSensitive ?? false,
      matchMode: (c.matchMode || 'any') as 'any' | 'all',
    })),
    actions: (actionsByRule.get(rule.id) || []).map((a) => ({
      id: a.id,
      ruleId: a.ruleId,
      actionType: a.actionType as 'reply_text' | 'reply_image' | 'reply_flex',
      content: a.content,
      sortOrder: a.sortOrder ?? 0,
    })),
  }));
}

/**
 * Invalidate KV cache for a team's rules (or global rules when teamId is null).
 */
export async function invalidateRulesCache(
  teamId: number | null,
  env: Bindings
): Promise<void> {
  try {
    if (teamId === null) {
      await env.CACHE.delete(`${KV_RULES_PREFIX}global`);
    } else {
      await env.CACHE.delete(`${KV_RULES_PREFIX}${teamId}`);
    }
  } catch { /* non-fatal */ }
}

/**
 * Save auto-reply as a system message in the messages table.
 */
async function saveAutoReplyMessage(
  env: Bindings,
  conversationId: string,
  content: string
): Promise<void> {
  const drizzleDb = createDbClient(env.DB);
  const messageId = uuidv4();

  await drizzleDb.insert(messages).values({
    id: messageId,
    conversationId,
    senderType: 'system',
    content,
    messageType: 'text',
    isSent: true,
    deliveryStatus: 'delivered',
    senderName: 'Auto-Reply',
    createdAt: nowISO(),
  });
}

/**
 * Insert an audit log entry.
 */
async function insertAutoReplyLog(
  env: Bindings,
  logData: {
    ruleId: number;
    conversationId: string;
    customerId: number;
    triggerContent: string;
    responseContent: string;
    matchedCondition: string;
    platform: string;
    replyMethod: string;
  }
): Promise<void> {
  try {
    const drizzleDb = createDbClient(env.DB);
    await drizzleDb.insert(autoReplyLogs).values({
      ruleId: logData.ruleId,
      conversationId: logData.conversationId,
      customerId: logData.customerId,
      triggerContent: logData.triggerContent,
      responseContent: logData.responseContent,
      matchedCondition: logData.matchedCondition,
      platform: logData.platform,
      replyMethod: logData.replyMethod,
      createdAt: nowISO(),
    });
  } catch (error) {
    // Non-fatal: logging should not break the auto-reply flow
    log.error('Failed to insert auto-reply log', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Broadcast auto-reply message via WebSocket.
 */
async function broadcastAutoReply(
  env: Bindings,
  conversationId: string,
  content: string,
  teamId: number | undefined
): Promise<void> {
  try {
    const broadcastService = new WebSocketBroadcastService(env);
    await broadcastService.broadcastNewMessage({
      conversationId,
      message: {
        id: uuidv4(),
        content,
        messageType: 'text',
        senderType: 'agent', // System messages broadcast as 'agent' (closest available type)
        senderId: 'auto-reply',
        senderName: 'Auto-Reply',
        platform: 'line',
        timestamp: nowMs(),
        deliveryStatus: 'delivered',
      },
      source: 'api',
      teamId,
    });
  } catch (error) {
    // Non-fatal: broadcast failure should not break auto-reply
    log.warn('Failed to broadcast auto-reply', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Build a human-readable summary of the response content for logging/display.
 */
function buildResponseSummary(actions: AutoReplyRuleWithRelations['actions']): string {
  if (actions.length === 0) return '';

  const firstAction = actions[0];
  try {
    if (firstAction.actionType === 'reply_text') {
      const parsed = JSON.parse(firstAction.content) as { text: string };
      return parsed.text;
    }
    if (firstAction.actionType === 'reply_image') {
      return '[Auto-Reply Image]';
    }
    if (firstAction.actionType === 'reply_flex') {
      return '[Auto-Reply Flex Message]';
    }
  } catch {
    // fallback
  }
  return '[Auto-Reply]';
}
