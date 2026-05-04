# WebSocket + Durable Objects Testing Guide

This comprehensive guide covers the testing infrastructure for the WebSocket + Durable Objects architecture in the Multi-Channel Customer Support System.

## Overview

The testing infrastructure provides complete coverage for:
- **Unit Tests**: Individual Durable Objects and services
- **Integration Tests**: End-to-end WebSocket flows
- **Performance Tests**: Scalability and throughput validation
- **E2E Tests**: Real-world conversation scenarios
- **Stress Tests**: High-load and failure scenarios

## Test Structure

```
tests/
 helpers/websocket/ # Test utilities and helpers
 websocket-test-client.ts # WebSocket client simulator
 durable-objects-test-env.ts # Mock DO environment
 websocket-test-utils.ts # Testing utilities
 websocket-test-setup.ts # Global test setup
 global-test-setup.ts # Environment configuration
 unit/durable-objects/ # Unit tests for Durable Objects
 ConversationRoom.test.ts # ConversationRoom DO tests
 MessageBroadcaster.test.ts # MessageBroadcaster DO tests
 DelayedMessageProcessor.test.ts # DelayedMessageProcessor DO tests
 integration/websocket/ # Integration tests
 websocket-connection-lifecycle.test.ts
 real-time-message-broadcasting.test.ts
 performance/websocket/ # Performance tests
 connection-scalability.test.ts
 message-broadcasting-performance.test.ts
 e2e/websocket/ # End-to-end tests
 real-time-conversation-flow.test.ts
 stress/websocket/ # Stress tests
 high-load-scenarios.test.ts
```

## Running Tests

### All WebSocket Tests
```bash
bun run test:websocket
```

### Specific Test Categories
```bash
# Unit tests only
bun run test:websocket:unit

# Integration tests
bun run test:websocket:integration

# Performance tests
bun run test:websocket:performance

# E2E tests
bun run test:websocket:e2e

# Stress tests (requires special environment)
bun run test:websocket:stress
```

### Performance Testing Mode
```bash
# Run with detailed performance monitoring
PERFORMANCE_TEST_MODE=benchmark bun run test:websocket:performance

# Enable stress testing
STRESS_TEST_ENABLED=true bun run test:websocket:stress
```

## Test Utilities

### WebSocket Test Client

The `WebSocketTestClient` simulates real WebSocket connections:

```typescript
import { WebSocketTestClientFactory } from '@tests/helpers/websocket/websocket-test-client';

// Create a test client
const client = WebSocketTestClientFactory.createClient({
 conversationId: 'test_conversation',
 role: 'agent',
 userId: 'test_user'
});

// Connect and send messages
await client.connect();
await client.sendChatMessage('Hello, World!');
await client.sendTyping(true);

// Wait for events
const messageEvent = await client.waitForEvent('message_sent', 5000);
```

### Room Test Controller

Manage multiple clients in a conversation:

```typescript
import { WebSocketRoomTestController } from '@tests/helpers/websocket/websocket-test-client';

const controller = new WebSocketRoomTestController('conversation_id');

// Add clients
const clients = WebSocketTestClientFactory.createClients(5, {
 conversationId: 'conversation_id',
 role: 'agent'
});

clients.forEach(client => controller.addClient(client));

// Connect all at once
await controller.connectAllClients();

// Get room statistics
const stats = controller.getRoomStats();
```

### Test Assertions

Use specialized assertions for WebSocket testing:

```typescript
import { TestAssertions } from '@tests/helpers/websocket/websocket-test-utils';

// Assert message received
await TestAssertions.assertMessageReceived(client, 'message_sent', 2000);

// Assert event received
await TestAssertions.assertEventReceived(client, 'typing_start', 1000);

// Assert all clients received event
await TestAssertions.assertAllClientsReceivedEvent(controller, 'conversation_assigned');

// Assert performance metrics
TestAssertions.assertPerformanceMetrics(metrics, {
 maxAverage: 500,
 maxP95: 1000
});
```

## Testing Scenarios

### Unit Testing Durable Objects

```typescript
describe('ConversationRoom Durable Object', () => {
 let conversationRoom: ConversationRoom;
 let mockState: MockDurableObjectState;
 let mockEnv: any;

 beforeEach(() => {
 testEnv.reset();
 // Setup mock environment
 mockEnv = { /* mock bindings */ };
 mockState = new MockDurableObjectState(id);
 conversationRoom = new ConversationRoom(mockState, mockEnv);
 });

 it('should handle WebSocket connections', async () => {
 // Test WebSocket upgrade and connection management
 });

 it('should broadcast messages to participants', async () => {
 // Test message broadcasting logic
 });
});
```

### Integration Testing

```typescript
describe('WebSocket Connection Lifecycle', () => {
 it('should establish connections and handle real-time events', async () => {
 const client = WebSocketTestClientFactory.createClient({
 conversationId: 'integration_test',
 role: 'agent'
 });

 await client.connect();

 // Test real broadcasting
 await broadcastService.broadcastMessageEvent({
 type: 'message_sent',
 conversationId: 'integration_test',
 messageId: 'test_msg',
 userId: 'test_user',
 data: { content: 'Integration test message' }
 });

 const event = await TestAssertions.assertEventReceived(
 client,
 'message_sent',
 2000
 );

 expect(event.data.content).toBe('Integration test message');
 });
});
```

### Performance Testing

```typescript
describe('Connection Scalability', () => {
 it('should handle 100 concurrent connections', async () => {
 const connectionCount = 100;
 const clients = LoadTestHelper.createLoadTestClients(
 connectionCount,
 'perf_test_conversation',
 'agent'
 );

 const startTime = Date.now();

 // Connect in batches
 await LoadTestHelper.connectInBatches(clients, 10, 100);

 const connectionTime = Date.now() - startTime;
 const connectionRate = connectionCount / (connectionTime / 1000);

 expect(connectionRate).toBeGreaterThan(5); // > 5 connections/sec
 expect(connectionTime).toBeLessThan(20000); // < 20 seconds
 });
});
```

