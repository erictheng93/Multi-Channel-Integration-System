import type { Team, DbUser, DatabaseRow } from '../types';
import { createDbClient } from '../db/drizzle-factory';
import { teams, agents, agentTeams, conversations, messages, conversationTransfers, customers } from '../db/schema';
import { eq, and, count, inArray, sql, desc } from 'drizzle-orm';
import type { NewTeam, NewConversationTransfer } from '../db/schema';
import { nowISO, nowMs } from '@/utils/timestamp'

/**
 * 團隊管理工具函數
 */

// 創建團隊
export async function createTeam(
  db: D1Database,
  teamData: {
    name: string;
    description?: string;
    qrCode?: string;
    isActive?: boolean;
  }
): Promise<Team> {
  const drizzleDb = createDbClient(db);
  const now = nowISO();
  
  const newTeam: NewTeam = {
    name: teamData.name,
    description: teamData.description || null,
    qrCode: teamData.qrCode || null,
    isActive: teamData.isActive !== false,
    createdAt: now,
    updatedAt: now
  };

  const result = await drizzleDb.insert(teams).values(newTeam).returning({ id: teams.id });
  
  if (!result || result.length === 0) {
    throw new Error('Failed to create team');
  }

  if (!result[0]?.id) {
    throw new Error('Failed to get team ID after creation');
  }
  return getTeamById(db, result[0].id);
}

// 獲取團隊詳情
export async function getTeamById(db: D1Database, teamId: number): Promise<Team> {
  const drizzleDb = createDbClient(db);
  
  const team = await drizzleDb
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .get();

  if (!team) {
    throw new Error('Team not found');
  }

  return {
    id: team.id,
    name: team.name,
    description: team.description,
    qrCode: team.qrCode,
    isActive: team.isActive || false,
    createdAt: team.createdAt!,
    updatedAt: team.updatedAt!
  };
}

// 獲取所有團隊
export async function getAllTeams(
  db: D1Database,
  includeInactive: boolean = false
): Promise<Team[]> {
  const drizzleDb = createDbClient(db);
  
  const query = drizzleDb
    .select()
    .from(teams)
    .orderBy(teams.name);
    
  if (!includeInactive) {
    query.where(eq(teams.isActive, true));
  }
    
  const result = await query.all();
  
  return result.map(team => ({
    id: team.id,
    name: team.name,
    description: team.description,
    qrCode: team.qrCode,
    isActive: team.isActive || false,
    createdAt: team.createdAt!,
    updatedAt: team.updatedAt!
  }));
}

// 更新團隊
export async function updateTeam(
  db: D1Database,
  teamId: number,
  updates: {
    name?: string;
    description?: string;
    qrCode?: string;
    isActive?: boolean;
  }
): Promise<Team> {
  const drizzleDb = createDbClient(db);
  const now = nowISO();

  if (Object.keys(updates).length === 0) {
    throw new Error('No updates provided');
  }

  const updateData: Partial<typeof teams.$inferInsert> = {
    updatedAt: now
  };

  if (updates.name !== undefined) {
    updateData.name = updates.name;
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description;
  }
  if (updates.qrCode !== undefined) {
    updateData.qrCode = updates.qrCode;
  }
  if (updates.isActive !== undefined) {
    updateData.isActive = updates.isActive;
  }

  const result = await drizzleDb
    .update(teams)
    .set(updateData)
    .where(eq(teams.id, teamId))
    .returning({ id: teams.id });

  if (!result || result.length === 0) {
    throw new Error('Failed to update team');
  }

  return getTeamById(db, teamId);
}

// 刪除團隊（軟刪除）
export async function deleteTeam(db: D1Database, teamId: number): Promise<void> {
  const drizzleDb = createDbClient(db);
  const now = nowISO();
  
  const result = await drizzleDb
    .update(teams)
    .set({ 
      isActive: false, 
      updatedAt: now 
    })
    .where(eq(teams.id, teamId))
    .returning({ id: teams.id });

  if (!result || result.length === 0) {
    throw new Error('Failed to delete team');
  }
}

