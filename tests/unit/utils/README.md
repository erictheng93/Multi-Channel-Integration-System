# Unit Tests for Utils

This directory contains comprehensive unit tests for utility functions, focusing on core business logic and security-critical functionality.

## Test Categories Overview

### 🗄️ Database Utils Tests (HIGHEST PRIORITY - Core Business Logic)
Critical tests for database operations that form the backbone of the application.

### 📱 LINE API Integration Tests  
Comprehensive tests for LINE API integration and webhook processing.

## Database Utils Tests (HIGHEST PRIORITY)

### 🔥 `database.test.ts` - Core Business Logic
**Priority: CRITICAL** - Essential CRUD operations that the application depends on:
- Customer management (create, update, retrieve)
- Conversation lifecycle management
- Message persistence and retrieval
- System configuration management
- Analytics and reporting functions

**Status**: ⚠️ Original version needs mock fixes - Use `database-fixed.test.ts` instead

### ⚡ `database-edge-cases.test.ts` - Boundary Conditions
**Priority: CRITICAL** - Edge cases where production bugs typically occur:
- String length limits and Unicode handling
- Numeric boundaries and overflow scenarios
- JSON metadata edge cases
- Concurrent access and race conditions
- Special character and SQL injection prevention

**Status**: ✅ Working correctly with proper mock setup

### 🛡️ `database-error-handling.test.ts` - Error Recovery
**Priority: HIGH** - Robust error handling for production stability:
- Database connection failures
- SQL constraint violations
- Transaction errors and rollbacks
- Resource limit scenarios
- Security and permission errors

**Status**: ⚠️ Original version needs mock fixes - Use `database-error-handling-fixed.test.ts` instead

### 📊 `database-performance.test.ts` - Scalability Testing
**Priority: MEDIUM** - Performance and stress testing:
- Bulk operations (thousands of records)
- Large dataset queries
- Memory optimization
- Concurrent operation handling
- Resource cleanup verification

### 🔧 `database-test-runner.ts` - Test Orchestration
Comprehensive test runner for all database tests with priority ordering.

## LINE API Integration Tests

### Test Files Overview

### 🔐 `line-signature.test.ts` - Security Critical
**Priority: HIGHEST**
- Advanced signature verification testing
- Security edge cases and timing attack prevention
- Crypto API error handling
- Real-world webhook payload scenarios
- Malformed signature handling

### 📤 `line.test.ts` - Core API Functions
**Priority: HIGH**
- Basic LINE API function testing
- Message sending (reply and push)
- User profile retrieval
- Group member profile retrieval
- Network error handling
- API response validation

### 📝 `line-message-formatting.test.ts` - Message Validation
**Priority: HIGH**
- Text message creation and validation
- Sticker message formatting
- Unicode and emoji handling
- Message length constraints
- Real-world message scenarios
- LINE API format compliance

### 🔗 `line-integration.test.ts` - End-to-End Scenarios
**Priority: MEDIUM**
- Complete webhook processing flows
- Customer service conversation patterns
- Concurrent message handling
- Performance and scalability testing
- Production-like integration scenarios

### ⚠️ `line-error-handling.test.ts` - Comprehensive Error Coverage
**Priority: MEDIUM**
- HTTP error status codes (400, 401, 403, 404, 429, 500, 503)
- Network and connection errors
- Malformed response handling
- Edge case error scenarios
- Service degradation handling

### 📊 `line-test-suite.test.ts` - Test Coverage Overview
**Priority: LOW**
- Test suite organization validation
- Coverage area verification
- Best practices compliance
- Production readiness checklist

## Running the Tests

### Database Tests (Run These First!)
```bash
# Run all database tests in priority order
tsx tests/unit/utils/database-test-runner.ts

# Run specific database test file
tsx tests/unit/utils/database-test-runner.ts --file database.test.ts

# Show test categories and information
tsx tests/unit/utils/database-test-runner.ts --info

# Run with vitest directly
npx vitest tests/unit/utils/database*.test.ts

# Run with coverage
npx vitest run tests/unit/utils/database*.test.ts --coverage
```

