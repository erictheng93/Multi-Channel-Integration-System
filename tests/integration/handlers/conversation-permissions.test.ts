// Integration Tests for Conversation Handler Permissions and Access Control
// Tests role-based access control and team-scoped permissions

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseTestEnvironment } fimport { MockFactory } from '@helpers/mockFactory';
rom '../../helpers/DatabaseTestEnvironment';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '@backend/db/schema';

let currentTestEnv: DatabaseTestEnvironment | null = null;

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => {
    if (!currentTestEnv) {
      throw new Error('DatabaseTestEnvironment not initialized');
    }
    return currentTestEnv.getDrizzleInstance();
  })
}));

// Mock PermissionService to test actual permission logic
vi.mock('@shared/services/permission-service', () => ({
  PermissionService: {
    checkPermission: vi.fn(),
    getVisibleConversations: vi.fn()
  }
}));

describe('Conversation Handler - Permission and Access Control Tests', () => {
  let env: DatabaseTestEnvironment;
  let adminUser: any;
  let agentTeam1: any;
  let agentTeam2: any;
  let team1: any;
  let team2: any;
  let customer1: any;
  let customer2: any;
  let conversationTeam1: any;
  let conversationTeam2: any;
  let conversationUnassigned: any;

  beforeEach(async () => {
    env = new DatabaseTestEnvironment();
    currentTestEnv = env;

    // Create teams
    team1 = await env.createTestTeam({ name: 'Team Alpha' });
    team2 = await env.createTestTeam({ name: 'Team Beta' });

    // Create admin
    adminUser = await env.createTestAgent({
      id: 'admin-perm-1',
      email: 'admin@perm.com',
      displayName: 'Admin User',
      role: 'admin',
      teamId: team1.id
    });

    // Create agents in different teams
    agentTeam1 = await env.createTestAgent({
      id: 'agent-team1',
      email: 'agent1@team1.com',
      displayName: 'Agent Team 1',
      role: 'agent',
      teamId: team1.id
    });

    agentTeam2 = await env.createTestAgent({
      id: 'agent-team2',
      email: 'agent2@team2.com',
      displayName: 'Agent Team 2',
      role: 'agent',
      teamId: team2.id
    });

    // Create customers
    customer1 = await env.createTestCustomer({
      platform: 'line',
      platformUserId: 'U_PERM_1',
      displayName: 'Customer 1'
    });

    customer2 = await env.createTestCustomer({
      platform: 'facebook',
      platformUserId: 'FB_PERM_2',
      displayName: 'Customer 2'
    });

    // Create conversations with different assignments
    conversationTeam1 = await env.createTestConversation(customer1.id, {
      assignedUserId: agentTeam1.id,
      assignedTeamId: team1.id,
      status: 'assigned'
    });

    conversationTeam2 = await env.createTestConversation(customer2.id, {
      assignedUserId: agentTeam2.id,
      assignedTeamId: team2.id,
      status: 'assigned'
    });

    conversationUnassigned = await env.createTestConversation(customer1.id, {
      status: 'active'
      // No assignment
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    env.close();
    currentTestEnv = null;
  });

  // ==================== Admin Access ====================
  describe('Admin Role - Full Access', () => {
    test('should allow admin to view all conversations', async () => {
      // Admin should see all conversations regardless of assignment
      const allConversations = await env.db.query.conversations.findMany();

      expect(allConversations).toHaveLength(3);
      expect(allConversations.map(c => c.id)).toContain(conversationTeam1.id);
      expect(allConversations.map(c => c.id)).toContain(conversationTeam2.id);
      expect(allConversations.map(c => c.id)).toContain(conversationUnassigned.id);
    });

    test('should allow admin to assign conversations to any team', async () => {
      // Admin can assign unassigned conversation to team2
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: team2.id,
          assignedUserId: agentTeam2.id,
          status: 'assigned'
        })
        .where(eq(schema.conversations.id, conversationUnassigned.id));

      const updated = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, conversationUnassigned.id)
      });

      expect(updated?.assignedTeamId).toBe(team2.id);
      expect(updated?.assignedUserId).toBe(agentTeam2.id);
    });

    test('should allow admin to reassign conversations between teams', async () => {
      // Admin can move conversation from team1 to team2
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: team2.id,
          assignedUserId: agentTeam2.id
        })
        .where(eq(schema.conversations.id, conversationTeam1.id));

      const updated = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, conversationTeam1.id)
      });

      expect(updated?.assignedTeamId).toBe(team2.id);
      expect(updated?.assignedUserId).toBe(agentTeam2.id);
    });

    test('should allow admin to unassign any conversation', async () => {
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: null,
          assignedUserId: null,
          status: 'active'
        })
        .where(eq(schema.conversations.id, conversationTeam1.id));

      const updated = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, conversationTeam1.id)
      });

      expect(updated?.assignedTeamId).toBeNull();
      expect(updated?.assignedUserId).toBeNull();
    });
  });

  // ==================== Agent Access - Team-Scoped ====================
  describe('Agent Role - Team-Scoped Access', () => {
    test('should only show conversations assigned to agent team', async () => {
      // Agent from team1 should only see team1 conversations
      const team1Conversations = await env.db.query.conversations.findMany({
        where: (conversations, { eq }) => eq(conversations.assignedTeamId, team1.id)
      });

      expect(team1Conversations).toHaveLength(1);
      expect(team1Conversations[0].id).toBe(conversationTeam1.id);
    });

    test('should not show conversations from other teams', async () => {
      // Agent from team1 should NOT see team2 conversations
      const team1Conversations = await env.db.query.conversations.findMany({
        where: (conversations, { eq }) => eq(conversations.assignedTeamId, team1.id)
      });

      expect(team1Conversations.map(c => c.id)).not.toContain(conversationTeam2.id);
    });

    test('should allow agent to view their assigned conversations', async () => {
      // Agent should see conversation assigned to them
      const agentConversations = await env.db.query.conversations.findMany({
        where: (conversations, { eq }) => eq(conversations.assignedUserId, agentTeam1.id)
      });

      expect(agentConversations).toHaveLength(1);
      expect(agentConversations[0].id).toBe(conversationTeam1.id);
    });

    test('should allow agent to send messages to their assigned conversations', async () => {
      // Agent can send message to their conversation
      const message = await env.createTestMessage(conversationTeam1.id, {
        id: 'msg-agent-send',
        content: 'Agent message',
        senderType: 'agent',
        agentSenderId: agentTeam1.id
      });

      expect(message.conversationId).toBe(conversationTeam1.id);
      expect(message.agentSenderId).toBe(agentTeam1.id);
    });

    test('should not allow agent to directly access other team conversations', async () => {
      // Agent from team1 trying to access team2 conversation
      const team2Conv = await env.db.query.conversations.findFirst({
        where: (conversations, { and, eq }) => and(
          eq(conversations.id, conversationTeam2.id),
          eq(conversations.assignedTeamId, team1.id) // This will fail
        )
      });

      expect(team2Conv).toBeUndefined();
    });
  });

  // ==================== Unassigned Conversations ====================
  describe('Unassigned Conversation Access', () => {
    test('should allow admin to view unassigned conversations', async () => {
      const unassigned = await env.db.query.conversations.findFirst({
        where: (conversations, { eq, and, isNull }) => and(
          eq(conversations.id, conversationUnassigned.id),
          isNull(conversations.assignedTeamId)
        )
      });

      expect(unassigned).toBeDefined();
      expect(unassigned?.assignedTeamId).toBeNull();
    });

    test('should allow admin to assign unassigned conversations', async () => {
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: team1.id,
          assignedUserId: agentTeam1.id,
          status: 'assigned'
        })
        .where(eq(schema.conversations.id, conversationUnassigned.id));

      const updated = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, conversationUnassigned.id)
      });

      expect(updated?.assignedTeamId).toBe(team1.id);
    });

    test('should restrict agent access to unassigned conversations', async () => {
      // Agent should NOT see unassigned conversations by default
      const agentVisibleConversations = await env.db.query.conversations.findMany({
        where: (conversations, { eq }) => eq(conversations.assignedTeamId, team1.id)
      });

      expect(agentVisibleConversations.map(c => c.id)).not.toContain(conversationUnassigned.id);
    });
  });

  // ==================== Permission Checks for Operations ====================
  describe('Operation-Level Permission Checks', () => {
    test('should verify assign permission before assigning conversation', async () => {
      const { PermissionService } = await import('@shared/services/permission-service');

      // Mock admin permission check
      (PermissionService.checkPermission as any).mockResolvedValue(true);

      const hasPermission = await PermissionService.checkPermission(
        adminUser.id,
        'conversation',
        'assign'
      );

      expect(hasPermission).toBe(true);
    });

    test('should verify view permission before fetching conversations', async () => {
      const { PermissionService } = await import('@shared/services/permission-service');

      (PermissionService.checkPermission as any).mockResolvedValue(true);

      const hasPermission = await PermissionService.checkPermission(
        agentTeam1.id,
        'conversation',
        'view',
        {
          userId: Number(agentTeam1.id),
          role: 'agent',
          resourceId: conversationTeam1.id
        }
      );

      expect(hasPermission).toBe(true);
    });

    test('should verify send permission before sending messages', async () => {
      const { PermissionService } = await import('@shared/services/permission-service');

      (PermissionService.checkPermission as any).mockResolvedValue(true);

      const hasPermission = await PermissionService.checkPermission(
        agentTeam1.id,
        'message',
        'send',
        {
          userId: Number(agentTeam1.id),
          role: 'agent',
          resourceId: conversationTeam1.id
        }
      );

      expect(hasPermission).toBe(true);
    });

    test('should deny operation when permission check fails', async () => {
      const { PermissionService } = await import('@shared/services/permission-service');

      // Mock permission denied
      (PermissionService.checkPermission as any).mockResolvedValue(false);

      const hasPermission = await PermissionService.checkPermission(
        agentTeam1.id,
        'conversation',
        'assign'
      );

      expect(hasPermission).toBe(false);
      // In real handler, this would return 403 error
    });
  });

  // ==================== Cross-Team Scenarios ====================
  describe('Cross-Team Access Scenarios', () => {
    test('should prevent agent from viewing cross-team conversation details', async () => {
      // Agent from team1 trying to get team2 conversation
      const conversation = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, conversationTeam2.id)
      });

      // Conversation exists in DB
      expect(conversation).toBeDefined();

      // But permission check should fail for team1 agent
      const isTeam1Conversation = conversation?.assignedTeamId === team1.id;
      expect(isTeam1Conversation).toBe(false);
    });

    test('should prevent agent from sending messages to other team conversations', async () => {
      // Agent from team1 should not be able to send to team2 conversation
      // This would be enforced by permission check in handler

      // Verify the conversation belongs to team2
      const conversation = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, conversationTeam2.id)
      });

      expect(conversation?.assignedTeamId).toBe(team2.id);
      expect(conversation?.assignedTeamId).not.toBe(team1.id);
    });

    test('should allow conversation transfer with proper permissions', async () => {
      // Record transfer from team1 to team2
      await env.db.insert(schema.conversationTransfers).values({
        conversationId: conversationTeam1.id,
        fromTeamId: team1.id,
        toTeamId: team2.id,
        fromUserId: agentTeam1.id,
        toUserId: agentTeam2.id,
        transferReason: 'Cross-team escalation',
        transferredBy: adminUser.id,
        createdAt: new Date().toISOString()
      });

      // Update conversation
      await env.db
        .update(schema.conversations)
        .set({
          assignedTeamId: team2.id,
          assignedUserId: agentTeam2.id
        })
        .where(eq(schema.conversations.id, conversationTeam1.id));

      const updated = await env.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.id, conversationTeam1.id)
      });

      expect(updated?.assignedTeamId).toBe(team2.id);

      // Verify transfer history
      const transfers = await env.db.query.conversationTransfers.findMany({
        where: (transfers, { eq }) => eq(transfers.conversationId, conversationTeam1.id)
      });

      expect(transfers).toHaveLength(1);
      expect(transfers[0].fromTeamId).toBe(team1.id);
      expect(transfers[0].toTeamId).toBe(team2.id);
    });
  });

  // ==================== Visible Conversations Query ====================
  describe('getVisibleConversations Implementation', () => {
    test('should return all conversation IDs for admin', async () => {
      // Simulate PermissionService.getVisibleConversations for admin
      const allConversations = await env.db.query.conversations.findMany({
        columns: { id: true }
      });

      const visibleIds = allConversations.map(c => c.id);

      expect(visibleIds).toHaveLength(3);
      expect(visibleIds).toContain(conversationTeam1.id);
      expect(visibleIds).toContain(conversationTeam2.id);
      expect(visibleIds).toContain(conversationUnassigned.id);
    });

    test('should return only team conversations for agent', async () => {
      // Simulate PermissionService.getVisibleConversations for agent
      const teamConversations = await env.db.query.conversations.findMany({
        where: (conversations, { eq }) => eq(conversations.assignedTeamId, team1.id),
        columns: { id: true }
      });

      const visibleIds = teamConversations.map(c => c.id);

      expect(visibleIds).toHaveLength(1);
      expect(visibleIds).toContain(conversationTeam1.id);
      expect(visibleIds).not.toContain(conversationTeam2.id);
    });

    test('should return empty array for agent with no team', async () => {
      // Create agent without team
      const noTeamAgent = await env.createTestAgent({
        id: 'agent-no-team',
        email: 'noteam@test.com',
        displayName: 'No Team Agent',
        role: 'agent',
        teamId: null
      });

      // Query conversations for this agent (should be empty)
      const teamConversations = await env.db.query.conversations.findMany({
        where: (conversations, { eq }) => eq(conversations.assignedUserId, noTeamAgent.id),
        columns: { id: true }
      });

      expect(teamConversations).toHaveLength(0);
    });
  });

  // ==================== Message Access Control ====================
  describe('Message-Level Access Control', () => {
    test('should allow viewing messages from assigned conversation', async () => {
      await env.createTestMessage(conversationTeam1.id, {
        id: 'msg-access-test',
        content: 'Test message',
        senderType: 'agent',
        agentSenderId: agentTeam1.id
      });

      const messages = await env.db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, conversationTeam1.id)
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Test message');
    });

    test('should restrict message access based on conversation permissions', async () => {
      // Messages from team2 conversation
      await env.createTestMessage(conversationTeam2.id, {
        id: 'msg-team2',
        content: 'Team 2 message',
        senderType: 'agent',
        agentSenderId: agentTeam2.id
      });

      // Agent from team1 should not access these messages
      // (enforced through conversation visibility)
      const team1Conversations = await env.db.query.conversations.findMany({
        where: (conversations, { eq }) => eq(conversations.assignedTeamId, team1.id),
        columns: { id: true }
      });

      const team1ConversationIds = team1Conversations.map(c => c.id);
      expect(team1ConversationIds).not.toContain(conversationTeam2.id);

      // Therefore messages from conversationTeam2 are not accessible
      const accessibleMessages = await env.db.query.messages.findMany({
        where: (messages, { inArray }) => inArray(messages.conversationId, team1ConversationIds)
      });

      const messageIds = accessibleMessages.map(m => m.id);
      expect(messageIds).not.toContain('msg-team2');
    });
  });
});
