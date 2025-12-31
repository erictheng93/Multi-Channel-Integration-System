// Invitations Handler
// 邀請系統路由處理器

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth, requireManagerOrAdmin } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { HTTP_STATUS } from '@/constants/http-status';
import type {
  InviteMemberRequest,
  Invitation
} from '../types/invitation-types';

const invitationsHandler = new Hono<{ Bindings: Bindings }>();

// In-memory invitations store (TODO: Move to database)
const invitations = new Map<string, Invitation>();

/**
 * 發送成員邀請
 * POST /api/teams/invitations
 */
invitationsHandler.post('/', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const data: InviteMemberRequest = await c.req.json();

    if (!data.email) {
      return c.json({
        success: false,
        error: 'email is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const invitationId = uuidv4();
    const token = uuidv4();
    const expiryHours = data.expiryHours || 72;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

    const invitation: Invitation = {
      id: invitationId,
      email: data.email,
      role: data.role || 'agent',
      teamId: data.teamId,
      invitedBy: String(user.id),
      token,
      status: 'pending',
      expiresAt,
      createdAt: new Date().toISOString()
    };

    invitations.set(invitationId, invitation);

    // TODO: Send invitation email

    return c.json({
      success: true,
      data: {
        ...invitation,
        inviteLink: `${c.req.url.split('/api')[0]}/invite/${token}`
      },
      message: 'Invitation sent successfully',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.CREATED);

  } catch (error) {
    console.error('Send invitation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invitation'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 獲取邀請列表
 * GET /api/teams/invitations
 */
invitationsHandler.get('/', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const status = c.req.query('status') as 'pending' | 'accepted' | 'expired' | 'revoked' | undefined;

    let filteredInvitations = Array.from(invitations.values());

    if (status) {
      filteredInvitations = filteredInvitations.filter(inv => inv.status === status);
    }

    // Check for expired invitations
    const now = new Date();
    filteredInvitations.forEach(inv => {
      if (inv.status === 'pending' && new Date(inv.expiresAt) < now) {
        inv.status = 'expired';
      }
    });

    return c.json({
      success: true,
      data: filteredInvitations,
      total: filteredInvitations.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get invitations error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get invitations'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 撤銷邀請
 * DELETE /api/teams/invitations/:invitationId
 */
invitationsHandler.delete('/:invitationId', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const invitationId = c.req.param('invitationId');

    const invitation = invitations.get(invitationId);
    if (!invitation) {
      return c.json({
        success: false,
        error: 'Invitation not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    if (invitation.status !== 'pending') {
      return c.json({
        success: false,
        error: `Cannot revoke ${invitation.status} invitation`
      }, HTTP_STATUS.BAD_REQUEST);
    }

    invitation.status = 'revoked';
    invitations.set(invitationId, invitation);

    return c.json({
      success: true,
      message: 'Invitation revoked successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Revoke invitation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke invitation'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default invitationsHandler;
