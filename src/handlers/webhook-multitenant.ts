// Multi-tenant Webhook Handler
// Supports per-team channel configurations

import type { Context } from 'hono';
import type { Bindings } from '../types';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  handleApiError
} from '../utils/api-response';
import { ChannelService } from '@modules/integrations/services/channel-service';
import type { ChannelIntegration } from '@modules/integrations/types/channel-types';

// Import existing webhook types and validation
import type { LineWebhookBody } from '../types';
import { validateLineWebhook, verifyLineSignature } from './webhook';

// Import existing message processing (will be modified)
import { processLineMessage } from './webhook';

/**
 * Multi-tenant LINE Webhook Handler
 * Route: POST /api/webhooks/line/:teamId/:token
 *
 * Features:
 * - Team-specific webhook routing
 * - Token verification for security
 * - Per-team LINE credentials
 * - Message counter tracking
 */
export async function handleLineWebhookMultiTenant(c: Context<{ Bindings: Bindings }>) {
  console.log('🔔 [LINE Webhook Multi-Tenant] Request received at:', new Date().toISOString());

  try {
    // Extract route parameters
    const teamIdParam = c.req.param('teamId');
    const token = c.req.param('token');

    if (!teamIdParam || !token) {
      console.error('❌ [LINE Webhook] Missing teamId or token in URL');
      return errorResponse(c, 'Invalid webhook URL', 400);
    }

    const teamId = parseInt(teamIdParam);
    if (isNaN(teamId)) {
      console.error('❌ [LINE Webhook] Invalid teamId:', teamIdParam);
      return errorResponse(c, 'Invalid team ID', 400);
    }

    console.log(`🔍 [LINE Webhook] Looking up channel for team ${teamId}`);

    // Get channel configuration from database
    const channelService = new ChannelService(c.env);
    const channel = await channelService.getChannelByWebhookToken('line', teamId, token);

    if (!channel) {
      console.error(`❌ [LINE Webhook] No channel found for team ${teamId} with provided token`);
      return unauthorizedResponse(c, 'Invalid webhook configuration');
    }

    if (!channel.isActive) {
      console.error(`❌ [LINE Webhook] Channel ${channel.id} is not active`);
      return errorResponse(c, 'Channel is not active', 403);
    }

    if (!channel.lineChannelSecret) {
      console.error(`❌ [LINE Webhook] Channel ${channel.id} missing LINE Channel Secret`);
      return errorResponse(c, 'Channel configuration incomplete', 500);
    }

    console.log(`✅ [LINE Webhook] Found active channel ${channel.id} for team ${teamId}`);

    // Verify LINE signature using team's channel secret
    const signature = c.req.header('X-Line-Signature');
    const body = await c.req.text();

    console.log('🔍 [LINE Webhook] Headers:', {
      'X-Line-Signature': signature ? 'Present' : 'Missing',
      'Content-Type': c.req.header('Content-Type'),
      'Content-Length': body.length
    });

    // Check payload size (1MB limit)
    if (body.length > 1024 * 1024) {
      console.error('❌ [LINE Webhook] Payload too large:', body.length);
      return errorResponse(c, 'Payload too large', 413);
    }

    if (!signature) {
      console.error('❌ [LINE Webhook] Missing X-Line-Signature header');
      return errorResponse(c, 'Missing signature');
    }

    // Verify signature with team's channel secret
    const isValid = await verifyLineSignature(body, signature, channel.lineChannelSecret);

    if (!isValid) {
      console.error('❌ [LINE Webhook] Invalid signature for team', teamId);
      console.log('   Received signature:', signature.substring(0, 20) + '...');

      // Track error
      await channelService.incrementMessageCounter(channel.id, 'received'); // Still count as attempt

      return unauthorizedResponse(c, 'Invalid signature');
    }

    console.log('✅ [LINE Webhook] Signature verified successfully for team', teamId);

    // Parse webhook payload
    let data: LineWebhookBody;
    try {
      data = JSON.parse(body) as LineWebhookBody;
    } catch (parseError) {
      console.error('❌ [LINE Webhook] JSON parse error:', parseError);
      return errorResponse(c, 'Invalid JSON payload');
    }

    // Validate webhook structure
    if (!validateLineWebhook(data)) {
      console.error('❌ [LINE Webhook] Invalid webhook payload structure');
      return errorResponse(c, 'Invalid webhook payload');
    }

    console.log('📦 [LINE Webhook] Processing events:', {
      teamId,
      channelId: channel.id,
      destination: data.destination,
      eventCount: data.events.length,
      firstEventType: data.events[0]?.type
    });

    // Process events with team-specific configuration
    let processedCount = 0;
    for (const event of data.events) {
      console.log('🎯 [LINE Webhook] Processing event:', {
        type: event.type,
        userId: event.source?.userId?.substring(0, 10) + '...',
        messageType: event.message?.type
      });

      if (event.type === 'message' && event.message) {
        // Pass team-specific env and channel info
        await processLineMessageMultiTenant(c.env, event, channel);
        processedCount++;

        // Increment message counter for this channel
        await channelService.incrementMessageCounter(channel.id, 'received');
      } else {
        console.log('🔄 [LINE Webhook] Skipping non-message event:', event.type);
      }
    }

    console.log(`✅ [LINE Webhook] Processed ${processedCount}/${data.events.length} events for team ${teamId}`);

    return successResponse(c, {
      teamId,
      channelId: channel.id,
      processedEvents: processedCount
    }, 'Webhook processed successfully');

  } catch (error) {
    console.error('❌ [LINE Webhook Multi-Tenant] Error:', error);
    return handleApiError(error, c);
  }
}

