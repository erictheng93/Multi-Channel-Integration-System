# Handler Tests

This directory contains comprehensive tests for API handlers in the Multi-Channel Platform MVP system.

## Handlers Tested

### Conversation Handler (`src/handlers/conversation.ts`)
### Message Handler (`src/handlers/message.ts`)

## Conversation Handler Test Files

### 1. `conversation.test.ts`
Core functionality tests covering:
- **List conversations**: Pagination, filtering, permissions
- **Get single conversation**: Retrieval, error handling
- **Assign conversation**: Agent assignment, validation
- **Close conversation**: Status updates, error handling

### 2. `conversation-edge-cases.test.ts`
Edge case and boundary condition tests:
- Invalid input handling
- Null/undefined values
- Empty datasets
- Malformed requests
- Database edge cases

### 3. `conversation-performance.test.ts`
Performance and scalability tests:
- Large dataset handling
- Memory usage optimization
- Concurrent request handling
- Query efficiency
- Response time validation

## Message Handler Test Files

### 1. `message.test.ts`
Core functionality tests covering:
- **List messages**: Pagination, message transformation, chronological ordering
- **Send message**: Text messages, media messages, platform handling
- **Data validation**: Content validation, conversation lookup
- **Error handling**: Database errors, invalid inputs

### 2. `message-edge-cases.test.ts`
Edge case and boundary condition tests:
- Invalid conversation IDs and parameters
- Null/undefined message content
- Large message content handling
- Special characters and Unicode
- Database operation failures
- Platform-specific edge cases

### 3. `message-performance.test.ts`
Performance and scalability tests:
- Large message list handling (1000+ messages)
- Message transformation efficiency
- Concurrent message operations
- Memory usage optimization
- Database query optimization
- UUID generation performance

### 4. `message-integration.test.ts`
Real-world integration scenarios:
- Complete customer service workflows
- Multi-platform message management
- Media message handling
- Long conversation pagination
- Message ordering consistency
- Concurrent agent operations

## Running Tests

### Run All Handler Tests
```bash
# PowerShell - Conversation tests
.\run-conversation-tests.ps1

# PowerShell - Message tests
.\run-message-tests.ps1

# NPM - All handler tests
npm run test:run unit/handlers/*.test.ts

# NPM - Conversation tests only
npm run test:run unit/handlers/conversation*.test.ts

# NPM - Message tests only
npm run test:run unit/handlers/message*.test.ts
```

### Run Individual Test Files
```bash
# Conversation tests
npm run test:run unit/handlers/conversation.test.ts
npm run test:run unit/handlers/conversation-edge-cases.test.ts
npm run test:run unit/handlers/conversation-performance.test.ts
npm run test:run unit/handlers/conversation-integration.test.ts

# Message tests
npm run test:run unit/handlers/message.test.ts
npm run test:run unit/handlers/message-edge-cases.test.ts
npm run test:run unit/handlers/message-performance.test.ts
npm run test:run unit/handlers/message-integration.test.ts
```

### Run with Coverage
```bash
# All handler tests
npm run test:run unit/handlers/*.test.ts --coverage

# Conversation tests only
npm run test:run unit/handlers/conversation*.test.ts --coverage

# Message tests only
npm run test:run unit/handlers/message*.test.ts --coverage
```

### Watch Mode
```bash
# All handler tests
npm run test:watch unit/handlers/*.test.ts

# Conversation tests only
npm run test:watch unit/handlers/conversation*.test.ts

# Message tests only
npm run test:watch unit/handlers/message*.test.ts
```

## Test Coverage Goals

- **Line Coverage**: >90%
- **Function Coverage**: 100%
- **Branch Coverage**: >85%
- **Statement Coverage**: >90%

## Test Structure

Each test file follows this structure:

```typescript
describe('conversationHandler', () => {
 describe('methodName', () => {
 it('should handle normal case', async () => {
 // Test implementation
 })

 it('should handle error case', async () => {
 // Error handling test
 })
 })
})
```

## Mock Data

Tests use standardized mock data from:
- `../../helpers/mockDatabase.ts` - Database mocking utilities
- `../../helpers/testData.ts` - Standard test data sets

## Key Test Scenarios

### Conversation Handler Scenarios

#### List Conversations
- Default pagination (page=1, pageSize=20)
- Custom pagination parameters
- Status filtering
- Permission-based filtering (admin vs agent)
- Unread count calculation
- Empty result sets
- Database errors

### Get Single Conversation
- Valid conversation retrieval
- Conversation not found (404)
- Unread count calculation
- Null timestamp handling
- Database errors

### Assign Conversation
- Assign to specific agent
- Assign to current user (default)
- Invalid agent ID handling
- Missing JWT payload
- Database errors

### Close Conversation
- Successful closure
- Status update verification
- Timestamp updates
- Database errors

### Message Handler Scenarios

#### List Messages
- Default pagination (page=1, pageSize=50)
- Custom pagination parameters
- Message type transformation (customer->user, agent->agent)
- Media type handling (text, image, video, file)
- Chronological ordering (ASC by created_at)
- Sender name resolution (JOIN with customers/users)
- Empty message lists
- Database errors

#### Send Message
- Text message sending
- Media message sending (with URL and type)
- Content validation (content OR media required)
- Conversation lookup and validation
- Platform detection (LINE, Facebook)
- Message UUID generation
- Database transaction handling
- Conversation timestamp updates
- Message status tracking
- Platform-specific sending logic

## Performance Benchmarks

### Conversation Handler Performance
- **List (100 items)**: <100ms
- **Get single**: <50ms
- **Assign**: <50ms
- **Close**: <50ms
- **Memory usage**: <50MB increase for large datasets

### Message Handler Performance
- **List (100 messages)**: <100ms
- **Send message**: <50ms
- **Message transformation (1000 items)**: <200ms
- **Concurrent operations (10 requests)**: <300ms
- **Memory usage**: <100MB increase for large datasets

### Load Testing
- **Concurrent requests**: 10 simultaneous requests <500ms total
- **Large datasets**: 1000 items without memory leaks
- **High pagination**: Page 1000+ should work efficiently

## Error Handling

All handlers should:
- Return consistent error response format
- Log errors appropriately
- Handle database connection failures
- Validate input parameters
- Return appropriate HTTP status codes

## Database Interaction Testing

Tests verify:
- Correct SQL query generation
- Parameter binding
- Result set processing
- Transaction handling
- Connection error recovery

## Security Testing

Tests include:
- Permission validation
- JWT payload verification
- SQL injection prevention
- Input sanitization
- Access control enforcement

## Integration Points

These tests mock:
- Database connections (D1)
- JWT authentication
- HTTP context (Hono)
- Request/response handling

## Maintenance

When updating the conversation handler:
1. Update corresponding tests
2. Add new test cases for new functionality
3. Verify performance benchmarks still pass
4. Update mock data if schema changes
5. Run full test suite before deployment

## Troubleshooting

### Common Issues
- **Mock database not responding**: Check `mockDatabase.ts` setup
- **JWT payload errors**: Verify `testData.ts` JWT payloads
- **Performance test failures**: Check system load during testing
- **Coverage gaps**: Use `--coverage` flag to identify untested code

### Debug Mode
```bash
# Run with debug output
DEBUG=* npm run test:run unit/handlers/conversation.test.ts

# Run single test
npm run test:run unit/handlers/conversation.test.ts -t "should return conversations list"
```