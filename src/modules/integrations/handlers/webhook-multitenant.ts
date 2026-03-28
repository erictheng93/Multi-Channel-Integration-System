// Multi-tenant Webhook Handler
// Supports per-team channel configurations

import type { Context } from 'hono';
import type { Bindings } from '@/types';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  handleApiError
} from '@/utils/api-response';
import { ChannelService } from '@modules/integrations/services/channel-service';
import type { ChannelIntegration } from '@modules/integrations/types/channel-types';

// Import existing webhook types and validation
import type { LineWebhookBody } from '@/types';
import { isLineWebhookBody } from '@/services/webhook-validation';
import { verifyWebhookSignature } from '@/services/webhook-signature-service';

// Import existing message processing (will be modified)
import { processLineMessage, processLineFollowEvent } from './webhook';
import type { DeferFn } from './webhook';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('WebhookMultitenant');

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
  log.info('Request received at:', { timestamp: nowISO() });

  try {
    // Extract route parameters
    const teamIdParam = c.req.param('teamId');
    const token = c.req.param('token');

    if (!teamIdParam || !token) {
      log.error('Missing teamId or token in URL');
      return errorResponse(c, 'Invalid webhook URL', 400);
    }

    const teamId = parseInt(teamIdParam);
    if (isNaN(teamId)) {
      log.error('Invalid teamId', { teamIdParam });
      return errorResponse(c, 'Invalid team ID', 400);
    }

    log.info(`Looking up channel for team ${teamId}`);

    // Get channel configuration from database
    const channelService = new ChannelService(c.env);
    const channel = await channelService.getChannelByWebhookToken('line', teamId, token);

    if (!channel) {
      log.error(`No channel found for team ${teamId} with provided token`);
      return unauthorizedResponse(c, 'Invalid webhook configuration');
    }

    if (!channel.isActive) {
      log.error(`Channel ${channel.id} is not active`);
      return errorResponse(c, 'Channel is not active', 403);
    }

    log.info(`Found active channel ${channel.id} for team ${teamId}`);

    // Decrypt credentials (JSON-first with legacy fallback)
    const creds = await channelService.getDecryptedCredentials(channel);

    if (!creds.secret) {
      log.error(`Channel ${channel.id} missing LINE Channel Secret`);
      return errorResponse(c, 'Channel configuration incomplete', 500);
    }

    // Verify LINE signature using team's decrypted channel secret
    const signature = c.req.header('X-Line-Signature');
    const body = await c.req.text();

    log.debug('Headers', {
      'X-Line-Signature': signature ? 'Present' : 'Missing',
      'Content-Type': c.req.header('Content-Type'),
      'Content-Length': body.length
    });

    // Check payload size (1MB limit)
    if (body.length > 1024 * 1024) {
      log.error('Payload too large', { bodyLength: body.length });
      return errorResponse(c, 'Payload too large', 413);
    }

    if (!signature) {
      log.error('Missing X-Line-Signature header');
      return errorResponse(c, 'Missing signature');
    }

    // Verify signature with team's decrypted channel secret
    const signatureResult = await verifyWebhookSignature(
      'line',
      body,
      { 'x-line-signature': signature },
      creds.secret
    );

    if (!signatureResult.valid) {
      log.error('Invalid signature for team', { teamId, signaturePrefix: signature.substring(0, 20) + '...' });

      // Track error
      await channelService.incrementMessageCounter(channel.id, 'received'); // Still count as attempt

      return unauthorizedResponse(c, 'Invalid signature');
    }

    log.info('Signature verified successfully for team', { teamId });

    // Parse webhook payload
    let data: LineWebhookBody;
    try {
      data = JSON.parse(body) as LineWebhookBody;
    } catch (parseError) {
      log.error('JSON parse error', {}, parseError instanceof Error ? parseError : new Error(String(parseError)));
      return errorResponse(c, 'Invalid JSON payload');
    }

    // Validate webhook structure
    if (!isLineWebhookBody(data)) {
      log.error('Invalid webhook payload structure');
      return errorResponse(c, 'Invalid webhook payload');
    }

    log.info('Processing events', {
      teamId,
      channelId: channel.id,
      destination: data.destination,
      eventCount: data.events.length,
      firstEventType: data.events[0]?.type
    });

    // Process events with team-specific configuration
    const mtDefer: DeferFn = (p) => c.executionCtx.waitUntil(p);
    let processedCount = 0;
    for (const event of data.events) {
      log.debug('Processing event', {
        type: event.type,
        userId: event.source?.userId?.substring(0, 10) + '...',
        messageType: event.message?.type
      });

      if (event.type === 'message' && event.message) {
        // Pass team-specific env and channel info with decrypted credentials
        await processLineMessageMultiTenant(c.env, event, channel, creds, mtDefer);
        processedCount++;

        // Increment message counter for this channel
        await channelService.incrementMessageCounter(channel.id, 'received');
      } else if (event.type === 'follow') {
        log.info('Processing follow event for team', { teamId });
        await processLineFollowEvent(c.env, event);
        processedCount++;
      } else {
        log.debug('Skipping non-message event', { eventType: event.type });
      }
    }

    log.info(`Processed ${processedCount}/${data.events.length} events for team ${teamId}`);

    return successResponse(c, {
      teamId,
      channelId: channel.id,
      processedEvents: processedCount
    }, 'Webhook processed successfully');

  } catch (error) {
    log.error('Error', {}, error instanceof Error ? error : new Error(String(error)));
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
  channel: ChannelIntegration,
  decryptedCreds: { accessToken?: string; secret?: string },
  defer: DeferFn = () => {}
): Promise<void> {
  // Create a modified env object with team-specific decrypted credentials
  const teamEnv = {
    ...env,
    LINE_CHANNEL_ACCESS_TOKEN: decryptedCreds.accessToken || env.LINE_CHANNEL_ACCESS_TOKEN,
    LINE_CHANNEL_SECRET: decryptedCreds.secret || env.LINE_CHANNEL_SECRET,
    // Add team context for downstream processing
    _TEAM_ID: channel.teamId,
    _CHANNEL_ID: channel.id
  };

  // Call existing message processing with team-specific env + defer for waitUntil
  await processLineMessage(teamEnv as Bindings, event, defer);
}

