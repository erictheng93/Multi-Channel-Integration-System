// src/modules/integrations/handlers/line-follow-handler.ts
// LINE follow/unfollow event processing — extracted from line-event-processor.ts

import { eq, and, ne, desc, isNull } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { customers, conversations, teams, messages } from '@/db/schema';
import type { Bindings, LineEvent } from '@/types';
import { findOrCreateCustomer, updateCustomerProfile } from '../services/webhook-customer-service';
import { v4 as uuidv4 } from 'uuid';
import { ActivityService } from '@modules/activities';
import { createContextLogger } from '@/utils/logger';

import { nowISO, nowMs } from '@/utils/timestamp';
import { evaluateWelcome as autoReplyEvaluateWelcome } from '@modules/auto-reply/services/auto-reply-engine';

const log = createContextLogger('Webhook');

type LineFollowTrackingEvent = LineEvent & {
  follow?: LineEvent['follow'] & { param?: string };
  link?: LineEvent['link'] & { nonce?: string };
  liff?: { context?: { utouId?: string } };
};

type ConversationRow = typeof conversations.$inferSelect;

/**
 * Process LINE Follow event (QR Code friend addition)
 * When a user joins via QR Code scan, auto-assign to the corresponding team
 */
export async function processLineFollowEvent(env: Bindings, event: LineEvent) {
  const trackingEvent = event as LineFollowTrackingEvent;
  const userId = event.source.userId;

  log.info('Processing follow event', {
    userId: userId?.substring(0, 10) + '...',
    timestamp: event.timestamp,
    replyToken: event.replyToken ? 'Present' : 'None'
  });

  if (!userId) {
    log.warn('LINE Follow: No userId in follow event');
    return;
  }

  try {
    const drizzleDb = createDbClient(env.DB);

    // Step 1: Check if user already exists
    let existingCustomer: typeof customers.$inferSelect | null | undefined = await drizzleDb
      .select()
      .from(customers)
      .where(and(
        eq(customers.platformUserId, userId),
        eq(customers.platform, 'line'),
        isNull(customers.deletedAt)
      ))
      .get();

    // Step 2: Get user profile
    let displayName = 'LINE User';
    let avatarUrl: string | null = null;

    try {
      const { createUserSyncService } = await import('@/services/user-sync');
      const userSyncService = createUserSyncService(env);
      const profile = await userSyncService.syncLineUser(userId, event.source.groupId);
      if (profile) {
        displayName = profile.displayName;
        avatarUrl = profile.pictureUrl || null;
      }
    } catch (profileError) {
      log.warn('LINE Follow: Failed to sync user profile', {
        error: profileError instanceof Error ? profileError.message : String(profileError)
      });
    }

    // Step 3: Try to get team ID from QR Code tracking parameter
    let assignedTeamId: number | null = null;
    let qrCodeToken: string | null = null;
    let existingConversation: ConversationRow | null | undefined = null;

    // Try getting tracking parameter from multiple sources
    // Method 1: LINE standard follow.param (if available)
    const followParam = trackingEvent.follow?.param;

    // Method 2: From replyToken related context (some LINE versions support this)
    const linkNonce = trackingEvent.link?.nonce;

    // Method 3: From liff context (if using LIFF)
    const liffParam = trackingEvent.liff?.context?.utouId;

    qrCodeToken = followParam || linkNonce || liffParam || null;

    log.debug('Checking for QR code tracking', {
      followParam: followParam ? 'Present' : 'None',
      linkNonce: linkNonce ? 'Present' : 'None',
      liffParam: liffParam ? 'Present' : 'None',
      qrCodeToken: qrCodeToken ? qrCodeToken.substring(0, 10) + '...' : 'None'
    });

    // Optimization: Execute Step 4, 5, 6 team finding in parallel (from serial to parallel, reduce 40-100ms latency)
    const teamFindStartTime = nowMs();

    // Define parallel find tasks
    const teamFindTasks = await Promise.all([
      // Task 1 (original Step 4): QR Code tracking parameter lookup
      (async (): Promise<{ source: 'qr_token'; teamId: number } | null> => {
        if (!qrCodeToken) return null;
        try {
          const { QRCodeServiceImpl } = await import('@/services/qrcode-service-impl');
          const result = await QRCodeServiceImpl.handleQRCodeFollow(drizzleDb, {
            type: 'follow',
            source: { userId, type: 'user' },
            follow: { param: qrCodeToken },
            timestamp: event.timestamp
          });
          if (result.autoAssigned && result.teamId) {
            return { source: 'qr_token', teamId: result.teamId };
          }
        } catch (qrError) {
          log.warn('LINE Follow: QR code tracking failed', {
            error: qrError instanceof Error ? qrError.message : String(qrError)
          });
        }
        return null;
      })(),

      // Task 2 (original Step 5): customer_team_assignments table lookup (highest priority)
      (async (): Promise<{ source: 'assignment'; teamId: number; assignmentId: string; assignmentSource: string; assignedAt: string; displayName: string | null } | null> => {
        try {
          const { customerTeamAssignments } = await import('@/db/schema');
          const assignment = await drizzleDb
            .select()
            .from(customerTeamAssignments)
            .where(eq(customerTeamAssignments.platformUserId, userId))
            .orderBy(desc(customerTeamAssignments.assignedAt))
            .limit(1)
            .get();
          if (assignment) {
            return {
              source: 'assignment',
              teamId: assignment.teamId,
              assignmentId: assignment.id,
              assignmentSource: assignment.source || 'unknown',
              assignedAt: assignment.assignedAt || '',
              displayName: assignment.displayName ?? null
            };
          }
        } catch (assignmentError) {
          log.warn('LINE Follow: Failed to query customer_team_assignments', {
            error: assignmentError instanceof Error ? assignmentError.message : String(assignmentError)
          });
        }
        return null;
      })()
    ]);

    const [qrTokenResult, assignmentResult] = teamFindTasks;

    // Fallback: use LIFF-captured name if LINE API failed
    if (displayName === 'LINE User' && assignmentResult?.displayName) {
      displayName = assignmentResult.displayName;
      log.info('LINE Follow: Using LIFF-captured displayName as fallback', { displayName });
    }

    // Select result by priority: assignment > qr_token
    // Note: Old recent_qr fallback (qrCodes table) removed, unified to new LIFF system
    if (assignmentResult) {
      assignedTeamId = assignmentResult.teamId;
      log.info('Found team assignment from customer_team_assignments', {
        assignedTeamId,
        assignmentId: assignmentResult.assignmentId,
        source: assignmentResult.assignmentSource,
        assignedAt: assignmentResult.assignedAt
      });
    } else if (qrTokenResult) {
      assignedTeamId = qrTokenResult.teamId;
      log.info('QR Code tracking succeeded, assigned to team', { assignedTeamId });
    }

    const teamFindDuration = Date.now() - teamFindStartTime;
    log.info('Team lookup completed (parallel optimized)', {
      durationMs: teamFindDuration,
      assignedTeamId,
      source: assignmentResult ? 'assignment' : qrTokenResult ? 'qr_token' : 'none'
    });

    const timestamp = nowISO();

    // Step 7: Create or update customer record
    if (!existingCustomer) {
      existingCustomer = await findOrCreateCustomer(env, userId, 'line', {
        sourceTeamId: assignedTeamId ?? undefined,
      });

      if (!existingCustomer) {
        log.error('LINE Follow: Failed to find or create customer', { userId: userId.substring(0, 10) });
        return;
      }

      log.info('Customer created via consolidated service', {
        customerId: existingCustomer.id,
        displayName,
        teamId: assignedTeamId,
      });
    }

    // Update profile with follow event data (name, avatar, metadata)
    const existingMetadata = existingCustomer.metadata
      ? JSON.parse(existingCustomer.metadata as string)
      : {};

    await updateCustomerProfile(env, existingCustomer.id, {
      displayName,
      avatarUrl,
      metadata: {
        ...existingMetadata,
        lastFollowedAt: timestamp,
        ...(assignedTeamId && { assignedViaQR: true, teamId: assignedTeamId }),
      },
    });

    // Step 8: If team assigned, create default conversation
    if (assignedTeamId && existingCustomer) {
      // Check if active conversation already exists
      existingConversation = await drizzleDb
        .select()
        .from(conversations)
        .where(and(
          eq(conversations.customerId, existingCustomer.id),
          ne(conversations.status, 'closed')
        ))
        .get();

      if (!existingConversation) {
        // Create new conversation with team assignment (only team assignment supported, individual removed)
        const conversationId = uuidv4();
        await drizzleDb
          .insert(conversations)
          .values({
            id: conversationId,
            customerId: existingCustomer.id,
            assignedTeamId: assignedTeamId,
            // Note: assignedUserId removed - only team assignment is supported now
            status: 'active',
            priority: 'normal',
            lastMessageAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp
          });

        log.info('Conversation created with team assignment', {
          conversationId,
          customerId: existingCustomer.id,
          teamId: assignedTeamId
        });
      } else if (!existingConversation.assignedTeamId) {
        // Update existing conversation team assignment
        await drizzleDb
          .update(conversations)
          .set({
            assignedTeamId: assignedTeamId,
            updatedAt: timestamp
          })
          .where(eq(conversations.id, existingConversation.id));

        log.info('Updated existing conversation with team', {
          conversationId: existingConversation.id,
          teamId: assignedTeamId
        });
      }
    }

    // Optimization: Unified team info query (avoid duplicate queries in Step 10 and Step 11)
    let teamInfo: { id: number; name: string } | null = null;
    if (assignedTeamId) {
      try {
        const teamResult = await drizzleDb
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(eq(teams.id, assignedTeamId))
          .get();
        if (teamResult) {
          teamInfo = teamResult;
        }
      } catch (teamQueryError) {
        log.warn('LINE Follow: Failed to fetch team info', {
          error: teamQueryError instanceof Error ? teamQueryError.message : String(teamQueryError)
        });
      }
    }

    // Step 8.5: Broadcast auto-assign event to WebSocket (real-time frontend UI update)
    if (assignedTeamId && existingCustomer) {
      // Determine conversation ID (newly created or existing)
      let broadcastConversationId: string | null = null;

      if (!existingConversation) {
        // Newly created conversation needs re-query to get ID
        const newConv = await drizzleDb
          .select({ id: conversations.id })
          .from(conversations)
          .where(and(
            eq(conversations.customerId, existingCustomer.id),
            eq(conversations.assignedTeamId, assignedTeamId)
          ))
          .orderBy(desc(conversations.createdAt))
          .limit(1)
          .get();
        broadcastConversationId = newConv?.id || null;
      } else {
        broadcastConversationId = existingConversation.id;
      }

      if (broadcastConversationId) {
        try {
          const { WebSocketBroadcastService } = await import('@/services/websocket-broadcast-service');
          const broadcastService = new WebSocketBroadcastService(env);

          // Use broadcastConversationTransferred for frontend Reconciliation
          // This triggers frontend 'assigned' action, replacing previous pending conversation
          await broadcastService.broadcastConversationTransferred({
            conversationId: broadcastConversationId,
            fromTeamId: null,
            toTeamId: assignedTeamId,
            toTeamName: teamInfo?.name,
            conversation: {
              id: broadcastConversationId,
              customerId: existingCustomer.id,
              customerName: displayName,
              platform: 'line',
              status: 'active',
              lastMessage: {
                content: '已加入',
                timestamp: nowMs()
              },
              unreadCount: 0,
              assignedTeamId: assignedTeamId,
              assignedTeam: teamInfo ? {
                id: teamInfo.id,
                name: teamInfo.name
              } : undefined,
              // Reconciliation marker: let frontend know this is a Webhook-confirmed real conversation
              _liffMetadata: {
                isPending: false,
                lineUserId: userId, // Used for matching and replacing pending conversation
                isWebhookConfirmation: true
              }
            },
            transferredBy: {
              id: 'system',
              name: 'Auto-Assignment'
            },
            reason: 'QR Code Follow - Auto Assignment'
          });

          log.info('WebSocket broadcast sent for auto-assignment (with reconciliation)', {
            conversationId: broadcastConversationId,
            teamId: assignedTeamId,
            teamName: teamInfo?.name,
            lineUserId: userId.substring(0, 10) + '...'
          });
        } catch (broadcastError) {
          log.warn('LINE Follow: WebSocket broadcast failed (non-blocking)', {
            error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
            conversationId: broadcastConversationId,
            teamId: assignedTeamId
          });
          // Don't let broadcast failure affect main flow
        }
      }
    }

    // Step 9: Log activity
    try {
      const activityService = new ActivityService(env.DB);
      await activityService.logActivity({
        userId: 'system',
        userName: 'Webhook Handler',
        userRole: 'system',
        action: 'customer_followed',
        resourceType: 'customer',
        resourceId: String(existingCustomer?.id || userId),
        details: {
          platform: 'line',
          platformUserId: userId,
          displayName,
          assignedTeamId,
          source: qrCodeToken ? 'qr_code' : 'direct',
          timestamp
        }
      });
      log.debug('Activity logged');
    } catch (activityError) {
      log.warn('LINE Follow: Failed to log activity', {
        error: activityError instanceof Error ? activityError.message : String(activityError)
      });
    }

    log.info('Follow event processed successfully', {
      userId: userId.substring(0, 10) + '...',
      customerId: existingCustomer?.id,
      teamId: assignedTeamId,
      source: qrCodeToken ? 'qr_code' : 'direct'
    });

    // Step 10: Auto-Reply Welcome Message BEFORE notifications (reply tokens expire in ~30s)
    if (event.replyToken && existingCustomer) {
      try {
        // Determine conversation ID for logging
        let welcomeConversationId = existingConversation?.id;
        if (!welcomeConversationId) {
          const newConv = await drizzleDb
            .select({ id: conversations.id })
            .from(conversations)
            .where(and(
              eq(conversations.customerId, existingCustomer.id),
              ne(conversations.status, 'closed')
            ))
            .limit(1)
            .get();
          welcomeConversationId = newConv?.id || '';
        }

        const welcomeResult = await autoReplyEvaluateWelcome(
          assignedTeamId ?? null,
          event.replyToken,
          welcomeConversationId,
          existingCustomer.id,
          userId,
          env
        );

        if (welcomeResult.matched) {
          log.info('Auto-reply welcome rule triggered', {
            ruleId: welcomeResult.ruleId,
            ruleName: welcomeResult.ruleName,
            replyMethod: welcomeResult.replyMethod,
          });
        } else {
          // Fallback: send default hardcoded welcome if no welcome rule configured
          const teamName = teamInfo?.name || '我們的團隊';
          const welcomeMessage = `歡迎加入 ${teamName}！\n\n我們很高興為您服務。如有任何問題，請隨時聯繫我們。`;

          const { sendLineReply, createTextMessage } = await import('@/utils/line');
          const sent = await sendLineReply(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, [createTextMessage(welcomeMessage)]);

          // Store default welcome message in DB so the conversation is not empty
          if (sent && welcomeConversationId) {
            try {
              const messageId = uuidv4();
              const messageTimestamp = nowISO();
              await drizzleDb.insert(messages).values({
                id: messageId,
                conversationId: welcomeConversationId,
                senderType: 'system',
                content: welcomeMessage,
                messageType: 'text',
                isSent: true,
                deliveryStatus: 'delivered',
                senderName: 'Auto-Reply',
                createdAt: messageTimestamp,
              });
              // Update conversation lastMessageAt so list view shows the message
              await drizzleDb.update(conversations)
                .set({ lastMessageAt: messageTimestamp, updatedAt: messageTimestamp })
                .where(eq(conversations.id, welcomeConversationId));
              log.info('Default welcome message stored in DB', { conversationId: welcomeConversationId, messageId });
            } catch (saveError) {
              log.warn('Failed to store default welcome message (non-blocking)', {
                error: saveError instanceof Error ? saveError.message : String(saveError),
              });
            }
          }

          log.info('Default welcome message sent (no auto-reply rule)', {
            userId: userId.substring(0, 10) + '...',
            teamId: assignedTeamId,
          });
        }
      } catch (welcomeError) {
        log.warn('LINE Follow: Failed to send welcome message', {
          error: welcomeError instanceof Error ? welcomeError.message : String(welcomeError)
        });
      }
    }

    // Step 11: Trigger new customer follow notification (uses cached teamInfo to avoid duplicate query)
    try {
      const { triggerCustomerFollowedNotification } = await import('@/utils/notification-trigger');

      await triggerCustomerFollowedNotification(env, {
        customerName: displayName,
        platform: 'LINE',
        source: qrCodeToken ? 'qr_code' : 'direct',
        teamId: assignedTeamId || undefined,
        teamName: teamInfo?.name,
        conversationId: existingConversation?.id
      });

      log.debug('Customer followed notification triggered');
    } catch (notificationError) {
      log.warn('LINE Follow: Failed to trigger customer followed notification', {
        error: notificationError instanceof Error ? notificationError.message : String(notificationError)
      });
    }

  } catch (error) {
    log.error('LINE Follow: Error processing follow event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userIdPrefix: userId.slice(0, 8)
    });
    throw error;
  }
}

