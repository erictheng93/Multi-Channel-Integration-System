# API Monitor Unit Tests

This directory contains unit tests for API monitor components and composables.

## Test Structure

```
tests/unit/api-monitor/
├── useApiMonitorController.test.ts    # Controller composable tests
├── ApiHeader.test.ts                  # ApiHeader component tests
├── ApiStatsGrid.test.ts               # ApiStatsGrid component tests
├── ApiFilter.test.ts                  # ApiFilter component tests
├── ApiCard.test.ts                    # ApiCard component tests
├── ApiCardList.test.ts                # ApiCardList component tests
├── ApiModal.test.ts                   # ApiModal component tests
├── MigrationStatus.test.ts            # MigrationStatus component tests
└── ApiEmptyState.test.ts              # ApiEmptyState component tests
```

## Test Coverage Goals

- **Line Coverage**: > 85%
- **Branch Coverage**: > 80%
- **Function Coverage**: > 90%
- **Statement Coverage**: > 85%

## Running Tests

```bash
# Run all API monitor tests
npm run test -- api-monitor

# Run with coverage
npm run test:coverage -- api-monitor

# Run in watch mode
npm run test -- api-monitor --watch

# Run specific test file
npm run test -- useApiMonitorController.test.ts
```

## Test Patterns

### Controller Tests (useApiMonitorController.test.ts)
```typescript
describe('useApiMonitorController', () => {
  it('should initialize with default state', () => { /* ... */ })
  it('should load API status from backend', async () => { /* ... */ })
  it('should filter APIs by status', () => { /* ... */ })
  it('should handle API refresh', async () => { /* ... */ })
  it('should toggle card expansion', () => { /* ... */ })
})
```

### Component Tests
```typescript
describe('ApiHeader', () => {
  it('should render title correctly', () => { /* ... */ })
  it('should emit refresh event on button click', async () => { /* ... */ })
  it('should show loading state', () => { /* ... */ })
})
```

## Integration Tests

Located in `tests/integration/ApiMonitor.integration.test.ts`

Tests full user flows:
- Loading and displaying API status
- Filtering and searching
- Expanding/collapsing cards
- Testing individual APIs
- Viewing statistics details
- Auto-refresh functionality