/**
 * Legacy single-tenant LINE webhook handler
 * Kept for backward compatibility
 * Route: POST /api/webhooks/line
 */
export async function handleLineWebhookLegacy(c: Context<{ Bindings: Bindings }>) {
  log.warn('Using single-tenant mode (deprecated)');
  log.info('Request received at', { timestamp: nowISO() });

  try {
    // Verify signature
    const signature = c.req.header('X-Line-Signature');
    const body = await c.req.text();

    log.debug('Headers', {
      'X-Line-Signature': signature ? 'Present' : 'Missing',
      'Content-Type': c.req.header('Content-Type'),
      'Content-Length': body.length
    });

    // Check payload size (1MB limit)
    if (body.length > 1024 * 1024) {
      log.error('Payload too large', { bodyLength: body.length });
      return errorResponse(c, 'Payload too large', 413);
    }

    if (!signature) {
      log.error('Missing X-Line-Signature header');
      return errorResponse(c, 'Missing signature');
    }

    // Verify signature using global env variable
    const signatureResult = await verifyWebhookSignature(
      'line',
      body,
      { 'x-line-signature': signature },
      c.env.LINE_CHANNEL_SECRET
    );

    if (!signatureResult.valid) {
      log.error('Invalid signature', { signaturePrefix: signature.substring(0, 20) + '...' });
      return unauthorizedResponse(c, 'Invalid signature');
    }

    log.info('Signature verified successfully');

    // Parse and validate
    let data: LineWebhookBody;
    try {
      data = JSON.parse(body) as LineWebhookBody;
    } catch (parseError) {
      return errorResponse(c, 'Invalid JSON payload');
    }

    if (!isLineWebhookBody(data)) {
      log.error('Invalid webhook payload structure');
      return errorResponse(c, 'Invalid webhook payload');
    }

    log.info('Processing events', {
      destination: data.destination,
      eventCount: data.events.length,
      firstEventType: data.events[0]?.type
    });

    // Create defer function to run tasks after HTTP response via waitUntil
    const defer: DeferFn = (p) => c.executionCtx.waitUntil(p);

    // Process events
    for (const event of data.events) {
      log.debug('Processing event', {
        type: event.type,
        userId: event.source?.userId?.substring(0, 10) + '...',
        messageType: event.message?.type
      });

      if (event.type === 'message' && event.message) {
        await processLineMessage(c.env, event, defer);
      } else if (event.type === 'follow') {
        log.info('Processing follow event');
        await processLineFollowEvent(c.env, event);
      } else {
        log.debug('Skipping non-message event', { eventType: event.type });
      }
    }

    log.info('All events processed successfully');
    return successResponse(c, null, 'LINE webhook processed successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
}