### LINE API Tests
```bash
# Run all LINE API tests
npm run test:line

# Run with coverage
npm run test:line:coverage

# Watch mode for development
npm run test:line:watch
```

### PowerShell (Windows)
```powershell
# Run comprehensive test suite
.\run-line-tests.ps1
```

### Individual Test Files
```bash
# Run specific test file
npx vitest unit/utils/line-signature.test.ts

# Run with verbose output
npx vitest unit/utils/line.test.ts --reporter=verbose

# Run with coverage for specific file
npx vitest unit/utils/line-integration.test.ts --coverage
```

## Critical Database Test Areas

### 🚨 Why Database Tests Are Highest Priority
Database operations are the foundation of the application. Failures here cause:
- **Data Loss**: Customer messages and conversations lost
- **Service Outages**: Application becomes unusable
- **Data Corruption**: Inconsistent state across tables
- **Security Breaches**: SQL injection and data exposure
- **Performance Degradation**: Slow queries affecting all users

### 🎯 Most Critical Test Scenarios
1. **Boundary Conditions** - Where 90% of production bugs occur:
   - Empty strings, null values, undefined parameters
   - Maximum string lengths (VARCHAR limits)
   - Integer overflow and underflow
   - Unicode characters and emoji handling
   - Special characters that could break SQL

2. **Concurrent Access** - Multi-user scenarios:
   - Race conditions in customer creation
   - Simultaneous message insertion
   - Conversation state conflicts
   - Database deadlocks and timeouts

3. **Error Recovery** - Graceful failure handling:
   - Connection timeouts and network issues
   - Constraint violations (UNIQUE, FOREIGN KEY)
   - Transaction rollbacks and partial failures
   - Resource exhaustion (memory, disk space)

4. **Data Integrity** - Ensuring consistent state:
   - Customer-conversation relationships
   - Message threading and replies
   - JSON metadata validation
   - Timestamp consistency

### 📋 Database Test Coverage Requirements
- **Core CRUD Operations**: 100% coverage (critical path)
- **Error Handling**: 95% coverage (failure scenarios)
- **Edge Cases**: 90% coverage (boundary conditions)
- **Performance**: 80% coverage (scalability scenarios)

## Test Categories

### 🔒 Security Tests
- **Signature Verification**: HMAC-SHA256 validation
- **Timing Attack Prevention**: Consistent execution time
- **Input Validation**: Malformed data handling
- **Crypto API Robustness**: Error scenario coverage

### 🚀 Performance Tests
- **Concurrent Requests**: Multiple simultaneous API calls
- **Large Payloads**: Maximum message size handling
- **Rate Limiting**: 429 error handling and retry logic
- **Memory Usage**: Efficient resource utilization

### 🔧 Integration Tests
- **Webhook Processing**: Complete LINE webhook flow
- **Customer Service**: Real conversation patterns
- **Multi-platform**: Group and individual messaging
- **Error Recovery**: Graceful failure handling

### 📋 Business Logic Tests
- **Message Formatting**: Content validation and encoding
- **API Compliance**: LINE API specification adherence
- **User Experience**: Response time and reliability
- **Data Integrity**: Message delivery confirmation

## Test Data and Mocking

### Mock Configuration
```typescript
const mockConfig = {
  accessToken: 'test-channel-access-token-123',
  channelSecret: 'test-channel-secret-456',
  replyToken: 'reply-token-789',
  userId: 'U1234567890abcdef1234567890abcdef',
  groupId: 'G1234567890abcdef1234567890abcdef'
};
```

### Crypto API Mocking
- Web Crypto API simulation
- HMAC-SHA256 signature generation
- Base64 encoding/decoding
- Error scenario injection

### Network Mocking
- HTTP response simulation
- Error status code testing
- Network timeout scenarios
- Malformed response handling

## Coverage Goals

### Minimum Coverage Targets
- **Line Functions**: 95%+ coverage
- **Error Paths**: 90%+ coverage
- **Edge Cases**: 85%+ coverage
- **Integration Flows**: 80%+ coverage