// 獲取團隊成員 (via agent_teams junction table)
export async function getTeamMembers(db: D1Database, teamId: number): Promise<DbUser[]> {
  const drizzleDb = createDbClient(db);

  const result = await drizzleDb
    .select({
      id: agents.id,
      email: agents.email,
      displayName: agents.displayName,
      role: agents.role,
      teamId: agentTeams.teamId,
      teamName: teams.name,
      isActive: agents.isActive,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt
    })
    .from(agentTeams)
    .innerJoin(agents, eq(agentTeams.agentId, agents.id))
    .leftJoin(teams, eq(agentTeams.teamId, teams.id))
    .where(and(
      eq(agentTeams.teamId, teamId),
      eq(agents.isActive, true)
    ))
    .orderBy(agents.displayName)
    .all();

  return result.map(user => ({
    id: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
    username: user.displayName,
    email: user.email,
    displayName: user.displayName,
    role: user.role as 'admin' | 'agent',
    primaryTeamId: user.teamId,
    teamName: user.teamName,
    isActive: user.isActive || false,
    createdAt: user.createdAt!,
    updatedAt: user.updatedAt!
  }));
}

// 將用戶添加到團隊 (via agent_teams junction table)
export async function addUserToTeam(
  db: D1Database,
  userId: number | string,
  teamId: number
): Promise<void> {
  const drizzleDb = createDbClient(db);
  const now = nowISO();
  const agentId = String(userId);

  // Check if agent already has any teams — first team becomes primary
  const existingTeams = await drizzleDb
    .select({ teamId: agentTeams.teamId })
    .from(agentTeams)
    .where(eq(agentTeams.agentId, agentId))
    .limit(1);

  const isPrimary = existingTeams.length === 0;

  await drizzleDb.insert(agentTeams).values({
    agentId,
    teamId,
    roleInTeam: 'member',
    isPrimary,
    joinedAt: now
  });
}

// 從團隊移除用戶 (via agent_teams junction table)
export async function removeUserFromTeam(
  db: D1Database,
  userId: number | string,
  teamId?: number
): Promise<void> {
  const drizzleDb = createDbClient(db);
  const agentId = String(userId);

  if (teamId !== undefined) {
    // Remove from specific team
    // Check if this was the primary team
    const [membership] = await drizzleDb
      .select({ isPrimary: agentTeams.isPrimary })
      .from(agentTeams)
      .where(and(eq(agentTeams.agentId, agentId), eq(agentTeams.teamId, teamId)))
      .limit(1);

    await drizzleDb
      .delete(agentTeams)
      .where(and(eq(agentTeams.agentId, agentId), eq(agentTeams.teamId, teamId)));

    // If removed team was primary, promote next remaining team
    if (membership?.isPrimary) {
      const [nextTeam] = await drizzleDb
        .select({ teamId: agentTeams.teamId })
        .from(agentTeams)
        .where(eq(agentTeams.agentId, agentId))
        .limit(1);

      if (nextTeam) {
        await drizzleDb
          .update(agentTeams)
          .set({ isPrimary: true })
          .where(and(eq(agentTeams.agentId, agentId), eq(agentTeams.teamId, nextTeam.teamId)));
      }
    }
  } else {
    // Remove from ALL teams (legacy behavior — clears all memberships)
    await drizzleDb
      .delete(agentTeams)
      .where(eq(agentTeams.agentId, agentId));
  }
}

// 生成團隊專屬 QR Code
// 注意: baseUrl 應從調用方使用 getFrontendUrl(env) 傳入
export async function generateTeamQRCode(
  db: D1Database,
  teamId: number,
  baseUrl: string
): Promise<string> {
  // 生成唯一的 QR Code 標識符
  const qrCodeId = `team_${teamId}_${nowMs()}_${Math.random().toString(36).substring(2, 11)}`;
  
  // 構建 QR Code URL（用戶掃描後會被導向這個 URL）
  const qrCodeUrl = `${baseUrl}/join?team=${qrCodeId}`;
  
  // 更新團隊的 QR Code
  await updateTeam(db, teamId, { qrCode: qrCodeId });
  
  return qrCodeUrl;
}

// 通過 QR Code 獲取團隊
export async function getTeamByQRCode(db: D1Database, qrCode: string): Promise<Team | null> {
  const drizzleDb = createDbClient(db);
  
  const team = await drizzleDb
    .select()
    .from(teams)
    .where(and(
      eq(teams.qrCode, qrCode),
      eq(teams.isActive, true)
    ))
    .get();

  if (!team) {
    return null;
  }

  return {
    id: team.id,
    name: team.name,
    description: team.description,
    qrCode: team.qrCode,
    isActive: team.isActive || false,
    createdAt: team.createdAt!,
    updatedAt: team.updatedAt!
  };
}

