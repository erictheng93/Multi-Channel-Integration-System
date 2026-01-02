# Testing Strategy

## Comprehensive WebSocket Testing Infrastructure

The project features enterprise-grade testing for real-time WebSocket functionality:

### **WebSocket Testing Categories**
- **Unit Tests** (`tests/unit/durable-objects/`) - Individual Durable Objects testing
- **Integration Tests** (`tests/integration/websocket/`) - End-to-end WebSocket flows
- **Performance Tests** (`tests/performance/websocket/`) - 1000+ connection scalability testing
- **Stress Tests** (`tests/stress/websocket/`) - High-load and recovery scenarios
- **End-to-End Tests** (`tests/e2e/websocket/`) - Complete real-time conversation workflows

### **WebSocket Test Infrastructure**
- `tests/helpers/websocket/WebSocketTestClient.ts` - Simulates real WebSocket connections
- `tests/helpers/websocket/DurableObjectsTestEnv.ts` - Mock Durable Objects environment
- `tests/helpers/websocket/TestUtilities.ts` - Load testing and performance helpers
- `tests/helpers/websocket/WebSocketTestSetup.ts` - Global WebSocket test configuration

## Frontend Testing (132+ tests, 100% pass rate)

The project has a robust testing infrastructure:
- **Unit tests** for all components and stores including WebSocket components
- **Integration tests** for API communication and WebSocket connections
- **Real-time functionality tests** for typing indicators, presence, and live updates
- **Edge case testing** for error scenarios and connection failures
- **Performance tests** for optimization validation

Key test helpers:
- `frontend/tests/helpers/directStoreCreation.ts` - Reliable store testing
- `frontend/tests/helpers/testUtils.ts` - Common test utilities
- `frontend/vitest.setup.ts` - Global test configuration

## Backend Testing

- Handler-specific tests in `tests/unit/handlers/` with WebSocket broadcasting validation
  - **Messaging Handler**: 44 unit tests with 66% pass rate (29/44 passing, core functionality 100%)
- API integration tests in `tests/integration/` including real-time event testing
- Database operation tests with mocking
- **Improved Test Architecture**: Database layer mocking approach with proper Drizzle ORM column structure
- **WebSocket Infrastructure Tests** - Complete Durable Objects and broadcasting system testing
- **Load Testing Suite** - Validates 1000+ concurrent connections and message throughput

## Running Tests

### Frontend Tests

```bash
cd frontend

# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test -- unit/components/MyComponent.test.ts

# Interactive test UI
npm run test:ui
```

### Backend Tests

```bash
# Run all handler tests
npm run test:handlers

# Run API integration tests
npm run test:api

# Run file upload end-to-end tests
npm run test:upload

# Run specific test file
npm test tests/unit/handlers/messaging-handler.test.ts
```

## Test Best Practices

1. **Mock External Dependencies**: Always mock D1, KV, R2, and Durable Objects
2. **Use Test Helpers**: Leverage existing helpers for WebSocket and database testing
3. **Test Real-time Features**: Ensure WebSocket events are properly tested
4. **Coverage Goals**: Maintain >80% coverage for critical paths
5. **Performance Testing**: Include load testing for scalability validation

## Related Documentation

- `frontend/vitest.config.ts` - Frontend test configuration
- `tests/helpers/` - Test utility functions and mocking helpers
- `docs/reports/modules/MESSAGING_MODULE_ENHANCEMENT_REPORT.md` - Messaging handler test results
