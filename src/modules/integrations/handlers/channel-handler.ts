// Channel Integration Handler
// REST API endpoints for channel management

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Bindings } from '@/types';
import { ChannelService } from '@modules/integrations/services/channel-service';
import type {
  ChannelConfigRequest,
  ChannelUpdateRequest,
  ChannelVerificationRequest
} from '../types/channel-types';
import { HTTP_STATUS } from '@/constants/http-status';

const channelHandler = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/channels/:id/stats
 * Get channel statistics
 *
 * Route Order: Registered before /:id to prevent route interception
 */
channelHandler.get('/:id/stats', async (c: Context) => {
  try {
    const user = c.get('user');
    const channelId = parseInt(c.req.param('id'));

    if (isNaN(channelId)) {
      return c.json({ error: 'Invalid channel ID' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!user || !user.teamId) {
      return c.json({ error: 'Team ID not found in user context' }, HTTP_STATUS.BAD_REQUEST);
    }

    const channelService = new ChannelService(c.env as Bindings);
    const channel = await channelService.getChannel(channelId);

    if (!channel) {
      return c.json({ error: 'Channel not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // Verify user has access to this channel
    if (channel.teamId !== user.teamId) {
      return c.json({ error: 'Access denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const stats = await channelService.getChannelStatistics(channelId);

    return c.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[ChannelHandler] Error getting channel stats:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get statistics'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * GET /api/channels/:id/health
 * Check channel health status
 *
 * Route Order: Registered before /:id to prevent route interception
 */
channelHandler.get('/:id/health', async (c: Context) => {
  try {
    const user = c.get('user');
    const channelId = parseInt(c.req.param('id'));

    if (isNaN(channelId)) {
      return c.json({ error: 'Invalid channel ID' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!user || !user.teamId) {
      return c.json({ error: 'Team ID not found in user context' }, HTTP_STATUS.BAD_REQUEST);
    }

    const channelService = new ChannelService(c.env as Bindings);
    const channel = await channelService.getChannel(channelId);

    if (!channel) {
      return c.json({ error: 'Channel not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // Verify user has access to this channel
    if (channel.teamId !== user.teamId) {
      return c.json({ error: 'Access denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const health = await channelService.checkChannelHealth(channelId);

    return c.json({
      success: true,
      data: health
    });

  } catch (error) {
    console.error('[ChannelHandler] Error checking channel health:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check health'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * POST /api/channels/:id/verify
 * Verify channel configuration by testing API connectivity
 *
 * Route Order: Registered before /:id to prevent route interception
 */
channelHandler.post('/:id/verify', async (c: Context) => {
  try {
    const user = c.get('user');
    const channelId = parseInt(c.req.param('id'));

    if (isNaN(channelId)) {
      return c.json({ error: 'Invalid channel ID' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!user || !user.teamId) {
      return c.json({ error: 'Team ID not found in user context' }, HTTP_STATUS.BAD_REQUEST);
    }

    const channelService = new ChannelService(c.env as Bindings);
    const channel = await channelService.getChannel(channelId);

    if (!channel) {
      return c.json({ error: 'Channel not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // Verify user has access to this channel
    if (channel.teamId !== user.teamId) {
      return c.json({ error: 'Access denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const body = await c.req.json().catch(() => ({})) as Partial<ChannelVerificationRequest>;

    const request: ChannelVerificationRequest = {
      channelId,
      testMessage: body.testMessage
    };

    const result = await channelService.verifyChannel(request);

    const statusCode = result.success ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST;
    return c.json(result, statusCode);

  } catch (error) {
    console.error('[ChannelHandler] Error verifying channel:', error);
    return c.json({
      success: false,
      verified: false,
      message: error instanceof Error ? error.message : 'Verification failed'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * GET /api/channels/:id
 * Get channel details by ID
 *
 * Route Order: Registered after specific /:id/* routes to prevent interception
 */
channelHandler.get('/:id', async (c: Context) => {
  try {
    const user = c.get('user');
    const channelId = parseInt(c.req.param('id'));

    if (isNaN(channelId)) {
      return c.json({ error: 'Invalid channel ID' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!user) {
      return c.json({ error: 'Authentication required' }, HTTP_STATUS.UNAUTHORIZED);
    }

    const channelService = new ChannelService(c.env as Bindings);
    const channel = await channelService.getChannel(channelId);

    if (!channel) {
      return c.json({ error: 'Channel not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // Verify user has access to this channel (same team)
    // Admin users without teamId can access any channel
    if (user.teamId && channel.teamId !== user.teamId && user.role !== 'admin') {
      return c.json({ error: 'Access denied' }, HTTP_STATUS.FORBIDDEN);
    }

    return c.json({
      success: true,
      data: channel
    });

  } catch (error) {
    console.error('[ChannelHandler] Error getting channel:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get channel'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * PUT /api/channels/:id
 * Update channel configuration
 */
channelHandler.put('/:id', async (c: Context) => {
  try {
    const user = c.get('user');
    const channelId = parseInt(c.req.param('id'));

    if (isNaN(channelId)) {
      return c.json({ error: 'Invalid channel ID' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!user || !user.teamId) {
      return c.json({ error: 'Team ID not found in user context' }, HTTP_STATUS.BAD_REQUEST);
    }

    // Only admin can update channels
    if (user.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Only administrators can update channels'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const channelService = new ChannelService(c.env as Bindings);
    const channel = await channelService.getChannel(channelId);

    if (!channel) {
      return c.json({ error: 'Channel not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // Verify user has access to this channel
    if (channel.teamId !== user.teamId) {
      return c.json({ error: 'Access denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const body = await c.req.json() as Partial<ChannelUpdateRequest>;

    const request: ChannelUpdateRequest = {
      channelId,
      lineConfig: body.lineConfig,
      facebookConfig: body.facebookConfig,
      whatsappConfig: body.whatsappConfig,
      isActive: body.isActive,
      configMetadata: body.configMetadata
    };

    const result = await channelService.updateChannel(request);

    if (!result.success) {
      return c.json(result, 400);
    }

    return c.json(result);

  } catch (error) {
    console.error('[ChannelHandler] Error updating channel:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update channel'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * DELETE /api/channels/:id
 * Deactivate channel (soft delete)
 */
channelHandler.delete('/:id', async (c: Context) => {
  try {
    const user = c.get('user');
    const channelId = parseInt(c.req.param('id'));

    if (isNaN(channelId)) {
      return c.json({ error: 'Invalid channel ID' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!user || !user.teamId) {
      return c.json({ error: 'Team ID not found in user context' }, HTTP_STATUS.BAD_REQUEST);
    }

    // Only admin can deactivate channels
    if (user.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Only administrators can deactivate channels'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const channelService = new ChannelService(c.env as Bindings);
    const channel = await channelService.getChannel(channelId);

    if (!channel) {
      return c.json({ error: 'Channel not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // Verify user has access to this channel
    if (channel.teamId !== user.teamId) {
      return c.json({ error: 'Access denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const success = await channelService.deactivateChannel(channelId);

    if (!success) {
      return c.json({
        success: false,
        error: 'Failed to deactivate channel'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    return c.json({
      success: true,
      message: 'Channel deactivated successfully'
    });

  } catch (error) {
    console.error('[ChannelHandler] Error deactivating channel:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deactivate channel'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * GET /api/channels
 * List all channels for the authenticated user's team
 */
channelHandler.get('/', async (c: Context) => {
  try {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Authentication required' }, HTTP_STATUS.UNAUTHORIZED);
    }

    // Admin users without teamId can access all channels or filter by teamId query param
    let teamId: number | undefined = user.teamId ?? undefined;

    if (!teamId && user.role === 'admin') {
      const teamIdParam = c.req.query('teamId');
      if (teamIdParam) {
        teamId = parseInt(teamIdParam);
        if (isNaN(teamId)) {
          return c.json({ error: 'Invalid teamId parameter' }, HTTP_STATUS.BAD_REQUEST);
        }
      }
      // If no teamId param provided, admin can see all channels (teamId will be undefined)
    } else if (!teamId) {
      // Non-admin users must have a teamId
      return c.json({ error: 'Team ID not found in user context' }, HTTP_STATUS.BAD_REQUEST);
    }

    const platform = c.req.query('platform') as 'line' | 'facebook' | 'whatsapp' | undefined;

    const channelService = new ChannelService(c.env as Bindings);
    const channels = await channelService.getChannelsByTeam(teamId, platform);

    return c.json({
      success: true,
      data: channels,
      count: channels.length
    });

  } catch (error) {
    console.error('[ChannelHandler] Error listing channels:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list channels'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * POST /api/channels
 * Create a new channel integration
 */
channelHandler.post('/', async (c: Context) => {
  try {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Authentication required' }, HTTP_STATUS.UNAUTHORIZED);
    }

    // Only admin can create channels
    if (user.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Only administrators can configure channels'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const body = await c.req.json() as Partial<ChannelConfigRequest>;

    // Admin users can create channels for any team
    // Use user.teamId or require teamId in request body
    let teamId: number | undefined = user.teamId ?? undefined;

    if (!teamId) {
      // Admin without teamId must provide teamId in request
      if (body.teamId) {
        teamId = body.teamId;
      } else {
        return c.json({
          error: 'Team ID required - provide teamId in request body or user must have teamId'
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // Validate required fields
    if (!body.platform) {
      return c.json({ error: 'Platform is required' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!['line', 'facebook', 'whatsapp'].includes(body.platform)) {
      return c.json({ error: 'Invalid platform' }, HTTP_STATUS.BAD_REQUEST);
    }

    // Platform-specific validation
    if (body.platform === 'line') {
      if (!body.lineConfig) {
        return c.json({ error: 'LINE configuration is required' }, HTTP_STATUS.BAD_REQUEST);
      }
      if (!body.lineConfig.channelId || !body.lineConfig.channelAccessToken || !body.lineConfig.channelSecret) {
        return c.json({ error: 'LINE Channel ID, Access Token, and Secret are required' }, HTTP_STATUS.BAD_REQUEST);
      }
    } else if (body.platform === 'facebook') {
      if (!body.facebookConfig) {
        return c.json({ error: 'Facebook configuration is required' }, HTTP_STATUS.BAD_REQUEST);
      }
      if (!body.facebookConfig.pageId || !body.facebookConfig.accessToken || !body.facebookConfig.appSecret) {
        return c.json({ error: 'Facebook Page ID, Access Token, and App Secret are required' }, HTTP_STATUS.BAD_REQUEST);
      }
    } else if (body.platform === 'whatsapp') {
      if (!body.whatsappConfig) {
        return c.json({ error: 'WhatsApp configuration is required' }, HTTP_STATUS.BAD_REQUEST);
      }
      if (!body.whatsappConfig.phoneNumber || !body.whatsappConfig.businessAccountId || !body.whatsappConfig.accessToken) {
        return c.json({ error: 'WhatsApp Phone Number, Business Account ID, and Access Token are required' }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    const request: ChannelConfigRequest = {
      platform: body.platform,
      teamId: teamId!, // Use calculated teamId (guaranteed non-null at this point)
      lineConfig: body.lineConfig,
      facebookConfig: body.facebookConfig,
      whatsappConfig: body.whatsappConfig,
      configMetadata: body.configMetadata
    };

    const channelService = new ChannelService(c.env as Bindings);
    const result = await channelService.createChannel(request);

    if (!result.success) {
      return c.json(result, 400);
    }

    // Record activity
    // TODO: Add activity logging

    return c.json(result, HTTP_STATUS.CREATED);

  } catch (error) {
    console.error('[ChannelHandler] Error creating channel:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create channel'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default channelHandler;