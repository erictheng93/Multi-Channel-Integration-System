// Analytics sub-module: agent performance metrics
import { createDbClient } from '../db/drizzle-factory';
import { sql, eq, and, gte, lte, count, avg, sum } from 'drizzle-orm';
import { metrics, conversations, messages } from '../db/schema';

// Get conversation metrics for an agent within a period
export async function getConversationMetrics(
  db: D1Database,
  _agentId: number,
  period: { start: number; end: number }
) {
  const drizzle = createDbClient(db);
  const result = await drizzle
    .select({
      totalConversations: count().as('total_conversations'),
      activeConversations: sql`COUNT(CASE WHEN ${conversations.status} = 'active' THEN 1 END)`.as('active_conversations'),
      closedConversations: sql`COUNT(CASE WHEN ${conversations.status} = 'closed' THEN 1 END)`.as('closed_conversations'),
      avgFirstResponseTime: sql`AVG(
        CASE
          WHEN ${conversations.firstResponseAt} IS NOT NULL
          THEN (${conversations.firstResponseAt} - ${conversations.createdAt}) / 1000
        END
      )`.as('avg_first_response_time'),
      avgResolutionTime: sql`AVG(
        CASE
          WHEN ${conversations.closedAt} IS NOT NULL
          THEN (${conversations.closedAt} - ${conversations.createdAt}) / 1000
        END
      )`.as('avg_resolution_time')
    })
    .from(conversations)
    // Note: Individual assignment (assignedUserId) removed - filtering by team is required at a higher level
    .where(and(
      gte(conversations.createdAt, period.start.toString()),
      lte(conversations.createdAt, period.end.toString())
    ))
    .get();

  return {
    totalConversations: Number(result?.totalConversations) || 0,
    activeConversations: Number(result?.activeConversations) || 0,
    closedConversations: Number(result?.closedConversations) || 0,
    averageResponseTime: 0, // This field seems to be missing from the query
    averageResolutionTime: Number(result?.avgResolutionTime) || 0,
    firstResponseTime: Number(result?.avgFirstResponseTime) || 0
  };
}

// Get message metrics for an agent within a period
export async function getMessageMetrics(
  db: D1Database,
  _agentId: number,
  period: { start: number; end: number }
) {
  const drizzle = createDbClient(db);
  const result = await drizzle
    .select({
      totalMessages: count().as('total_messages'),
      messagesSent: sql`COUNT(CASE WHEN ${messages.senderType} = 'agent' THEN 1 END)`.as('messages_sent'),
      messagesReceived: sql`COUNT(CASE WHEN ${messages.senderType} = 'customer' THEN 1 END)`.as('messages_received'),
      uniqueConversations: sql`COUNT(DISTINCT ${messages.conversationId})`.as('unique_conversations')
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    // Note: Individual assignment (assignedUserId) removed - filtering by team is required at a higher level
    .where(and(
      gte(messages.createdAt, period.start.toString()),
      lte(messages.createdAt, period.end.toString())
    ))
    .get();

  const totalMessages = Number(result?.totalMessages) || 0;
  const uniqueConversations = Number(result?.uniqueConversations) || 1;

  return {
    totalMessages,
    messagesPerConversation: totalMessages / uniqueConversations,
    messagesSent: Number(result?.messagesSent) || 0,
    messagesReceived: Number(result?.messagesReceived) || 0
  };
}

// Get work time metrics for an agent within a period
export async function getWorkTimeMetrics(
  db: D1Database,
  agentId: number,
  period: { start: number; end: number }
) {
  const drizzle = createDbClient(db);
  const result = await drizzle
    .select({
      totalWorkTime: sum(metrics.metricValue).as('total_work_time')
    })
    .from(metrics)
    .where(and(
      eq(metrics.metricName, 'agent_work_time'),
      sql`JSON_EXTRACT(${metrics.tags}, '$.agent_id') = ${agentId.toString()}`,
      gte(metrics.timestamp, period.start),
      lte(metrics.timestamp, period.end)
    ))
    .get();

  const totalWorkTime = Number(result?.totalWorkTime) || 0;

  return {
    totalWorkTime,
    activeTime: totalWorkTime * 0.8, // 80% active time assumption
    idleTime: totalWorkTime * 0.2,
    utilizationRate: 80
  };
}

// Get satisfaction metrics for an agent within a period
export async function getSatisfactionMetrics(
  db: D1Database,
  agentId: number,
  period: { start: number; end: number }
) {
  const drizzle = createDbClient(db);
  const result = await drizzle
    .select({
      avgRating: avg(metrics.metricValue).as('avg_rating'),
      totalRatings: count().as('total_ratings'),
      positiveRatings: sql`COUNT(CASE WHEN ${metrics.metricValue} >= 4 THEN 1 END)`.as('positive_ratings'),
      negativeRatings: sql`COUNT(CASE WHEN ${metrics.metricValue} < 3 THEN 1 END)`.as('negative_ratings')
    })
    .from(metrics)
    .where(and(
      eq(metrics.metricName, 'customer_satisfaction'),
      sql`JSON_EXTRACT(${metrics.tags}, '$.agent_id') = ${agentId.toString()}`,
      gte(metrics.timestamp, period.start),
      lte(metrics.timestamp, period.end)
    ))
    .get();

  const totalRatings = Number(result?.totalRatings) || 0;
  const positiveRatings = Number(result?.positiveRatings) || 0;

  return {
    averageRating: Number(result?.avgRating) || 0,
    totalRatings,
    positiveRatings,
    negativeRatings: Number(result?.negativeRatings) || 0,
    satisfactionRate: totalRatings > 0 ? (positiveRatings / totalRatings) * 100 : 0
  };
}

// Get agent name by ID
export async function getAgentName(db: D1Database, agentId: number): Promise<string> {
  const drizzle = createDbClient(db);
  const { agents } = await import('../db/schema');

  const agent = await drizzle
    .select({
      displayName: agents.displayName
    })
    .from(agents)
    .where(eq(agents.id, String(agentId)))
    .get();

  return agent?.displayName || `Agent ${agentId}`;
}
