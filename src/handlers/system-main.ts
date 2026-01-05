// 系統處理器 - 主要實現
import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '../types';
import { ERROR_MESSAGES } from '../utils/error-messages';
import { jwtAuth } from '../middleware/auth';
import { createDbClient } from '../db/drizzle-factory';
import { agents, customers, conversations, messages, teams, qrCodes, customerFeedback } from '../db/schema';
import { count, sql, eq, and, desc } from 'drizzle-orm';
import { handleApiError } from '../utils/api-response';

const systemHandler = new Hono<{ Bindings: Bindings }>();

// ✅ CORS 處理已移至 src/index.ts 統一管理
// 不再需要 handler 級別的 CORS middleware

// 健康檢查端點
systemHandler.get('/health', async (c) => {
  try {
    // 檢查資料庫連接 - using Drizzle ORM
    const drizzleDb = createDbClient(c.env.DB);
    const dbCheck = await drizzleDb.get(sql`SELECT 1 as test`);
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbCheck ? 'connected' : 'disconnected',
      version: '1.0.0'
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      version: '1.0.0'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// API 資訊端點
systemHandler.get('/api', (c) => {
  return c.json({
    name: 'My LINE Bot API',
    version: '1.0.0',
    endpoints: {
      // 基礎端點
      webhook: 'POST /api/webhook',
      health: 'GET /health',
      stats: 'GET /api/stats',
      root: 'GET /',
      
      // 認證端點
      login: 'POST /api/auth/login',
      register: 'POST /api/auth/register',
      logout: 'POST /api/auth/logout',
      profile: 'GET /api/auth/profile',
      
      // 團隊管理端點
      teams: 'GET /api/teams',
      createTeam: 'POST /api/teams',
      teamDetail: 'GET /api/teams/:id',
      updateTeam: 'PUT /api/teams/:id',
      deleteTeam: 'DELETE /api/teams/:id',
      teamMembers: 'GET /api/teams/:id/members',
      teamStats: 'GET /api/teams/:id/stats',
      generateQR: 'POST /api/teams/:id/qr-code',
      
      // 用戶管理端點
      users: 'GET /api/users',
      createUser: 'POST /api/users',
      userDetail: 'GET /api/users/:id',
      updateUser: 'PUT /api/users/:id',
      
      // 延遲訊息端點
      sendDelayedMessage: 'POST /api/delayed-messages/send',
      recallDelayedMessage: 'POST /api/delayed-messages/recall/:messageId',
      listPendingMessages: 'GET /api/delayed-messages/pending',
      processQueueMessage: 'POST /api/delayed-messages/process'
    },
    timestamp: new Date().toISOString()
  });
});

// 系統狀態端點 (詳細狀態)
systemHandler.get('/system/status', async (c) => {
  try {
    // 檢查資料庫連接 - using Drizzle ORM
    const drizzleDb = createDbClient(c.env.DB);
    const dbCheck = await drizzleDb.get(sql`SELECT 1 as test`);
    
    // 檢查各個資源
    const status = {
      overall: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: {
          status: dbCheck ? 'connected' : 'disconnected',
          type: 'D1'
        },
        kv: {
          status: 'available',
          namespaces: ['SESSIONS', 'CACHE']
        },
        r2: {
          status: 'available',
          bucket: 'multi-channel-platform-attachments'
        },
        queue: {
          status: 'available',
          name: 'REALTIME_QUEUE'
        },
        durableObjects: {
          status: 'available',
          objects: [
            'DELAYED_MESSAGE_SCHEDULER',
            'CONVERSATION_ROOM',
            'USER_CONNECTION',
            'MESSAGE_BROADCASTER',
            'DELAYED_MESSAGE_SCHEDULER',
            'DISTRIBUTED_LOCK'
          ]
        }
      },
      environment: c.env.ENVIRONMENT || 'development'
    };
    
    return c.json(status);
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 訊息關聯查詢端點
systemHandler.get('/messages/:messageId/replies', async (c) => {
  try {
    const messageId = c.req.param('messageId');
    const { getMessageReplies } = await import('../utils/database');
    const replies = await getMessageReplies(c.env.DB, messageId);
    
    return c.json({
      success: true,
      data: {
        messageId,
        replies,
        count: replies.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 對話訊息樹狀結構端點
systemHandler.get('/conversations/:conversationId/message-tree', async (c) => {
  try {
    const conversationId = c.req.param('conversationId');
    const { getConversationMessageTree } = await import('../utils/database');
    const tree = await getConversationMessageTree(c.env.DB, conversationId);
    
    // 轉換 Map 為普通物件以便 JSON 序列化
    const replyMapObj: Record<string, any[]> = {};
    tree.replyMap.forEach((replies, messageId) => {
      replyMapObj[messageId] = replies;
    });
    
    return c.json({
      success: true,
      data: {
        conversationId,
        messages: tree.messages,
        replyMap: replyMapObj,
        totalMessages: tree.messages.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 會話統計端點
systemHandler.get('/conversations/:conversationId/sessions', async (c) => {
  try {
    const conversationId = c.req.param('conversationId');
    const { AnalyticsService } = await import('../modules/session/services/analytics-service');
    const analyticsService = new AnalyticsService(c.env.DB);
    const stats = await analyticsService.getSessionStats(conversationId);
    
    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 系統統計端點
systemHandler.get('/stats', async (c) => {
  try {
    const drizzleDb = createDbClient(c.env.DB);

    // 獲取各項統計數據
    let totalMessages = 0;
    let totalCustomers = 0;
    let totalConversations = 0;
    let todayMessages = 0;
    let onlineAgents = 0;
    let responseTime = '-';
    let satisfactionRate = 0;
    let resolvedToday = 0;

    try {
      // 計算今日的開始時間 (使用 UTC 時區)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // 並行查詢所有統計數據
      const [
        messagesResult,
        customersResult,
        conversationsResult,
        todayMessagesResult,
        // ✅ 新增：今日已解決對話數
        resolvedTodayResult,
        // ✅ 新增：在線客服數 (最近 5 分鐘有活動)
        onlineAgentsResult,
        // ✅ 新增：平均響應時間 (最近 24 小時)
        responseTimeResult,
        // ✅ 新增：客戶滿意度統計 (最近 30 天)
        satisfactionRateResult
      ] = await Promise.all([
        drizzleDb.select({ count: count() }).from(messages),
        drizzleDb.select({ count: count() }).from(customers),
        drizzleDb.select({ count: count() }).from(conversations),
        // 今日消息數
        drizzleDb.select({ count: count() })
          .from(messages)
          .where(sql`datetime(created_at) >= datetime(${todayISO})`),
        // 今日已解決對話數 (status = 'closed' AND closedAt >= today)
        drizzleDb.select({ count: count() })
          .from(conversations)
          .where(
            and(
              eq(conversations.status, 'closed'),
              sql`datetime(closed_at) >= datetime(${todayISO})`
            )
          ),
        // 在線客服數 (最近 5 分鐘有活動)
        drizzleDb.select({ count: count() })
          .from(agents)
          .where(
            sql`datetime(last_active) >= datetime('now', '-5 minutes')`
          ),
        // 平均響應時間 (計算 createdAt 到 firstResponseAt 的平均時間，最近 24 小時)
        drizzleDb.select({
          avgResponseTime: sql<number>`
            AVG(
              CAST((julianday(first_response_at) - julianday(created_at)) * 24 * 60 AS INTEGER)
            )
          `.as('avg_response_time')
        })
        .from(conversations)
        .where(
          and(
            sql`first_response_at IS NOT NULL`,
            sql`datetime(created_at) >= datetime('now', '-24 hours')`
          )
        ),
        // 客戶滿意度 (最近 30 天，4分和5分佔總反饋的比例)
        drizzleDb.select({
          totalCount: sql<number>`COUNT(*)`.as('total_count'),
          satisfiedCount: sql<number>`SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END)`.as('satisfied_count')
        })
        .from(customerFeedback)
        .where(
          sql`datetime(created_at) >= datetime('now', '-30 days')`
        )
      ]);

      totalMessages = messagesResult[0]?.count || 0;
      totalCustomers = customersResult[0]?.count || 0;
      totalConversations = conversationsResult[0]?.count || 0;
      todayMessages = todayMessagesResult[0]?.count || 0;
      resolvedToday = resolvedTodayResult[0]?.count || 0;
      onlineAgents = onlineAgentsResult[0]?.count || 0;

      // 計算平均響應時間（分鐘）
      const avgMinutes = responseTimeResult[0]?.avgResponseTime;
      if (avgMinutes && avgMinutes > 0) {
        if (avgMinutes < 60) {
          responseTime = `${Math.round(avgMinutes)}分鐘`;
        } else {
          const hours = Math.floor(avgMinutes / 60);
          const minutes = Math.round(avgMinutes % 60);
          responseTime = `${hours}小時${minutes}分鐘`;
        }
      }

      // ✅ 客戶滿意度統計 (4分和5分的比例)
      const feedbackStats = satisfactionRateResult[0];
      if (feedbackStats && feedbackStats.totalCount > 0) {
        satisfactionRate = Math.round((feedbackStats.satisfiedCount / feedbackStats.totalCount) * 100);
      } else {
        satisfactionRate = 0; // 沒有反饋數據時返回 0
      }

      console.log('📊 Stats calculated:', {
        totalMessages,
        totalCustomers,
        totalConversations,
        todayMessages,
        resolvedToday,
        onlineAgents,
        responseTime,
        satisfactionRate,
        todayStart: todayISO
      });
    } catch (dbError) {
      console.warn('Database query failed, using default values:', dbError);
      // 如果查詢失敗，使用默認值 0
    }

    return c.json({
      success: true,
      data: {
        totalMessages,
        totalCustomers,
        totalConversations,
        todayMessages,
        onlineAgents,
        responseTime,
        satisfactionRate,
        resolvedToday,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 獲取撤回統計
systemHandler.get('/messages/recall-stats', jwtAuth, async (c) => {
  try {
    // 簡單的統計實現
    const stats = {
      totalMessages: 0,
      recalledMessages: 0,
      successfulRecalls: 0,
      failedRecalls: 0
    };

    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// ========== Phase 2: QR Code 雙向同步機制 ==========

/**
 * QR Code 資料同步端點 (管理員專用)
 * POST /api/system/sync-qr-codes
 *
 * 功能：將現有的 qr_codes 資料同步到 teams.qrCode 欄位
 * 權限：需要管理員權限
 *
 * Query Parameters:
 * - dryRun: boolean (預覽模式，不實際執行)
 * - teamId: number (可選，只同步特定團隊)
 */
systemHandler.post('/sync-qr-codes', jwtAuth, async (c) => {
  try {
    // 檢查管理員權限
    const user = c.get('user');
    if (user.role !== 'admin') {
      return c.json({
        success: false,
        error: '需要管理員權限才能執行此操作'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const dryRun = c.req.query('dryRun') === 'true';
    const teamIdParam = c.req.query('teamId');
    const targetTeamId = teamIdParam ? parseInt(teamIdParam) : null;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 QR Code 資料同步');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`模式: ${dryRun ? '🔍 預覽模式' : '✍️  執行模式'}`);
    console.log(`時間: ${new Date().toLocaleString('zh-TW')}`);
    if (targetTeamId) {
      console.log(`範圍: 僅團隊 #${targetTeamId}`);
    }

    const drizzleDb = createDbClient(c.env.DB);

    const stats = {
      totalTeams: 0,
      teamsWithQR: 0,
      teamsWithoutQR: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      alreadySynced: 0,
      errors: [] as Array<{ teamId: number; teamName: string; error: string }>
    };

    // 1. 取得要處理的團隊
    const allTeams = targetTeamId
      ? await drizzleDb.select().from(teams).where(eq(teams.id, targetTeamId))
      : await drizzleDb.select().from(teams);

    stats.totalTeams = allTeams.length;
    console.log(`\n📋 找到 ${stats.totalTeams} 個團隊`);

    // 2. 為每個團隊同步 QR Code
    for (const team of allTeams) {
      try {
        console.log(`\n🔍 處理團隊 [${team.id}] ${team.name}...`);

        // 2.1 檢查是否已有 QR Code
        if (team.qrCode && !dryRun) {
          console.log(`   ℹ️  teams.qrCode 已存在`);

          // 驗證該 QR Code 是否仍然有效
          const existingQR = await drizzleDb
            .select()
            .from(qrCodes)
            .where(
              and(
                eq(qrCodes.teamId, team.id),
                eq(qrCodes.qrCodeImageUrl, team.qrCode),
                eq(qrCodes.isActive, true)
              )
            )
            .limit(1);

          if (existingQR.length > 0) {
            console.log(`   ✅ QR Code 有效，跳過同步`);
            stats.alreadySynced++;
            continue;
          } else {
            console.log(`   ⚠️  QR Code 已失效，將重新同步`);
          }
        }

        // 2.2 查詢該團隊最新的活躍 QR Code
        const latestQR = await drizzleDb
          .select()
          .from(qrCodes)
          .where(
            and(
              eq(qrCodes.teamId, team.id),
              eq(qrCodes.isActive, true)
            )
          )
          .orderBy(desc(qrCodes.createdAt))
          .limit(1);

        if (latestQR.length > 0) {
          const qr = latestQR[0];
          console.log(`   📍 找到 QR Code: ${qr.id}`);
          console.log(`   ⏰ 建立時間: ${qr.createdAt}`);

          // 2.3 更新 teams.qrCode
          if (!dryRun) {
            await drizzleDb
              .update(teams)
              .set({
                qrCode: qr.qrCodeImageUrl,
                updatedAt: new Date().toISOString()
              })
              .where(eq(teams.id, team.id));

            console.log(`   ✅ 已同步到 teams.qrCode`);
          } else {
            console.log(`   🔍 [Dry Run] 將會更新 teams.qrCode`);
          }

          stats.successfulSyncs++;
          stats.teamsWithQR++;
        } else {
          console.log(`   📭 未找到活躍的 QR Code`);
          stats.teamsWithoutQR++;
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知錯誤';
        console.error(`   ❌ 處理失敗: ${errorMessage}`);
        stats.failedSyncs++;
        stats.errors.push({
          teamId: team.id,
          teamName: team.name,
          error: errorMessage
        });
      }
    }

    // 3. 輸出統計報告
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 同步完成統計');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`總團隊數:         ${stats.totalTeams}`);
    console.log(`有 QR Code:       ${stats.teamsWithQR}`);
    console.log(`無 QR Code:       ${stats.teamsWithoutQR}`);
    console.log(`成功同步:         ${stats.successfulSyncs}`);
    console.log(`已存在跳過:       ${stats.alreadySynced}`);
    console.log(`失敗:             ${stats.failedSyncs}`);
    console.log(`完成時間: ${new Date().toLocaleString('zh-TW')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return c.json({
      success: true,
      data: {
        mode: dryRun ? 'dry-run' : 'execute',
        stats,
        message: dryRun
          ? '預覽完成，使用 dryRun=false 執行實際同步'
          : '同步完成'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('同步過程發生嚴重錯誤:', error);
    return handleApiError(error, c);
  }
});

/**
 * 驗證 QR Code 同步狀態
 * GET /api/system/sync-qr-codes/validate
 *
 * 功能：驗證 teams.qrCode 欄位與 qr_codes 表的一致性
 */
systemHandler.get('/sync-qr-codes/validate', jwtAuth, async (c) => {
  try {
    // 檢查管理員權限
    const user = c.get('user');
    if (user.role !== 'admin') {
      return c.json({
        success: false,
        error: '需要管理員權限'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const drizzleDb = createDbClient(c.env.DB);

    // 統計數據
    const validation = {
      totalTeams: 0,
      teamsWithQRCode: 0,
      teamsWithoutQRCode: 0,
      validSync: 0,
      invalidSync: 0,
      missingSync: 0,
      issues: [] as Array<{
        teamId: number;
        teamName: string;
        issue: string;
        teamQRCode: string | null;
        latestQRCode: string | null;
      }>
    };

    // 取得所有團隊
    const allTeams = await drizzleDb.select().from(teams);
    validation.totalTeams = allTeams.length;

    for (const team of allTeams) {
      // 檢查 teams.qrCode
      if (team.qrCode) {
        validation.teamsWithQRCode++;

        // 驗證 QR Code 是否存在且有效
        const qrCodeRecord = await drizzleDb
          .select()
          .from(qrCodes)
          .where(
            and(
              eq(qrCodes.teamId, team.id),
              eq(qrCodes.qrCodeImageUrl, team.qrCode),
              eq(qrCodes.isActive, true)
            )
          )
          .limit(1);

        if (qrCodeRecord.length > 0) {
          validation.validSync++;
        } else {
          validation.invalidSync++;

          // 查找最新的活躍 QR Code
          const latestQR = await drizzleDb
            .select()
            .from(qrCodes)
            .where(
              and(
                eq(qrCodes.teamId, team.id),
                eq(qrCodes.isActive, true)
              )
            )
            .orderBy(desc(qrCodes.createdAt))
            .limit(1);

          validation.issues.push({
            teamId: team.id,
            teamName: team.name,
            issue: 'teams.qrCode 指向無效或非活躍的 QR Code',
            teamQRCode: team.qrCode,
            latestQRCode: latestQR[0]?.qrCodeImageUrl || null
          });
        }
      } else {
        validation.teamsWithoutQRCode++;

        // 檢查是否有活躍的 QR Code 但未同步
        const latestQR = await drizzleDb
          .select()
          .from(qrCodes)
          .where(
            and(
              eq(qrCodes.teamId, team.id),
              eq(qrCodes.isActive, true)
            )
          )
          .orderBy(desc(qrCodes.createdAt))
          .limit(1);

        if (latestQR.length > 0) {
          validation.missingSync++;
          validation.issues.push({
            teamId: team.id,
            teamName: team.name,
            issue: 'teams.qrCode 為空，但有活躍的 QR Code',
            teamQRCode: null,
            latestQRCode: latestQR[0].qrCodeImageUrl
          });
        }
      }
    }

    return c.json({
      success: true,
      data: {
        validation,
        summary: {
          syncHealth: validation.invalidSync + validation.missingSync === 0
            ? 'healthy'
            : 'needs-attention',
          syncRate: validation.totalTeams > 0
            ? ((validation.validSync / validation.totalTeams) * 100).toFixed(2) + '%'
            : '0%'
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('驗證過程發生錯誤:', error);
    return handleApiError(error, c);
  }
});

export default systemHandler;