# Services Unit Tests /

This directory contains comprehensive unit tests for the service layer of the application.

## Test Structure /

### Permission Service Tests /

- **`permission.test.ts`**: Core permission checking functionality /
- **`permission-edge-cases.test.ts`**: Edge cases and error handling /
- **`permission-performance.test.ts`**: Performance and scalability tests /
- **`permission-integration.test.ts`**: Integration scenarios and workflows /

## Test Coverage /

### Permission Service /

#### Core Functionality /
- Admin role permissions (wildcard access) /
- Manager role permissions with team scope /
- Agent role permissions with assignment restrictions /
- Permission condition checking /
- Role-based access control /

#### Edge Cases /
- Invalid user handling /
- Invalid role handling /
- Database connection failures /
- Malformed input handling /
- Missing context scenarios /
- Complex condition combinations /

#### Performance /
- Response time benchmarks /
- Bulk permission checks /
- Memory usage optimization /
- Database query optimization /
- Scalability testing /
- Concurrent access handling /

#### Integration /
- Real-world workflow scenarios /
- Cross-team permission management /
- Role transition scenarios /
- Complex permission combinations /
- Multi-user concurrent operations /

## Running Tests /

### Individual Test Files /
```bash
# Core permission tests /
npm run test:services:core

# Edge cases /
npm run test:services:edge

# Performance tests /
npm run test:services:performance

# Integration tests /
npm run test:services:integration
```

### All Service Tests /
```bash
# Run all service tests with detailed reporting /
npm run test:services

# Run with coverage /
npm run test:services:coverage

# Run in watch mode /
npm run test:services:watch
```

## Test Patterns /

### Mocking Strategy /
- Database calls are mocked using Vitest / Vitest
- User data is simulated with different roles and teams /
- Error scenarios are simulated for robustness testing /

### Test Data /
```typescript
// Standard test users /
const testUsers = {
 admin: { id: 1, role: 'admin', team_id: 1 },
 manager: { id: 2, role: 'manager', team_id: 1 },
 agent: { id: 3, role: 'agent', team_id: 1 }
};
```

### Assertion Patterns /
- Permission checks return boolean values /
- Performance tests measure execution time /
- Integration tests verify complete workflows /

## Key Test Scenarios /

### Role-Based Permissions /
1. **Admin**: Full access to all resources /
2. **Manager**: Team-scoped permissions /
3. **Agent**: Assignment-based restrictions /

### Condition Checking /
- `teamScope`: User must be in the same team /
- `assigned`: Resource must be assigned to user /
- `own`: User must own the resource /
- `ownTeam`: User must manage their own team /

### Error Handling /
- Database connection failures /
- Invalid user data /
- Malformed permissions /
- Network timeouts /

## Performance Benchmarks /

- Single permission check: < 50ms / < 50
- 100 concurrent checks: < 1000ms / 100< 1000
- Memory usage: < 10MB increase for 1000 operations / 1000 < 10MB

## Migration Status /

 **COMPLETED**: Jest Vitest migration
 **COMPLETED**: All 77 tests migrated and passing
 **COMPLETED**: Performance benchmarks implemented
 **COMPLETED**: PowerShell test runner created

## Future Enhancements /

- [ ] Permission caching implementation /
- [ ] Database integration tests /
- [ ] Real-time permission updates /
- [ ] Audit logging for permission checks /
- [ ] Permission inheritance testing /
- [ ] Coverage reporting setup / 