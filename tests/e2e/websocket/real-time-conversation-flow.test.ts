// End-to-End Real-time Conversation Flow Tests
// Tests complete conversation workflows through WebSocket system
// including message delivery, typing indicators, assignments, and delayed messages

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DurableObjectsTestEnvironment,
  testEnv,
  TestPerformanceMonitor
} from '../../helpers/websocket/durable-objects-test-env';
import {
  WebSocketTestClient,
  WebSocketRoomTestController,
  WebSocketTestClientFactory
} from '../../helpers/websocket/websocket-test-client';
import {
  TestDataFactory,
  TestAssertions,
  TestScenarios
} from '../../helpers/websocket/websocket-test-utils';
import { ConversationRoom } from '../../../src/durable-objects/ConversationRoom';
import { UserConnection } from '../../../src/durable-objects/UserConnection';
import { MessageBroadcaster } from '../../../src/durable-objects/MessageBroadcaster';
import { DelayedMessageProcessor } from '../../../src/durable-objects/DelayedMessageProcessor';
import { WebSocketBroadcastService } from '../../../src/services/websocket-broadcast-service';
import type {
  DelayedMessage,
  DurableObjectEvent
} from '../../../src/types/websocket-types';

describe('Real-time Conversation Flow E2E Tests', () => {
  let broadcastService: WebSocketBroadcastService;
  let mockEnv: any;
  let performanceMonitor: TestPerformanceMonitor;

  beforeEach(async () => {
    testEnv.reset();
    performanceMonitor = new TestPerformanceMonitor();

    // Register all Durable Objects
    testEnv.registerDurableObject('CONVERSATION_ROOM', ConversationRoom);
    testEnv.registerDurableObject('USER_CONNECTION', UserConnection);
    testEnv.registerDurableObject('MESSAGE_BROADCASTER', MessageBroadcaster);
    testEnv.registerDurableObject('DELAYED_MESSAGE_PROCESSOR', DelayedMessageProcessor);

    // Setup comprehensive mock environment
    mockEnv = {
      ...testEnv.getBindings(),
      DB: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([
                { id: 'agent_1', name: 'Agent Smith', role: 'agent', teamId: 1 },
                { id: 'agent_2', name: 'Agent Jones', role: 'agent', teamId: 1 },
                { id: 'team_lead', name: 'Team Leader', role: 'team', teamId: 1 },
                { id: 'admin_user', name: 'Admin User', role: 'admin', teamId: null }
              ])
            })
          })
        }),
        insert: vi.fn().mockReturnValue({
          into: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue({ insertId: 'new_message_id' })
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue({ changes: 1 })
            })
          })
        })
      },
      SESSIONS: {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'websocket_migration_config') {
            return JSON.stringify(TestDataFactory.createMigrationConfig());
          }
          return null;
        }),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      REALTIME_QUEUE: {
        send: vi.fn().mockResolvedValue(undefined)
      }
    };

    broadcastService = new WebSocketBroadcastService(mockEnv);
  });

  afterEach(() => {
    testEnv.reset();
    vi.clearAllMocks();
    performanceMonitor.clearMetrics();
  });

  describe('Complete Conversation Workflow', () => {
    it('should handle full customer conversation lifecycle', async () => {
      const conversationId = 'customer_conversation_e2e';

      // Create participants
      const customer = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent', // Simulating customer as agent for test
        userId: 'customer_123'
      });

      const agent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'agent_smith'
      });

      const teamLead = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'team',
        userId: 'team_lead_1'
      });

      const admin = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'admin',
        userId: 'admin_user'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      [customer, agent, teamLead, admin].forEach(client => controller.addClient(client));

      console.log('🎬 Starting complete conversation workflow...');

      // Phase 1: Initial connection and assignment
      console.log('📞 Phase 1: Connection and assignment');
      performanceMonitor.startTimer('conversation_lifecycle');

      await controller.connectAllClients();

      // Simulate conversation assignment
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_assigned',
        conversationId: conversationId,
        userId: admin.userId,
        data: {
          assignedTo: agent.userId,
          assignedBy: admin.userId,
          assignedAt: Date.now(),
          priority: 'normal'
        }
      });

      // All participants should receive assignment notification
      const assignmentEvents = await Promise.all([
        TestAssertions.assertEventReceived(customer, 'conversation_assigned'),
        TestAssertions.assertEventReceived(agent, 'conversation_assigned'),
        TestAssertions.assertEventReceived(teamLead, 'conversation_assigned'),
        TestAssertions.assertEventReceived(admin, 'conversation_assigned')
      ]);

      assignmentEvents.forEach(event => {
        expect(event.data.assignedTo).toBe(agent.userId);
        expect(event.data.assignedBy).toBe(admin.userId);
      });

      // Phase 2: Customer initiates conversation
      console.log('💬 Phase 2: Customer message exchange');

      // Customer sends initial message
      const customerMessageId = await customer.sendChatMessage('Hello, I need help with my order');

      // Agent should receive customer message
      const customerMessageEvent = await TestAssertions.assertEventReceived(
        agent,
        'message_sent',
        2000
      );

      expect(customerMessageEvent.data.content).toBe('Hello, I need help with my order');
      expect(customerMessageEvent.userId).toBe(customer.userId);

      // Agent starts typing
      await agent.sendTyping(true);

      // Customer and team lead should see typing indicator
      const [customerTypingEvent, teamTypingEvent] = await Promise.all([
        TestAssertions.assertEventReceived(customer, 'typing_start'),
        TestAssertions.assertEventReceived(teamLead, 'typing_start')
      ]);

      expect(customerTypingEvent.userId).toBe(agent.userId);
      expect(teamTypingEvent.userId).toBe(agent.userId);

      // Agent responds
      await agent.sendTyping(false);
      const agentResponseId = await agent.sendChatMessage('Hi! I can help you with that. What\'s your order number?');

      // Customer receives agent response
      const agentResponseEvent = await TestAssertions.assertEventReceived(
        customer,
        'message_sent',
        2000
      );

      expect(agentResponseEvent.data.content).toContain('order number');
      expect(agentResponseEvent.userId).toBe(agent.userId);

      // Phase 3: Delayed message scheduling
      console.log('⏰ Phase 3: Delayed message handling');

      // Agent schedules a delayed follow-up message
      const delayedMessage: DelayedMessage = {
        id: 'delayed_followup_123',
        conversationId: conversationId,
        agentId: agent.userId,
        content: 'Just checking - did my previous response help resolve your issue?',
        messageType: 'text',
        delaySeconds: 5, // Short delay for testing
        scheduledAt: Date.now(),
        executeAt: Date.now() + (5 * 1000),
        status: 'scheduled'
      };

      // Schedule delayed message
      const delayedProcessor = testEnv.getNamespace('DELAYED_MESSAGE_PROCESSOR');
      const processorId = delayedProcessor.idFromName('global');
      const processorStub = delayedProcessor.get(processorId);

      const scheduleResponse = await processorStub.fetch(new Request('https://delayed-processor/schedule', {
        method: 'POST',
        body: JSON.stringify(delayedMessage),
        headers: { 'Content-Type': 'application/json' }
      }));

      expect(scheduleResponse.ok).toBe(true);

      // Simulate countdown events
      for (let remaining = 5; remaining > 0; remaining--) {
        await broadcastService.broadcastDelayedMessageEvent({
          type: 'delayed_message_countdown',
          conversationId: conversationId,
          messageId: delayedMessage.id,
          agentId: agent.userId,
          data: {
            remainingSeconds: remaining,
            content: delayedMessage.content
          }
        });

        // Agent should see countdown updates
        const countdownEvent = await TestAssertions.assertEventReceived(
          agent,
          'delayed_message_countdown',
          1000
        );

        expect(countdownEvent.data.remainingSeconds).toBe(remaining);

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Simulate delayed message execution
      await broadcastService.broadcastDelayedMessageEvent({
        type: 'delayed_message_sent',
        conversationId: conversationId,
        messageId: delayedMessage.id,
        agentId: agent.userId,
        data: {
          content: delayedMessage.content,
          sentAt: Date.now(),
          originalScheduledTime: delayedMessage.executeAt
        }
      });

      // All participants should receive delayed message sent notification
      const delayedSentEvents = await Promise.all([
        TestAssertions.assertEventReceived(customer, 'delayed_message_sent'),
        TestAssertions.assertEventReceived(agent, 'delayed_message_sent'),
        TestAssertions.assertEventReceived(teamLead, 'delayed_message_sent')
      ]);

      delayedSentEvents.forEach(event => {
        expect(event.data.messageId).toBe(delayedMessage.id);
        expect(event.data.content).toBe(delayedMessage.content);
      });

      // Phase 4: Conversation escalation
      console.log('📈 Phase 4: Conversation escalation');

      // Customer indicates need for escalation
      await customer.sendChatMessage('This is urgent, I need to speak to a supervisor');

      // Agent transfers to team lead
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_transferred',
        conversationId: conversationId,
        data: {
          fromAgent: agent.userId,
          toAgent: teamLead.userId,
          transferredBy: agent.userId,
          transferReason: 'Customer requested escalation',
          transferredAt: Date.now()
        }
      });

      // All should receive transfer notification
      const transferEvents = await Promise.all([
        TestAssertions.assertEventReceived(customer, 'conversation_transferred'),
        TestAssertions.assertEventReceived(agent, 'conversation_transferred'),
        TestAssertions.assertEventReceived(teamLead, 'conversation_transferred'),
        TestAssertions.assertEventReceived(admin, 'conversation_transferred')
      ]);

      transferEvents.forEach(event => {
        expect(event.data.fromAgent).toBe(agent.userId);
        expect(event.data.toAgent).toBe(teamLead.userId);
        expect(event.data.transferReason).toBe('Customer requested escalation');
      });

      // Team lead responds
      await teamLead.sendChatMessage('Hello, I\'m the team lead. I understand you need urgent assistance.');

      // Customer receives team lead response
      const teamLeadResponseEvent = await TestAssertions.assertEventReceived(
        customer,
        'message_sent',
        2000
      );

      expect(teamLeadResponseEvent.userId).toBe(teamLead.userId);
      expect(teamLeadResponseEvent.data.content).toContain('team lead');

      // Phase 5: Resolution and status change
      console.log('✅ Phase 5: Resolution and closure');

      // Customer indicates satisfaction
      await customer.sendChatMessage('Thank you, that resolved my issue!');

      // Team lead marks conversation as resolved
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_status_changed',
        conversationId: conversationId,
        data: {
          oldStatus: 'active',
          newStatus: 'resolved',
          changedBy: teamLead.userId,
          changedAt: Date.now(),
          resolution: 'Customer issue resolved by team lead'
        }
      });

      // All should receive status change
      const statusEvents = await Promise.all([
        TestAssertions.assertEventReceived(customer, 'conversation_status_changed'),
        TestAssertions.assertEventReceived(agent, 'conversation_status_changed'),
        TestAssertions.assertEventReceived(teamLead, 'conversation_status_changed'),
        TestAssertions.assertEventReceived(admin, 'conversation_status_changed')
      ]);

      statusEvents.forEach(event => {
        expect(event.data.newStatus).toBe('resolved');
        expect(event.data.changedBy).toBe(teamLead.userId);
      });

      const totalTime = performanceMonitor.endTimer('conversation_lifecycle');

      console.log(`✅ Complete conversation workflow completed in ${totalTime}ms`);

      // Verify all participants are still connected
      const roomStats = controller.getRoomStats();
      expect(roomStats.connectedClients).toBe(4);

      // Performance expectations
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds

      await controller.disconnectAllClients();
    });

    it('should handle multi-agent collaboration workflow', async () => {
      const conversationId = 'collaboration_workflow_e2e';

      // Create team of agents
      const primaryAgent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'primary_agent'
      });

      const secondaryAgent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'secondary_agent'
      });

      const expertAgent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'expert_agent'
      });

      const supervisor = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'team',
        userId: 'supervisor'
      });

      const customer = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent', // Simulated customer
        userId: 'customer_456'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      [primaryAgent, secondaryAgent, expertAgent, supervisor, customer].forEach(
        client => controller.addClient(client)
      );

      console.log('👥 Starting multi-agent collaboration workflow...');

      await controller.connectAllClients();

      // Phase 1: Customer inquiry requiring collaboration
      console.log('🔍 Phase 1: Complex customer inquiry');

      await customer.sendChatMessage('I have a complex technical issue with integration between your API and our enterprise system');

      // Primary agent receives and acknowledges
      const inquiryEvent = await TestAssertions.assertEventReceived(
        primaryAgent,
        'message_sent',
        2000
      );

      expect(inquiryEvent.data.content).toContain('complex technical issue');

      await primaryAgent.sendChatMessage('I understand this is a technical integration issue. Let me bring in our technical expert to assist.');

      // Phase 2: Expert consultation
      console.log('🧠 Phase 2: Expert consultation');

      // Primary agent privately consults with expert (simulated internal chat)
      await broadcastService.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: conversationId,
        messageId: 'internal_consultation_1',
        userId: primaryAgent.userId,
        data: {
          content: 'Expert consultation: Customer needs help with API integration',
          messageType: 'internal',
          recipientId: expertAgent.userId
        }
      });

      // Expert joins the conversation
      await broadcastService.broadcastConversationEvent({
        type: 'participant_joined',
        conversationId: conversationId,
        data: {
          userId: expertAgent.userId,
          userName: 'Technical Expert',
          role: 'expert',
          joinedAt: Date.now()
        }
      });

      const joinEvent = await TestAssertions.assertEventReceived(
        customer,
        'participant_joined',
        2000
      );

      expect(joinEvent.data.userId).toBe(expertAgent.userId);

      // Expert provides technical guidance
      await expertAgent.sendChatMessage('Hello! I specialize in API integrations. Can you share your current integration setup?');

      // Phase 3: Parallel agent assistance
      console.log('⚡ Phase 3: Parallel agent work');

      // Secondary agent researches in parallel
      await secondaryAgent.sendTyping(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      await secondaryAgent.sendTyping(false);

      await secondaryAgent.sendChatMessage('I\'ve pulled up your account and can see your current API configuration. Here are some initial findings...');

      // Customer provides technical details
      await customer.sendChatMessage('We\'re using REST API v2.1 with OAuth authentication, but getting 403 errors on certain endpoints');

      // Multiple agents respond simultaneously
      const agentResponses = await Promise.all([
        primaryAgent.sendChatMessage('The 403 errors typically indicate permission scope issues'),
        expertAgent.sendChatMessage('Let me check the specific endpoints you\'re accessing'),
        secondaryAgent.sendChatMessage('I can see your OAuth scope might need updating')
      ]);

      // Customer should receive all agent responses
      const responseEvents = await Promise.all([
        TestAssertions.assertEventReceived(customer, 'message_sent'),
        TestAssertions.assertEventReceived(customer, 'message_sent'),
        TestAssertions.assertEventReceived(customer, 'message_sent')
      ]);

      expect(responseEvents).toHaveLength(3);

      // Phase 4: Coordinated resolution
      console.log('🎯 Phase 4: Coordinated resolution');

      // Expert provides detailed solution
      await expertAgent.sendChatMessage('Based on the analysis, you need to update your OAuth scope to include "api:write" permissions. Here\'s the exact configuration...');

      // Primary agent schedules follow-up
      const followUpDelayed: DelayedMessage = {
        id: 'collaboration_followup',
        conversationId: conversationId,
        agentId: primaryAgent.userId,
        content: 'Hi! Just following up on the API integration fix. Is everything working correctly now?',
        messageType: 'text',
        delaySeconds: 3,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (3 * 1000),
        status: 'scheduled'
      };

      const delayedProcessor = testEnv.getNamespace('DELAYED_MESSAGE_PROCESSOR');
      const processorStub = delayedProcessor.get(delayedProcessor.idFromName('global'));

      await processorStub.fetch(new Request('https://delayed-processor/schedule', {
        method: 'POST',
        body: JSON.stringify(followUpDelayed),
        headers: { 'Content-Type': 'application/json' }
      }));

      // Secondary agent provides documentation
      await secondaryAgent.sendChatMessage('I\'ve also sent you documentation links via email for future reference');

      // Phase 5: Supervisor oversight
      console.log('👨‍💼 Phase 5: Supervisor quality check');

      // Supervisor reviews the collaboration
      await supervisor.sendChatMessage('Excellent collaboration team! Customer, are you satisfied with the technical solution provided?');

      // Customer confirms resolution
      await customer.sendChatMessage('Yes, perfect! The team worked together seamlessly and solved my complex issue quickly.');

      // Supervisor marks as resolved with collaboration notes
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_status_changed',
        conversationId: conversationId,
        data: {
          oldStatus: 'active',
          newStatus: 'resolved',
          changedBy: supervisor.userId,
          changedAt: Date.now(),
          resolution: 'Complex technical issue resolved through multi-agent collaboration',
          collaboratingAgents: [primaryAgent.userId, secondaryAgent.userId, expertAgent.userId],
          resolutionType: 'technical_collaboration'
        }
      });

      // All participants receive resolution notification
      const resolutionEvents = await Promise.all([
        TestAssertions.assertEventReceived(customer, 'conversation_status_changed'),
        TestAssertions.assertEventReceived(primaryAgent, 'conversation_status_changed'),
        TestAssertions.assertEventReceived(secondaryAgent, 'conversation_status_changed'),
        TestAssertions.assertEventReceived(expertAgent, 'conversation_status_changed'),
        TestAssertions.assertEventReceived(supervisor, 'conversation_status_changed')
      ]);

      resolutionEvents.forEach(event => {
        expect(event.data.newStatus).toBe('resolved');
        expect(event.data.collaboratingAgents).toHaveLength(3);
        expect(event.data.resolutionType).toBe('technical_collaboration');
      });

      console.log('✅ Multi-agent collaboration workflow completed successfully');

      await controller.disconnectAllClients();
    });

    it('should handle message recall in active conversation', async () => {
      const conversationId = 'message_recall_e2e';

      const agent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'agent_recall'
      });

      const customer = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent', // Simulated customer
        userId: 'customer_recall'
      });

      const supervisor = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'team',
        userId: 'supervisor_recall'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      [agent, customer, supervisor].forEach(client => controller.addClient(client));

      console.log('🔄 Starting message recall workflow...');

      await controller.connectAllClients();

      // Phase 1: Agent sends delayed message
      console.log('📤 Phase 1: Scheduling delayed message');

      const delayedMessage: DelayedMessage = {
        id: 'recall_test_message',
        conversationId: conversationId,
        agentId: agent.userId,
        content: 'Based on our conversation, I recommend upgrading to our premium plan for $299/month',
        messageType: 'text',
        delaySeconds: 10,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (10 * 1000),
        status: 'scheduled'
      };

      const delayedProcessor = testEnv.getNamespace('DELAYED_MESSAGE_PROCESSOR');
      const processorStub = delayedProcessor.get(delayedProcessor.idFromName('global'));

      const scheduleResponse = await processorStub.fetch(new Request('https://delayed-processor/schedule', {
        method: 'POST',
        body: JSON.stringify(delayedMessage),
        headers: { 'Content-Type': 'application/json' }
      }));

      expect(scheduleResponse.ok).toBe(true);

      // Simulate countdown starting
      await broadcastService.broadcastDelayedMessageEvent({
        type: 'delayed_message_countdown',
        conversationId: conversationId,
        messageId: delayedMessage.id,
        agentId: agent.userId,
        data: {
          remainingSeconds: 10,
          content: delayedMessage.content
        }
      });

      const countdownStart = await TestAssertions.assertEventReceived(
        agent,
        'delayed_message_countdown',
        2000
      );

      expect(countdownStart.data.remainingSeconds).toBe(10);

      // Phase 2: Customer provides new information that changes context
      console.log('💬 Phase 2: Context change during countdown');

      await customer.sendChatMessage('Actually, I should mention that I\'m a student and budget is very tight right now');

      const contextChangeEvent = await TestAssertions.assertEventReceived(
        agent,
        'message_sent',
        2000
      );

      expect(contextChangeEvent.data.content).toContain('student');

      // Continue countdown
      for (let remaining = 9; remaining > 5; remaining--) {
        await broadcastService.broadcastDelayedMessageEvent({
          type: 'delayed_message_countdown',
          conversationId: conversationId,
          messageId: delayedMessage.id,
          agentId: agent.userId,
          data: {
            remainingSeconds: remaining,
            content: delayedMessage.content
          }
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Phase 3: Agent realizes need to recall
      console.log('🚫 Phase 3: Agent recalls message');

      // Agent attempts recall
      const recallResponse = await processorStub.fetch(new Request('https://delayed-processor/recall', {
        method: 'POST',
        body: JSON.stringify({
          messageId: delayedMessage.id,
          agentId: agent.userId,
          reason: 'Customer revealed budget constraints, recommendation no longer appropriate'
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      expect(recallResponse.ok).toBe(true);

      // Broadcast recall success
      await broadcastService.broadcastDelayedMessageEvent({
        type: 'delayed_message_recalled',
        conversationId: conversationId,
        messageId: delayedMessage.id,
        agentId: agent.userId,
        data: {
          recalledAt: Date.now(),
          remainingTime: 5,
          recallReason: 'Customer revealed budget constraints, recommendation no longer appropriate',
          originalContent: delayedMessage.content
        }
      });

      // All participants should receive recall notification
      const recallEvents = await Promise.all([
        TestAssertions.assertEventReceived(agent, 'delayed_message_recalled'),
        TestAssertions.assertEventReceived(customer, 'delayed_message_recalled'),
        TestAssertions.assertEventReceived(supervisor, 'delayed_message_recalled')
      ]);

      recallEvents.forEach(event => {
        expect(event.data.messageId).toBe(delayedMessage.id);
        expect(event.data.recallReason).toContain('budget constraints');
      });

      // Phase 4: Agent sends appropriate alternative
      console.log('✅ Phase 4: Appropriate follow-up');

      await agent.sendChatMessage('Thanks for sharing that context! Given your student status, let me tell you about our student discount program instead');

      const alternativeEvent = await TestAssertions.assertEventReceived(
        customer,
        'message_sent',
        2000
      );

      expect(alternativeEvent.data.content).toContain('student discount');

      // Customer responds positively
      await customer.sendChatMessage('That sounds much better! Thank you for understanding my situation');

      // Supervisor notes the good customer service
      await supervisor.sendChatMessage('Great job adapting to the customer\'s needs and using the recall feature appropriately');

      console.log('✅ Message recall workflow completed successfully');

      await controller.disconnectAllClients();
    });
  });

  describe('Cross-Conversation User Experience', () => {
    it('should handle agent working across multiple conversations', async () => {
      const sharedAgentId = 'multi_conversation_agent';

      // Create multiple conversations
      const conv1Id = 'conversation_1_cross';
      const conv2Id = 'conversation_2_cross';
      const conv3Id = 'conversation_3_cross';

      const conversations = [conv1Id, conv2Id, conv3Id].map(convId => ({
        id: convId,
        agent: WebSocketTestClientFactory.createClient({
          conversationId: convId,
          role: 'agent',
          userId: sharedAgentId
        }),
        customer: WebSocketTestClientFactory.createClient({
          conversationId: convId,
          role: 'agent', // Simulated customer
          userId: `customer_${convId}`
        }),
        controller: new WebSocketRoomTestController(convId)
      }));

      // Setup all conversations
      for (const conv of conversations) {
        conv.controller.addClient(conv.agent);
        conv.controller.addClient(conv.customer);
        await conv.controller.connectAllClients();
      }

      console.log('🌐 Testing cross-conversation agent experience...');

      // Phase 1: Agent presence across conversations
      console.log('👤 Phase 1: Agent presence updates');

      // Agent goes available
      await broadcastService.broadcastPresenceEvent({
        type: 'agent_available',
        userId: sharedAgentId,
        teamId: 1,
        data: {
          status: 'available',
          capacity: 3,
          activeConversations: conversations.length
        }
      });

      // Agent should receive presence update in all conversations
      // (In real implementation, UserConnection DO would handle this)

      // Phase 2: Concurrent messaging across conversations
      console.log('💬 Phase 2: Concurrent conversation handling');

      // Customers send messages simultaneously
      const customerMessages = await Promise.all(
        conversations.map((conv, index) =>
          conv.customer.sendChatMessage(`Hello from conversation ${index + 1}! I need help.`)
        )
      );

      // Agent should receive all messages
      const receivedMessages = await Promise.all(
        conversations.map(conv =>
          TestAssertions.assertEventReceived(conv.agent, 'message_sent', 3000)
        )
      );

      receivedMessages.forEach((event, index) => {
        expect(event.data.content).toContain(`conversation ${index + 1}`);
      });

      // Agent responds to each conversation
      for (let i = 0; i < conversations.length; i++) {
        const conv = conversations[i];

        // Agent starts typing in this conversation
        await conv.agent.sendTyping(true);

        // Customer should see typing indicator
        const typingEvent = await TestAssertions.assertEventReceived(
          conv.customer,
          'typing_start',
          2000
        );
        expect(typingEvent.userId).toBe(sharedAgentId);

        await conv.agent.sendTyping(false);
        await conv.agent.sendChatMessage(`Hi! I'm Agent Smith helping you in conversation ${i + 1}. How can I assist?`);

        // Customer receives response
        const responseEvent = await TestAssertions.assertEventReceived(
          conv.customer,
          'message_sent',
          2000
        );
        expect(responseEvent.data.content).toContain(`conversation ${i + 1}`);
      }

      // Phase 3: Agent status changes affecting all conversations
      console.log('📊 Phase 3: Status propagation');

      // Agent becomes busy
      await broadcastService.broadcastPresenceEvent({
        type: 'agent_busy',
        userId: sharedAgentId,
        teamId: 1,
        data: {
          status: 'busy',
          reason: 'handling_multiple_conversations',
          estimatedAvailableIn: 300 // 5 minutes
        }
      });

      // All customers should be aware of agent status change
      // (In practice, this would be handled by UserConnection DO)

      // Phase 4: Prioritization and time management
      console.log('⚡ Phase 4: Conversation prioritization');

      // Mark conversation 2 as high priority
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_status_changed',
        conversationId: conv2Id,
        data: {
          oldStatus: 'active',
          newStatus: 'urgent',
          changedBy: sharedAgentId,
          priority: 'high',
          reason: 'Customer escalation'
        }
      });

      // Agent prioritizes urgent conversation
      await conversations[1].agent.sendChatMessage('I see this has been marked as urgent. Let me help you immediately.');

      // Verify urgent message received
      const urgentResponse = await TestAssertions.assertEventReceived(
        conversations[1].customer,
        'message_sent',
        2000
      );
      expect(urgentResponse.data.content).toContain('urgent');

      // Clean up all conversations
      await Promise.all(conversations.map(conv => conv.controller.disconnectAllClients()));

      console.log('✅ Cross-conversation agent experience test completed');
    });

    it('should handle team coordination during complex scenarios', async () => {
      const conversationId = 'team_coordination_e2e';

      // Create team members
      const teamLead = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'team',
        userId: 'team_lead_coordination'
      });

      const seniorAgent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'senior_agent'
      });

      const juniorAgent = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'junior_agent'
      });

      const specialist = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent',
        userId: 'specialist_agent'
      });

      const admin = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'admin',
        userId: 'admin_coordination'
      });

      const customer = WebSocketTestClientFactory.createClient({
        conversationId,
        role: 'agent', // Simulated customer
        userId: 'vip_customer'
      });

      const controller = new WebSocketRoomTestController(conversationId);
      [teamLead, seniorAgent, juniorAgent, specialist, admin, customer].forEach(
        client => controller.addClient(client)
      );

      console.log('👥 Starting team coordination scenario...');

      await controller.connectAllClients();

      // Phase 1: VIP customer with complex issue
      console.log('⭐ Phase 1: VIP customer escalation');

      await customer.sendChatMessage('This is urgent! I\'m a VIP customer and your API integration broke our entire production system!');

      // Junior agent initially assigned
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_assigned',
        conversationId: conversationId,
        data: {
          assignedTo: juniorAgent.userId,
          assignedBy: admin.userId,
          priority: 'high',
          customerType: 'vip'
        }
      });

      // Junior agent realizes need for escalation
      await juniorAgent.sendChatMessage('I understand this is urgent. Let me immediately bring in our senior team to resolve this quickly.');

      // Phase 2: Team lead coordinates response
      console.log('📋 Phase 2: Team lead coordination');

      // Team lead takes control
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_transferred',
        conversationId: conversationId,
        data: {
          fromAgent: juniorAgent.userId,
          toAgent: teamLead.userId,
          transferredBy: teamLead.userId,
          transferReason: 'VIP customer escalation - coordinating team response'
        }
      });

      await teamLead.sendChatMessage('Hello, I\'m the team lead. I\'m coordinating our technical team to resolve your API issue immediately.');

      // Team lead brings in specialist
      await broadcastService.broadcastConversationEvent({
        type: 'participant_joined',
        conversationId: conversationId,
        data: {
          userId: specialist.userId,
          userName: 'API Specialist',
          role: 'specialist',
          joinedAt: Date.now(),
          joinReason: 'Technical expertise required'
        }
      });

      // Phase 3: Coordinated technical response
      console.log('🔧 Phase 3: Technical team response');

      // Multiple team members work simultaneously
      await seniorAgent.sendChatMessage('I\'m reviewing your API logs now to identify the root cause.');

      await specialist.sendChatMessage('I can see the issue - there was a breaking change in our latest API version. Let me prepare the fix.');

      await teamLead.sendChatMessage('We\'ve identified the issue and are implementing a fix. Estimated resolution: 15 minutes.');

      // Schedule status updates
      const statusUpdateMessage: DelayedMessage = {
        id: 'team_status_update',
        conversationId: conversationId,
        agentId: teamLead.userId,
        content: 'Status update: API fix is being deployed now. You should see resolution within 5 minutes.',
        messageType: 'text',
        delaySeconds: 5,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (5 * 1000),
        status: 'scheduled'
      };

      const delayedProcessor = testEnv.getNamespace('DELAYED_MESSAGE_PROCESSOR');
      await delayedProcessor.get(delayedProcessor.idFromName('global')).fetch(
        new Request('https://delayed-processor/schedule', {
          method: 'POST',
          body: JSON.stringify(statusUpdateMessage),
          headers: { 'Content-Type': 'application/json' }
        })
      );

      // Phase 4: Resolution and follow-up coordination
      console.log('✅ Phase 4: Coordinated resolution');

      // Specialist confirms fix
      await specialist.sendChatMessage('Fix deployed! Your API endpoints should be working normally now.');

      // Senior agent provides verification steps
      await seniorAgent.sendChatMessage('Please test your integration now. Here are the specific endpoints to verify...');

      // Customer confirms resolution
      await customer.sendChatMessage('Perfect! Everything is working now. Thank you for the quick coordinated response!');

      // Team lead ensures customer satisfaction
      await teamLead.sendChatMessage('Excellent! I\'m assigning a dedicated account manager to prevent future issues. You\'ll receive their contact information shortly.');

      // Admin documents the incident
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_status_changed',
        conversationId: conversationId,
        data: {
          oldStatus: 'urgent',
          newStatus: 'resolved',
          changedBy: admin.userId,
          resolution: 'VIP customer API issue resolved through coordinated team response',
          resolutionTime: Date.now(),
          teamMembers: [teamLead.userId, seniorAgent.userId, specialist.userId, juniorAgent.userId],
          escalationLevel: 'team_coordination',
          customerSatisfaction: 'high'
        }
      });

      // All team members receive resolution confirmation
      const resolutionEvents = await Promise.all([
        TestAssertions.assertEventReceived(teamLead, 'conversation_status_changed'),
        TestAssertions.assertEventReceived(seniorAgent, 'conversation_status_changed'),
        TestAssertions.assertEventReceived(specialist, 'conversation_status_changed'),
        TestAssertions.assertEventReceived(admin, 'conversation_status_changed')
      ]);

      resolutionEvents.forEach(event => {
        expect(event.data.escalationLevel).toBe('team_coordination');
        expect(event.data.teamMembers).toHaveLength(4);
        expect(event.data.customerSatisfaction).toBe('high');
      });

      console.log('✅ Team coordination scenario completed successfully');

      await controller.disconnectAllClients();
    });
  });
});