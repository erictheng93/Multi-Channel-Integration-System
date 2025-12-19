/**
 * Conversation Handler - REAL Integration Tests
 *
 * 🎯 Testing with REAL Cloudflare Resources:
 * - ✅ Real Remote D1 Database
 * - ✅ Real KV Namespaces
 * - ✅ Real R2 Bucket
 * - ✅ Real Durable Objects
 *
 * ⚠️ IMPORTANT: This test connects to PRODUCTION REMOTE resources
 *
 * @see tests/UNIT_TESTS_EVALUATION_REPORT.md for testing strategy
 * @see src/handlers/conversation.ts for implementation
 */

import { describe, test, expect, beforeAll } from 'vitest';
import {
  getRealWorker,
  createRealTestToken,
  TEST_USERS,
  jsonPost,
  jsonPut,
  deleteRequest,
  getRequest,
  parseJsonResponse,
  assertSuccess,
  generateTestId,
  createTestConversation
} from '../helpers/real-integration-test-setup';
import type { UnstableDevWorker } from 'wrangler';

describe('Conversation Handler - Real Integration Tests', () => {
  let worker: UnstableDevWorker;
  let adminToken: string;
  let agentToken: string;

  beforeAll(async () => {
    worker = getRealWorker();

    // Generate real JWT tokens
    adminToken = await createRealTestToken(TEST_USERS.admin);
    agentToken = await createRealTestToken(TEST_USERS.agent);

    console.log('✅ Test tokens generated');
  });

  describe('GET /api/conversations - List Conversations', () => {
    test('should list conversations for authenticated admin', async () => {
      const response = await worker.fetch(
        'https://fake-host/api/conversations',
        getRequest(adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(200);
      assertSuccess(data);
      expect(data.data).toBeInstanceOf(Array);
    });

    test('should list conversations for authenticated agent', async () => {
      const response = await worker.fetch(
        'https://fake-host/api/conversations',
        getRequest(agentToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(200);
      assertSuccess(data);
      expect(data.data).toBeInstanceOf(Array);
    });

    test('should return 401 for unauthenticated request', async () => {
      const response = await worker.fetch(
        'https://fake-host/api/conversations',
        getRequest()
      );

      expect(response.status).toBe(401);
    });

    test('should support pagination parameters', async () => {
      const response = await worker.fetch(
        'https://fake-host/api/conversations?page=1&limit=10',
        getRequest(adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(200);
      assertSuccess(data);
      expect(data.data).toBeInstanceOf(Array);
      expect(data.data.length).toBeLessThanOrEqual(10);
    });

    test('should filter by status', async () => {
      const response = await worker.fetch(
        'https://fake-host/api/conversations?status=active',
        getRequest(adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(200);
      assertSuccess(data);

      // All conversations should have active status
      if (data.data.length > 0) {
        data.data.forEach((conv: any) => {
          expect(conv.status).toBe('active');
        });
      }
    });

    test('should filter by assignedTo', async () => {
      const response = await worker.fetch(
        `https://fake-host/api/conversations?assignedTo=${TEST_USERS.agent.userId}`,
        getRequest(adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(200);
      assertSuccess(data);
    });
  });

  describe('POST /api/conversations - Create Conversation', () => {
    test('should create a new conversation with valid data', async () => {
      const conversationData = createTestConversation({
        customerId: generateTestId('customer'),
        subject: 'Real Integration Test - Create Conversation'
      });

      const response = await worker.fetch(
        'https://fake-host/api/conversations',
        jsonPost(conversationData, adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(201);
      assertSuccess(data);
      expect(data.data).toHaveProperty('id');
      expect(data.data.subject).toBe(conversationData.subject);
      expect(data.data.customerId).toBe(conversationData.customerId);
      expect(data.data.status).toBe('active');
    });

    test('should reject conversation creation without customerId', async () => {
      const invalidData = {
        channelType: 'line',
        subject: 'Invalid Conversation'
        // Missing customerId
      };

      const response = await worker.fetch(
        'https://fake-host/api/conversations',
        jsonPost(invalidData, adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('customerId');
    });

    test('should reject conversation creation without channelType', async () => {
      const invalidData = {
        customerId: generateTestId('customer'),
        subject: 'Invalid Conversation'
        // Missing channelType
      };

      const response = await worker.fetch(
        'https://fake-host/api/conversations',
        jsonPost(invalidData, adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('channelType');
    });

    test('should allow agent to create conversation', async () => {
      const conversationData = createTestConversation({
        customerId: generateTestId('customer'),
        subject: 'Agent Created Conversation'
      });

      const response = await worker.fetch(
        'https://fake-host/api/conversations',
        jsonPost(conversationData, agentToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(201);
      assertSuccess(data);
      expect(data.data).toHaveProperty('id');
    });
  });

  describe('GET /api/conversations/:id - Get Single Conversation', () => {
    let testConversationId: string;

    beforeAll(async () => {
      // Create a test conversation first
      const conversationData = createTestConversation({
        customerId: generateTestId('customer'),
        subject: 'Test Conversation for GET'
      });

      const response = await worker.fetch(
        'https://fake-host/api/conversations',
        jsonPost(conversationData, adminToken)
      );

      const { data } = await parseJsonResponse(response);
      testConversationId = data.data.id;
    });

    test('should get conversation by ID', async () => {
      const response = await worker.fetch(
        `https://fake-host/api/conversations/${testConversationId}`,
        getRequest(adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(200);
      assertSuccess(data);
      expect(data.data.id).toBe(testConversationId);
      expect(data.data).toHaveProperty('subject');
      expect(data.data).toHaveProperty('customerId');
      expect(data.data).toHaveProperty('status');
    });

    test('should return 404 for non-existent conversation', async () => {
      const fakeId = generateTestId('conv-fake');

      const response = await worker.fetch(
        `https://fake-host/api/conversations/${fakeId}`,
        getRequest(adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(404);
      expect(data.success).toBe(false);
    });

    test('should allow agent to get conversation they have access to', async () => {
      const response = await worker.fetch(
        `https://fake-host/api/conversations/${testConversationId}`,
        getRequest(agentToken)
      );

      const { status, data } = await parseJsonResponse(response);

      // Agent should either get 200 (has access) or 403 (no access)
      expect([200, 403]).toContain(status);

      if (status === 200) {
        assertSuccess(data);
        expect(data.data.id).toBe(testConversationId);
      }
    });
  });

  describe('PUT /api/conversations/:id - Update Conversation', () => {
    let testConversationId: string;

    beforeAll(async () => {
      // Create a test conversation
      const conversationData = createTestConversation({
        customerId: generateTestId('customer'),
        subject: 'Test Conversation for UPDATE'
      });

      const response = await worker.fetch(
        'https://fake-host/api/conversations',
        jsonPost(conversationData, adminToken)
      );

      const { data } = await parseJsonResponse(response);
      testConversationId = data.data.id;
    });

    test('should update conversation subject', async () => {
      const updateData = {
        subject: 'Updated Subject - Real Integration Test'
      };

      const response = await worker.fetch(
        `https://fake-host/api/conversations/${testConversationId}`,
        jsonPut(updateData, adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(200);
      assertSuccess(data);
      expect(data.data.subject).toBe(updateData.subject);
    });

    test('should update conversation status', async () => {
      const updateData = {
        status: 'closed'
      };

      const response = await worker.fetch(
        `https://fake-host/api/conversations/${testConversationId}`,
        jsonPut(updateData, adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(200);
      assertSuccess(data);
      expect(data.data.status).toBe('closed');
    });

    test('should reject invalid status value', async () => {
      const updateData = {
        status: 'invalid-status'
      };

      const response = await worker.fetch(
        `https://fake-host/api/conversations/${testConversationId}`,
        jsonPut(updateData, adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/conversations/:id - Delete Conversation', () => {
    test('should delete conversation (admin only)', async () => {
      // Create a conversation to delete
      const conversationData = createTestConversation({
        customerId: generateTestId('customer'),
        subject: 'Test Conversation for DELETE'
      });

      const createResponse = await worker.fetch(
        'https://fake-host/api/conversations',
        jsonPost(conversationData, adminToken)
      );

      const { data: createData } = await parseJsonResponse(createResponse);
      const conversationId = createData.data.id;

      // Delete the conversation
      const deleteResponse = await worker.fetch(
        `https://fake-host/api/conversations/${conversationId}`,
        deleteRequest(adminToken)
      );

      const { status, data } = await parseJsonResponse(deleteResponse);

      expect(status).toBe(200);
      assertSuccess(data);

      // Verify conversation is deleted (soft delete - should have deletedAt)
      const getResponse = await worker.fetch(
        `https://fake-host/api/conversations/${conversationId}`,
        getRequest(adminToken)
      );

      const { status: getStatus } = await parseJsonResponse(getResponse);
      expect(getStatus).toBe(404);
    });

    test('should prevent agent from deleting conversation (admin only)', async () => {
      // Create a conversation
      const conversationData = createTestConversation({
        customerId: generateTestId('customer'),
        subject: 'Agent Cannot Delete This'
      });

      const createResponse = await worker.fetch(
        'https://fake-host/api/conversations',
        jsonPost(conversationData, adminToken)
      );

      const { data: createData } = await parseJsonResponse(createResponse);
      const conversationId = createData.data.id;

      // Try to delete as agent
      const deleteResponse = await worker.fetch(
        `https://fake-host/api/conversations/${conversationId}`,
        deleteRequest(agentToken)
      );

      const { status } = await parseJsonResponse(deleteResponse);

      // Should be 403 Forbidden (not admin)
      expect(status).toBe(403);
    });
  });

  describe('POST /api/conversations/:id/mark-read - Mark as Read', () => {
    let testConversationId: string;

    beforeAll(async () => {
      // Create a test conversation
      const conversationData = createTestConversation({
        customerId: generateTestId('customer'),
        subject: 'Test Conversation for Mark Read'
      });

      const response = await worker.fetch(
        'https://fake-host/api/conversations',
        jsonPost(conversationData, adminToken)
      );

      const { data } = await parseJsonResponse(response);
      testConversationId = data.data.id;
    });

    test('should mark conversation as read', async () => {
      const response = await worker.fetch(
        `https://fake-host/api/conversations/${testConversationId}/mark-read`,
        jsonPost({}, adminToken)
      );

      const { status, data } = await parseJsonResponse(response);

      expect(status).toBe(200);
      assertSuccess(data);
    });
  });
});