/**
 * Process LINE Unfollow event
 * When a user unfollows the official account, update friend status to 'blocked'
 */
export async function processLineUnfollowEvent(env: Bindings, event: LineEvent) {
  const userId = event.source.userId;

  log.info('Processing unfollow event', {
    userId: userId?.substring(0, 10) + '...',
    timestamp: event.timestamp
  });

  if (!userId) {
    log.warn('LINE Unfollow: No userId in unfollow event');
    return;
  }

  try {
    const drizzleDb = createDbClient(env.DB);
    const timestamp = nowISO();

    // Find existing customer
    const existingCustomer = await drizzleDb
      .select()
      .from(customers)
      .where(and(
        eq(customers.platformUserId, userId),
        eq(customers.platform, 'line')
      ))
      .get();

    if (!existingCustomer) {
      log.info('Customer not found for unfollowed user', { userId: userId.substring(0, 10) + '...' });
      return;
    }

    // Update customer's last updated time
    await drizzleDb
      .update(customers)
      .set({
        updatedAt: timestamp
      })
      .where(eq(customers.id, existingCustomer.id));

    log.info('Customer unfollow recorded', {
      customerId: existingCustomer.id,
      displayName: existingCustomer.displayName
    });

    // Log activity
    try {
      const activityService = new ActivityService(env.DB);
      await activityService.logActivity({
        userId: 'system',
        userName: 'Webhook Handler',
        userRole: 'system',
        action: 'customer_unfollowed',
        resourceType: 'customer',
        resourceId: String(existingCustomer.id),
        details: {
          platform: 'line',
          platformUserId: userId,
          displayName: existingCustomer.displayName,
          timestamp
        }
      });
      log.debug('Activity logged');
    } catch (activityError) {
      log.warn('LINE Unfollow: Failed to log activity', {
        error: activityError instanceof Error ? activityError.message : String(activityError)
      });
    }

  } catch (error) {
    log.error('LINE Unfollow: Error processing unfollow event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userIdPrefix: userId.slice(0, 8)
    });
    throw error;
  }
}