/**
 * Process LINE message with team-specific configuration
 * This is a wrapper around the existing processLineMessage that injects team context
 */
async function processLineMessageMultiTenant(
  env: Bindings,
  event: any,
  channel: ChannelIntegration
): Promise<void> {
  // Create a modified env object with team-specific credentials
  const teamEnv = {
    ...env,
    LINE_CHANNEL_ACCESS_TOKEN: channel.lineChannelAccessToken || env.LINE_CHANNEL_ACCESS_TOKEN,
    LINE_CHANNEL_SECRET: channel.lineChannelSecret || env.LINE_CHANNEL_SECRET,
    // Add team context for downstream processing
    _TEAM_ID: channel.teamId,
    _CHANNEL_ID: channel.id
  };

  // Call existing message processing with team-specific env
  await processLineMessage(teamEnv as Bindings, event);
}

/**
 * Legacy single-tenant LINE webhook handler
 * Kept for backward compatibility
 * Route: POST /api/webhooks/line
 */
export async function handleLineWebhookLegacy(c: Context<{ Bindings: Bindings }>) {
  console.log('⚠️ [LINE Webhook Legacy] Using single-tenant mode (deprecated)');
  console.log('🔔 [LINE Webhook] Request received at:', new Date().toISOString());

  try {
    // Verify signature
    const signature = c.req.header('X-Line-Signature');
    const body = await c.req.text();

    console.log('🔍 [LINE Webhook] Headers:', {
      'X-Line-Signature': signature ? 'Present' : 'Missing',
      'Content-Type': c.req.header('Content-Type'),
      'Content-Length': body.length
    });

    // Check payload size (1MB limit)
    if (body.length > 1024 * 1024) {
      console.error('❌ [LINE Webhook] Payload too large:', body.length);
      return errorResponse(c, 'Payload too large', 413);
    }

    if (!signature) {
      console.error('❌ [LINE Webhook] Missing X-Line-Signature header');
      return errorResponse(c, 'Missing signature');
    }

    // Verify signature using global env variable
    const isValid = await verifyLineSignature(body, signature, c.env.LINE_CHANNEL_SECRET);

    if (!isValid) {
      console.error('❌ [LINE Webhook] Invalid signature');
      console.log('   Received signature:', signature.substring(0, 20) + '...');
      return unauthorizedResponse(c, 'Invalid signature');
    }

    console.log('✅ [LINE Webhook] Signature verified successfully');

    // Parse and validate
    let data: LineWebhookBody;
    try {
      data = JSON.parse(body) as LineWebhookBody;
    } catch (parseError) {
      return errorResponse(c, 'Invalid JSON payload');
    }

    if (!validateLineWebhook(data)) {
      console.error('❌ [LINE Webhook] Invalid webhook payload structure');
      return errorResponse(c, 'Invalid webhook payload');
    }

    console.log('📦 [LINE Webhook] Processing events:', {
      destination: data.destination,
      eventCount: data.events.length,
      firstEventType: data.events[0]?.type
    });

    // Process events
    for (const event of data.events) {
      console.log('🎯 [LINE Webhook] Processing event:', {
        type: event.type,
        userId: event.source?.userId?.substring(0, 10) + '...',
        messageType: event.message?.type
      });

      if (event.type === 'message' && event.message) {
        await processLineMessage(c.env, event);
      } else {
        console.log('🔄 [LINE Webhook] Skipping non-message event:', event.type);
      }
    }

    console.log('✅ [LINE Webhook] All events processed successfully');
    return successResponse(c, null, 'LINE webhook processed successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
}