### E2E Testing

```typescript
describe('Complete Conversation Flow', () => {
 it('should handle full customer conversation lifecycle', async () => {
 // Create participants
 const customer = WebSocketTestClientFactory.createClient({
 conversationId: 'e2e_conversation',
 role: 'agent',
 userId: 'customer_123'
 });

 const agent = WebSocketTestClientFactory.createClient({
 conversationId: 'e2e_conversation',
 role: 'agent',
 userId: 'agent_456'
 });

 // Test complete workflow
 await controller.connectAllClients();

 // Customer sends message
 await customer.sendChatMessage('I need help');

 // Agent receives and responds
 const customerMessage = await TestAssertions.assertEventReceived(
 agent,
 'message_sent'
 );

 await agent.sendChatMessage('How can I help you?');

 // Continue conversation flow...
 });
});
```

## Performance Benchmarks

### Expected Performance Metrics

| Metric | Baseline | Good | Excellent |
|--------|----------|------|-----------|
| Connection Rate | >5/sec | >10/sec | >20/sec |
| Message Latency (P95) | <2000ms | <1000ms | <500ms |
| Throughput | >10 msg/sec | >25 msg/sec | >50 msg/sec |
| Memory per Connection | <1MB | <500KB | <200KB |
| Concurrent Connections | >100 | >500 | >1000 |

### Load Testing Guidelines

1. **Connection Tests**: Test up to 1000 concurrent connections
2. **Message Tests**: Sustain 50+ messages/second for 30+ seconds
3. **Memory Tests**: Monitor memory growth over extended periods
4. **Stress Tests**: Push system to failure point and measure recovery

## Test Configuration

### Environment Variables

```bash
# Test mode configuration
NODE_ENV=test
TEST_MODE=websocket
WEBSOCKET_TEST_TIMEOUT=120000

# Performance testing
PERFORMANCE_TEST_MODE=benchmark # normal|benchmark
MEMORY_MONITORING=true
TEST_PARALLEL=false

# Stress testing
STRESS_TEST_ENABLED=true
```

### Vitest Configuration

The WebSocket tests use a specialized Vitest configuration:

```typescript
// tests/websocket.vitest.config.ts
export default defineConfig({
 test: {
 include: ['tests/**/*websocket*/**/*.test.ts'],
 testTimeout: 120000,
 threads: false,
 maxConcurrency: 1,
 // ... detailed configuration
 }
});
```

## Debugging Tests

### Debug Mode

```bash
# Run with detailed logging
NODE_ENV=development bun run test:websocket

# Run specific test with debugging
bunx vitest run tests/unit/durable-objects/ConversationRoom.test.ts --reporter=verbose
```

### Memory Debugging

```bash
# Enable garbage collection for memory tests
node --expose-gc node_modules/.bin/vitest run tests/performance/websocket/
```

### Performance Profiling

```bash
# Run with performance profiling
PERFORMANCE_TEST_MODE=benchmark bun run test:websocket:performance
```

## CI/CD Integration

### GitHub Actions Configuration

```yaml
- name: Run WebSocket Tests
 run: |
 bun run test:websocket:unit
 bun run test:websocket:integration

- name: Performance Tests (on main branch)
 if: github.ref == 'refs/heads/main'
 run: |
 PERFORMANCE_TEST_MODE=benchmark bun run test:websocket:performance

- name: Upload Test Results
 uses: actions/upload-artifact@v3
 with:
 name: websocket-test-results
 path: test-results/
```

## Best Practices

### Writing WebSocket Tests

1. **Use Realistic Scenarios**: Model tests on actual user behavior
2. **Test Error Conditions**: Include network failures, timeouts, and edge cases
3. **Verify Cleanup**: Ensure resources are properly released
4. **Measure Performance**: Include timing assertions for critical paths
5. **Test Concurrency**: Verify thread safety and race conditions

### Performance Testing

1. **Baseline First**: Establish performance baselines before optimization
2. **Consistent Environment**: Use same hardware/environment for comparisons
3. **Multiple Runs**: Average results across multiple test runs
4. **Monitor Resources**: Track CPU, memory, and network usage
5. **Document Degradation**: Record when and why performance degrades

### Stress Testing

1. **Gradual Increase**: Ramp up load gradually to find breaking points
2. **Recovery Testing**: Verify system recovers after overload
3. **Resource Limits**: Test behavior at memory and connection limits
4. **Failure Modes**: Test various failure scenarios and recovery
5. **Production Simulation**: Use realistic production-like conditions

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase timeout for slow environments
2. **Memory Leaks**: Use garbage collection and memory monitoring
3. **Flaky Tests**: Add retries for network-dependent tests
4. **Connection Limits**: Adjust system limits for high-connection tests
5. **Resource Cleanup**: Ensure proper cleanup in test teardown

### Performance Issues

1. **Slow Tests**: Profile and optimize test setup/teardown
2. **Memory Growth**: Check for leaked test resources
3. **CPU Usage**: Monitor test parallelization settings
4. **Network Simulation**: Ensure realistic network conditions

## Contributing

When adding new WebSocket tests:

1. Follow the existing test structure and naming conventions
2. Include both positive and negative test cases
3. Add performance benchmarks for new features
4. Update this documentation for new test utilities
5. Ensure tests pass in CI environment

For questions or issues with the testing infrastructure, refer to the project's main documentation or create an issue in the repository.