### Critical Path Coverage
- ✅ Signature verification (100%)
- ✅ Message sending (95%+)
- ✅ Error handling (90%+)
- ✅ API response parsing (95%+)

## Best Practices

### Test Organization
- **Descriptive Names**: Clear test case descriptions
- **Logical Grouping**: Related tests in describe blocks
- **Isolation**: Independent test cases
- **Cleanup**: Proper mock restoration

### Mock Strategy
- **Minimal Mocking**: Only mock external dependencies
- **Realistic Data**: Use production-like test data
- **Error Injection**: Test failure scenarios
- **State Management**: Clean state between tests

### Performance Considerations
- **Fast Execution**: Tests complete quickly
- **Parallel Execution**: Safe concurrent test runs
- **Resource Cleanup**: No memory leaks
- **Deterministic Results**: Consistent test outcomes

## Troubleshooting

### Common Issues

#### Test Failures
```bash
# Clear test cache
npx vitest --run --no-cache

# Run with debug output
DEBUG=* npx vitest unit/utils/line.test.ts
```

#### Coverage Issues
```bash
# Generate detailed coverage report
npx vitest --coverage --coverage.reporter=html

# View coverage in browser
open coverage/index.html
```

#### Mock Problems
```bash
# Reset all mocks
vi.clearAllMocks()

# Restore original implementations
vi.restoreAllMocks()
```

### Debug Tips
1. **Console Output**: Use `console.log` sparingly in tests
2. **Mock Verification**: Check mock call counts and arguments
3. **Async Issues**: Ensure proper `await` usage
4. **Type Errors**: Verify TypeScript compatibility

## Contributing

### Adding New Tests
1. Follow existing file naming conventions
2. Include comprehensive error scenarios
3. Add realistic test data
4. Update this README with new test descriptions

### Test Quality Checklist
- [ ] Descriptive test names
- [ ] Proper error handling
- [ ] Mock cleanup
- [ ] Edge case coverage
- [ ] Performance considerations
- [ ] Documentation updates

## Related Documentation
- [LINE Messaging API Documentation](https://developers.line.biz/en/reference/messaging-api/)
- [Vitest Testing Framework](https://vitest.dev/)
- [Project Testing Guide](../../TESTING_GUIDE.md)
- [LINE Integration Guide](../../../docs/LINE_INTEGRATION.md)
##
# 🔧 Fixed Test Files (Recommended)
**Priority: CRITICAL** - Use these instead of original versions:

#### `database-fixed.test.ts` - Core Business Logic (Fixed)
✅ **Fully working** - Comprehensive mock setup for all database operations:
- Proper `mockDb.prepare` implementation pattern
- Handles multiple query scenarios correctly
- Fixed type issues (`null` → `undefined`)
- Covers all core CRUD operations

#### `database-error-handling-fixed.test.ts` - Error Recovery (Fixed)
✅ **Fully working** - Complete error scenario coverage:
- Database connection errors
- SQL constraint violations
- Transaction rollback scenarios
- Resource exhaustion handling
- Network and timeout issues

#### `database-performance-fixed.test.ts` - Performance Testing (Fixed)
✅ **Fully working** - Scalability and performance validation:
- Bulk operations testing
- Concurrent access scenarios
- Memory usage optimization
- Large dataset handling

### Mock Pattern Used in Fixed Files
```typescript
// Correct mock pattern used in all fixed files
mockDb.prepare = vi.fn().mockImplementation((query: string) => {
  if (query.includes('SELECT * FROM customers')) {
    return {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(mockData)
    }
  } else if (query.includes('INSERT INTO customers')) {
    return {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true })
    }
  }
  // Default fallback
  return {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] })
  }
})
```

This pattern ensures:
- ✅ Complete method coverage (`bind`, `first`, `run`, `all`)
- ✅ Proper chaining with `mockReturnThis()`
- ✅ Query-specific responses
- ✅ Fallback for unmatched queries
- ✅ Consistent async behavior