// 獲取團隊統計信息
export async function getTeamStats(db: D1Database, teamId: number): Promise<{
  memberCount: number;
  activeConversations: number;
  totalMessages: number;
  avgResponseTime: number | null;
}> {
  const drizzleDb = createDbClient(db);
  
  // 獲取成員數量 (via agent_teams junction table)
  const memberResult = await drizzleDb
    .select({ count: count() })
    .from(agentTeams)
    .innerJoin(agents, eq(agentTeams.agentId, agents.id))
    .where(and(
      eq(agentTeams.teamId, teamId),
      eq(agents.isActive, true)
    ))
    .get();
  
  // 獲取活躍對話數量
  const conversationResult = await drizzleDb
    .select({ count: count() })
    .from(conversations)
    .where(and(
      eq(conversations.assignedTeamId, teamId),
      inArray(conversations.status, ['active', 'pending'])
    ))
    .get();
  
  // 獲取總消息數量
  const messageResult = await drizzleDb
    .select({ count: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.assignedTeamId, teamId))
    .get();
  
  // 計算平均回應時間 - 使用 Drizzle ORM sql 模板
  const responseTimeResult = await drizzleDb.get(
    sql`
      SELECT AVG(
        CASE 
          WHEN m2.created_at IS NOT NULL 
          THEN (julianday(m2.created_at) - julianday(m1.created_at)) * 24 * 60 
          ELSE NULL 
        END
      ) as avg_response_time
      FROM messages m1
      JOIN conversations c ON m1.conversation_id = c.id
      LEFT JOIN messages m2 ON m2.reply_to_message_id = m1.id
      WHERE c.assigned_team_id = ${teamId}
        AND m1.sender_type = 'customer' 
        AND m2.sender_type = 'agent'
        AND m1.created_at >= datetime('now', '-30 days')
    `
  );

  return {
    memberCount: memberResult?.count || 0,
    activeConversations: conversationResult?.count || 0,
    totalMessages: messageResult?.count || 0,
    avgResponseTime: (responseTimeResult as any)?.avg_response_time as number || null
  };
}

// 獲取團隊的對話列表
export async function getTeamConversations(
  db: D1Database,
  teamId: number,
  status?: 'active' | 'closed' | 'pending',
  limit: number = 50,
  offset: number = 0
): Promise<DatabaseRow[]> {
  const drizzleDb = createDbClient(db);
  
  // 使用 Drizzle ORM 構建查詢，但子查詢部分使用 sql 模板
  let baseConditions = [eq(conversations.assignedTeamId, teamId)];
  
  if (status) {
    baseConditions.push(eq(conversations.status, status));
  }
  
  // Note: assignedUserId removed - only team assignment is supported now
  const conversationsResult = await drizzleDb
    .select({
      // conversation fields
      id: conversations.id,
      customerId: conversations.customerId,
      assignedTeamId: conversations.assignedTeamId,
      // Note: assignedUserId removed - only team assignment is supported now
      status: conversations.status,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      // joined fields
      customer_name: customers.displayName,
      platform: customers.platform,
      platform_user_id: customers.platformUserId,
      // Note: assigned_agent_name removed - only team assignment is supported now
      team_name: teams.name,
      // subquery fields using sql template
      message_count: sql<number>`(
        SELECT COUNT(*) FROM messages
        WHERE conversation_id = ${conversations.id}
      )`,
      last_message_at: sql<string>`(
        SELECT created_at FROM messages
        WHERE conversation_id = ${conversations.id}
        ORDER BY created_at DESC LIMIT 1
      )`
    })
    .from(conversations)
    .leftJoin(customers, eq(conversations.customerId, customers.id))
    .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
    .where(and(...baseConditions))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit)
    .offset(offset)
    .all();
  
  return conversationsResult;
}

// 轉移對話到其他團隊
export async function transferConversationToTeam(
  db: D1Database,
  conversationId: string,
  fromTeamId: number | null,
  targetTeamId: number,
  transferredBy: string,
  reason?: string
): Promise<void> {
  const drizzleDb = createDbClient(db);
  const now = nowISO();
  
  // 更新對話分配 (只更新團隊)
  const updateResult = await drizzleDb
    .update(conversations)
    .set({
      assignedTeamId: targetTeamId,
      // Note: assignedUserId removed - only team assignment is supported now
      updatedAt: now
    })
    .where(eq(conversations.id, conversationId))
    .returning({ id: conversations.id });

  if (!updateResult || updateResult.length === 0) {
    throw new Error('Failed to transfer conversation');
  }

  // 記錄轉移歷史
  const transferRecord: NewConversationTransfer = {
    conversationId,
    fromTeamId,
    toTeamId: targetTeamId,
    transferredBy,
    transferReason: reason || null,
    createdAt: now
  };

  await drizzleDb.insert(conversationTransfers).values(transferRecord);
}