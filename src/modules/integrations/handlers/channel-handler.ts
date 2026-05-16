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
import { globalErrorHandler } from '@/core/error-handler';
import { requireIntId, getValidatedParam } from '@/middleware/param-validator';
import type { ChannelIntegration } from '../types/channel-types';
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities';

/**
 * Sanitize channel data for API responses — strip encrypted credentials JSON
 */
function sanitizeChannelForResponse(channel: ChannelIntegration): Omit<ChannelIntegration, 'credentials'> & Record<string, unknown> {
  const {
    credentials: _credentials,
    ...safe
  } = channel;
  return safe;
}

const channelHandler = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/channels/:id/stats
 * Get channel statistics
 *
 * Route Order: Registered before /:id to prevent route interception
 */
channelHandler.get('/:id/stats', requireIntId(), async (c: Context) => {
  try {
    const user = c.get('user');
    const channelId = getValidatedParam<number>(c, 'id');
    if (!user || !user.primaryTeamId) {
      return c.json({ error: 'Team ID not found in user context' }, HTTP_STATUS.BAD_REQUEST);
    }

    const channelService = new ChannelService(c.env as Bindings);
    const channel = await channelService.getChannel(channelId);

    if (!channel) {
      return c.json({ error: 'Channel not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // Verify user has access to this channel
    if (channel.teamId !== user.primaryTeamId) {
      return c.json({ error: 'Access denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const stats = await channelService.getChannelStatistics(channelId);

    return c.json({
      success: true,
      data: stats
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/channels/:id/health
 * Check channel health status
 *
 * Route Order: Registered before /:id to prevent route interception
 */
channelHandler.get('/:id/health', requireIntId(), async (c: Context) => {
  try {
    const user = c.get('user');
    const channelId = getValidatedParam<number>(c, 'id');
    if (!user || !user.primaryTeamId) {
      return c.json({ error: 'Team ID not found in user context' }, HTTP_STATUS.BAD_REQUEST);
    }

    const channelService = new ChannelService(c.env as Bindings);
    const channel = await channelService.getChannel(channelId);

    if (!channel) {
      return c.json({ error: 'Channel not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // Verify user has access to this channel
    if (channel.teamId !== user.primaryTeamId) {
      return c.json({ error: 'Access denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const health = await channelService.checkChannelHealth(channelId);

    return c.json({
      success: true,
      data: health
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * POST /api/channels/:id/verify
 * Verify channel configuration by testing API connectivity
 *
 * Route Order: Registered before /:id to prevent route interception
 */
channelHandler.post('/:id/verify', requireIntId(), async (c: Context) => {
  try {
    const user = c.get('user');
    const channelId = getValidatedParam<number>(c, 'id');
    if (!user || !user.primaryTeamId) {
      return c.json({ error: 'Team ID not found in user context' }, HTTP_STATUS.BAD_REQUEST);
    }

    const channelService = new ChannelService(c.env as Bindings);
    const channel = await channelService.getChannel(channelId);

    if (!channel) {
      return c.json({ error: 'Channel not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // Verify user has access to this channel
    if (channel.teamId !== user.primaryTeamId) {
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
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/channels/:id
 * Get channel details by ID
 *
 * Route Order: Registered after specific /:id/* routes to prevent interception
 */
channelHandler.get('/:id', requireIntId(), async (c: Context) => {
  try {
    const user = c.get('user');
    const channelId = getValidatedParam<number>(c, 'id');
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
    if (user.primaryTeamId && channel.teamId !== user.primaryTeamId && user.role !== 'admin') {
      return c.json({ error: 'Access denied' }, HTTP_STATUS.FORBIDDEN);
    }

    return c.json({
      success: true,
      data: sanitizeChannelForResponse(channel)
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * PUT /api/channels/:id
 * Update channel configuration
 */
channelHandler.put('/:id', requireIntId(), async (c: Context) => {
  try {
    const user = c.get('user');
    const channelId = getValidatedParam<number>(c, 'id');
    if (!user || !user.primaryTeamId) {
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
    if (channel.teamId !== user.primaryTeamId) {
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

    return c.json({
      ...result,
      data: result.data ? sanitizeChannelForResponse(result.data) : undefined
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * DELETE /api/channels/:id
 * Deactivate channel (soft delete)
 */
channelHandler.delete('/:id', requireIntId(), async (c: Context) => {
  try {
    const user = c.get('user');
    const channelId = getValidatedParam<number>(c, 'id');
    if (!user || !user.primaryTeamId) {
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
    if (channel.teamId !== user.primaryTeamId) {
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
    return globalErrorHandler.handleError(c, error);
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
    let teamId: number | undefined = user.primaryTeamId ?? undefined;

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
      data: channels.map(sanitizeChannelForResponse),
      count: channels.length
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
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
    // Use user.primaryTeamId or require teamId in request body
    let teamId: number | undefined = user.primaryTeamId ?? undefined;

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

    if (!result.data) {
      return c.json({ success: false, error: 'Channel creation returned no data' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: String(user.id),
      userName: user.displayName || String(user.id),
      userRole: user.role,
      action: ACTIVITY_ACTIONS.INTEGRATION_CREATE,
      resourceType: RESOURCE_TYPES.INTEGRATION,
      resourceId: String(result.data.id),
      details: {
        platform: body.platform,
        teamId,
        channelId: result.data.id
      },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    });

    return c.json({
      ...result,
      data: result.data ? sanitizeChannelForResponse(result.data) : undefined
    }, HTTP_STATUS.CREATED);

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default channelHandler;
