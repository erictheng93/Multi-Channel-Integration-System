# Composables Unit Tests /

This directory contains comprehensive unit tests for Vue 3 composables and Pinia stores used in the frontend application.

## Test Structure /

### Core Composables /

- **`useError.test.ts`**: Error handling composable tests /
- **`useAuthStore.test.ts`**: Authentication store tests /
- **`useConversationsStore.test.ts`**: Conversations store tests /

### Advanced Test Suites /

- **`composables-edge-cases.test.ts`**: Edge cases and error scenarios /
- **`composables-performance.test.ts`**: Performance and scalability tests /
- **`composables-integration.test.ts`**: Integration workflows and cross-composable interactions /

## Test Coverage /

### useError Composable / useError
- Initial state management /
- Error handling from different sources /
- Loading state management /
- Async operation wrapping /
- Error clearing functionality /
- Reactive behavior /
- Edge cases (circular references, large objects) /

### useAuthStore (Pinia Store) / useAuthStore (Pinia )
- Initial state and localStorage integration /
- Login/logout functionality / /
- Token management /
- User profile fetching /
- Computed properties (isAuthenticated, isAdmin) /
- Error handling and network failures /
- Router integration /
- Concurrent operations /

### useConversationsStore (Pinia Store) / useConversationsStore (Pinia )
- Conversation fetching and filtering /
- Message management /
- Conversation assignment /
- Mock data fallback in development /
- Loading state management /
- Error handling and recovery /
- Large dataset handling /

## Running Tests /

### Individual Test Files /
```bash
# Core useError tests / useError
npm test tests/unit/composables/useError.test.ts

# Auth store tests /
npm test tests/unit/composables/useAuthStore.test.ts

# Conversations store tests /
npm test tests/unit/composables/useConversationsStore.test.ts

# Edge cases /
npm test tests/unit/composables/composables-edge-cases.test.ts

# Performance tests /
npm test tests/unit/composables/composables-performance.test.ts

# Integration tests /
npm test tests/unit/composables/composables-integration.test.ts
```

### All Composable Tests /
```bash
npm test tests/unit/composables/
```

## Test Patterns /

### Mocking Strategy /
- **API Mocking**: All API calls are mocked using Vitest / API Vitest
- **Router Mocking**: Vue Router is mocked for navigation testing / Vue Router
- **LocalStorage Mocking**: Browser localStorage is mocked /
- **Pinia Integration**: Fresh Pinia instances for each test / Pinia

### Test Data Patterns /
```typescript
// Standard test user /
const mockAgent = {
 id: 1,
 username: 'testuser',
 role: 'agent',
 name: '',
 email: 'test@example.com',
 team_id: 1,
 created_at: '2024-01-01T00:00:00Z',
 updated_at: '2024-01-01T00:00:00Z'
}

// Standard conversation /
const mockConversation = {
 id: '1',
 customer_id: '1',
 platform: 'line' as const,
 status: 'pending' as const,
 assigned_agent_id: null,
 created_at: '2024-01-01T00:00:00Z',
 updated_at: '2024-01-01T00:00:00Z',
 last_message_at: '2024-01-01T00:00:00Z'
}
```

### Assertion Patterns /
- **State Verification**: Check reactive state changes /
- **API Call Verification**: Verify correct API calls with parameters / API
- **Error State Testing**: Validate error handling and recovery /
- **Performance Benchmarks**: Measure execution time for operations /

## Key Test Scenarios /

### Authentication Workflows /
1. **Successful Login**: Token storage, user data, API header setup / API
2. **Login Failure**: Error handling, state cleanup /
3. **Token Expiration**: Automatic logout, redirect to login /
4. **Logout Process**: State cleanup, localStorage clearing /

### Conversation Management /
1. **Data Fetching**: API calls, loading states, error handling / API
2. **Filtering**: Status and platform-based filtering /
3. **Message Operations**: Sending, receiving, state updates /
4. **Assignment**: Conversation assignment to agents /

### Error Handling /
1. **Network Errors**: Connection failures, timeouts /
2. **API Errors**: Server errors, validation failures / API
3. **State Recovery**: Error clearing, retry mechanisms /
4. **User Feedback**: Error message display /

## Performance Benchmarks /

- **Single Operation**: < 50ms for basic operations / < 50
- **Bulk Operations**: < 2000ms for 100 concurrent operations / 100 < 2000
- **Large Datasets**: Handle 10,000+ items efficiently / 10,000+
- **Memory Usage**: Minimal memory leaks in repeated operations /

## Edge Cases Covered /

### Data Integrity /
- Malformed API responses / API
- Null/undefined values / /
- Type mismatches /
- Circular references /

### Concurrency /
- Simultaneous operations /
- Race conditions /
- State consistency /
- Resource conflicts /

### Browser Environment /
- localStorage quota exceeded / localStorage
- Network interruptions /
- Tab switching /
- Memory pressure /

## Integration Scenarios /

### Cross-Store Communication /
- Auth state affecting conversation access /
- Error propagation between stores /
- Shared loading states /

### Real-world Workflows /
- Complete user session lifecycle /
- Multi-step operations with error recovery /
- Role-based access control /

## Future Enhancements /

- [ ] WebSocket integration testing / WebSocket
- [ ] Offline mode testing /
- [ ] Real-time updates testing /
- [ ] Component integration testing /
- [ ] E2E workflow testing / 