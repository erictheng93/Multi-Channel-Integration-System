import type { Team, DbUser, QueryParams, DatabaseRow } from '../types';

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
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    INSERT INTO teams (name, description, qr_code, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    teamData.name,
    teamData.description || null,
    teamData.qrCode || null,
    teamData.isActive !== false ? 1 : 0,
    now,
    now
  ).run();

  if (!result.success) {
    throw new Error('Failed to create team');
  }

  return getTeamById(db, result.meta.last_row_id as number);
}

// 獲取團隊詳情
export async function getTeamById(db: D1Database, teamId: number): Promise<Team> {
  const team = await db.prepare(`
    SELECT * FROM teams WHERE id = ?
  `).bind(teamId).first();

  if (!team) {
    throw new Error('Team not found');
  }

  return {
    id: team.id as number,
    name: team.name as string,
    description: team.description as string | null,
    qrCode: team.qr_code as string | null,
    isActive: Boolean(team.is_active),
    createdAt: team.created_at as string,
    updatedAt: team.updated_at as string
  };
}

// 獲取所有團隊
export async function getAllTeams(
  db: D1Database,
  includeInactive: boolean = false
): Promise<Team[]> {
  const query = includeInactive 
    ? 'SELECT * FROM teams ORDER BY name'
    : 'SELECT * FROM teams WHERE is_active = 1 ORDER BY name';
    
  const result = await db.prepare(query).all();
  
  return result.results.map(team => ({
    id: team.id as number,
    name: team.name as string,
    description: team.description as string | null,
    qrCode: team.qr_code as string | null,
    isActive: Boolean(team.is_active),
    createdAt: team.created_at as string,
    updatedAt: team.updated_at as string
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
  const now = new Date().toISOString();
  const setParts: string[] = [];
  const values: QueryParams = [];

  if (updates.name !== undefined) {
    setParts.push('name = ?');
    values.push(updates.name);
  }
  
  if (updates.description !== undefined) {
    setParts.push('description = ?');
    values.push(updates.description);
  }
  
  if (updates.qrCode !== undefined) {
    setParts.push('qr_code = ?');
    values.push(updates.qrCode);
  }
  
  if (updates.isActive !== undefined) {
    setParts.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
  }

  if (setParts.length === 0) {
    throw new Error('No updates provided');
  }

  setParts.push('updated_at = ?');
  values.push(now, teamId);

  const result = await db.prepare(`
    UPDATE teams SET ${setParts.join(', ')} WHERE id = ?
  `).bind(...values).run();

  if (!result.success) {
    throw new Error('Failed to update team');
  }

  return getTeamById(db, teamId);
}

// 刪除團隊（軟刪除）
export async function deleteTeam(db: D1Database, teamId: number): Promise<void> {
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    UPDATE teams SET is_active = 0, updated_at = ? WHERE id = ?
  `).bind(now, teamId).run();

  if (!result.success) {
    throw new Error('Failed to delete team');
  }
}

// 獲取團隊成員
export async function getTeamMembers(db: D1Database, teamId: number): Promise<DbUser[]> {
  const result = await db.prepare(`
    SELECT u.*, t.name as team_name
    FROM users u
    LEFT JOIN teams t ON u.team_id = t.id
    WHERE u.team_id = ? AND u.is_active = 1
    ORDER BY u.display_name
  `).bind(teamId).all();

  return result.results.map(user => ({
    id: user.id as number,
    username: user.display_name as string,  // 使用 display_name 替代 username
    email: user.email as string,
    displayName: user.display_name as string,
    role: user.role as 'admin' | 'agent',
    teamId: user.team_id as number | null,
    teamName: user.team_name as string | null,
    isActive: Boolean(user.is_active),
    createdAt: user.created_at as string,
    updatedAt: user.updated_at as string
  }));
}

// 將用戶添加到團隊
export async function addUserToTeam(
  db: D1Database,
  userId: number,
  teamId: number
): Promise<void> {
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    UPDATE users SET team_id = ?, updated_at = ? WHERE id = ?
  `).bind(teamId, now, userId).run();

  if (!result.success) {
    throw new Error('Failed to add user to team');
  }
}

// 從團隊移除用戶
export async function removeUserFromTeam(
  db: D1Database,
  userId: number
): Promise<void> {
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    UPDATE users SET team_id = NULL, updated_at = ? WHERE id = ?
  `).bind(now, userId).run();

  if (!result.success) {
    throw new Error('Failed to remove user from team');
  }
}

// 生成團隊專屬 QR Code
export async function generateTeamQRCode(
  db: D1Database,
  teamId: number,
  baseUrl: string = 'https://multi-channel.imfinethankyouandyou.com'
): Promise<string> {
  // 生成唯一的 QR Code 標識符
  const qrCodeId = `team_${teamId}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  // 構建 QR Code URL（用戶掃描後會被導向這個 URL）
  const qrCodeUrl = `${baseUrl}/join?team=${qrCodeId}`;
  
  // 更新團隊的 QR Code
  await updateTeam(db, teamId, { qrCode: qrCodeId });
  
  return qrCodeUrl;
}

// 通過 QR Code 獲取團隊
export async function getTeamByQRCode(db: D1Database, qrCode: string): Promise<Team | null> {
  const team = await db.prepare(`
    SELECT * FROM teams WHERE qr_code = ? AND is_active = 1
  `).bind(qrCode).first();

  if (!team) {
    return null;
  }

  return {
    id: team.id as number,
    name: team.name as string,
    description: team.description as string | null,
    qrCode: team.qr_code as string | null,
    isActive: Boolean(team.is_active),
    createdAt: team.created_at as string,
    updatedAt: team.updated_at as string
  };
}

// 獲取團隊統計信息
export async function getTeamStats(db: D1Database, teamId: number): Promise<{
  memberCount: number;
  activeConversations: number;
  totalMessages: number;
  avgResponseTime: number | null;
}> {
  // 獲取成員數量
  const memberResult = await db.prepare(`
    SELECT COUNT(*) as count FROM users WHERE team_id = ? AND is_active = 1
  `).bind(teamId).first();
  
  // 獲取活躍對話數量
  const conversationResult = await db.prepare(`
    SELECT COUNT(*) as count FROM conversations 
    WHERE assigned_team_id = ? AND status IN ('open', 'pending')
  `).bind(teamId).first();
  
  // 獲取總消息數量
  const messageResult = await db.prepare(`
    SELECT COUNT(*) as count FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.assigned_team_id = ?
  `).bind(teamId).first();
  
  // 計算平均回應時間（簡化版本）
  const responseTimeResult = await db.prepare(`
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
    WHERE c.assigned_team_id = ? 
      AND m1.sender_type = 'customer' 
      AND m2.sender_type = 'agent'
      AND m1.created_at >= datetime('now', '-30 days')
  `).bind(teamId).first();

  return {
    memberCount: memberResult?.count as number || 0,
    activeConversations: conversationResult?.count as number || 0,
    totalMessages: messageResult?.count as number || 0,
    avgResponseTime: responseTimeResult?.avg_response_time as number || null
  };
}

// 獲取團隊的對話列表
export async function getTeamConversations(
  db: D1Database,
  teamId: number,
  status?: 'open' | 'closed' | 'pending',
  limit: number = 50,
  offset: number = 0
): Promise<DatabaseRow[]> {
  let query = `
    SELECT 
      c.*,
      cu.display_name as customer_name,
      cu.platform,
      cu.platform_user_id,
      u.display_name as assigned_agent_name,
      t.name as team_name,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
      (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
    FROM conversations c
    LEFT JOIN customers cu ON c.customer_id = cu.id
    LEFT JOIN users u ON c.assigned_agent_id = u.id
    LEFT JOIN teams t ON c.assigned_team_id = t.id
    WHERE c.assigned_team_id = ?
  `;
  
  const params: QueryParams = [teamId];
  
  if (status) {
    query += ' AND c.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const result = await db.prepare(query).bind(...params).all();
  
  return result.results;
}

// 轉移對話到其他團隊
export async function transferConversationToTeam(
  db: D1Database,
  conversationId: number,
  targetTeamId: number,
  transferredBy: number,
  reason?: string
): Promise<void> {
  const now = new Date().toISOString();
  
  // 開始事務
  const updateResult = await db.prepare(`
    UPDATE conversations 
    SET assigned_team_id = ?, assigned_agent_id = NULL, updated_at = ?
    WHERE id = ?
  `).bind(targetTeamId, now, conversationId).run();

  if (!updateResult.success) {
    throw new Error('Failed to transfer conversation');
  }

  // 記錄轉移歷史
  await db.prepare(`
    INSERT INTO conversation_transfers 
    (conversation_id, from_team_id, to_team_id, transferred_by, reason, created_at)
    VALUES (?, 
      (SELECT assigned_team_id FROM conversations WHERE id = ? LIMIT 1),
      ?, ?, ?, ?
    )
  `).bind(conversationId, conversationId, targetTeamId, transferredBy, reason || null, now).run();
}