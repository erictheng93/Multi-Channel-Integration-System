# API Monitor Integration Tests

This directory contains integration tests for the API monitor feature.

## Test Files

```
tests/integration/api-monitor/
└── ApiMonitor.integration.test.ts     # Full feature integration tests
```

## What Integration Tests Cover

Integration tests verify that all components work together correctly:

1. **Data Flow**: Controller → Components → User Interaction
2. **API Integration**: Real API calls (mocked with MSW)
3. **State Management**: Cross-component state updates
4. **User Workflows**: Complete user journeys

## Test Scenarios

### 1. Initial Load and Display
```typescript
it('should load and display API status on mount', async () => {
  // Tests:
  // - Controller initialization
  // - API status fetch
  // - Component rendering with data
  // - Statistics calculation
})
```

### 2. Filtering Workflow
```typescript
it('should filter APIs by status, category, and search', async () => {
  // Tests:
  // - Filter interaction
  // - Filtered results display
  // - Empty state when no results
  // - Filter combinations
})
```

### 3. Card Expansion
```typescript
it('should expand and collapse API cards', async () => {
  // Tests:
  // - Click to expand
  // - Details display
  // - Click to collapse
  // - Only one card expanded at a time
})
```

### 4. API Testing
```typescript
it('should test individual APIs and update status', async () => {
  // Tests:
  // - Test button click
  // - API call execution
  // - Status update
  // - Success/error handling
})
```

### 5. Statistics Modal
```typescript
it('should open statistics detail modal', async () => {
  // Tests:
  // - Stat card click
  // - Modal opens with correct data
  // - Modal close
  // - Different stat types
})
```

### 6. Auto-Refresh
```typescript
it('should auto-refresh API status every 15 seconds', async () => {
  // Tests:
  // - Auto-refresh toggle
  // - Periodic refresh
  // - Manual refresh
  // - Cleanup on unmount
})
```

### 7. Error Handling
```typescript
it('should handle API errors gracefully', async () => {
  // Tests:
  // - Network errors
  // - API failures
  // - Error display
  // - Retry functionality
})
```

### 8. Migration Status
```typescript
it('should display WebSocket migration status', async () => {
  // Tests:
  // - Migration status fetch
  // - Progress bar display
  // - Status indicators
  // - Real-time updates
})
```

## Running Integration Tests

```bash
# Run all integration tests
npm run test -- integration/api-monitor

# Run with coverage
npm run test:coverage -- integration

# Run in watch mode
npm run test -- integration/api-monitor --watch
```

## Mocking Strategy

### API Mocking with MSW (Mock Service Worker)
```typescript
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const handlers = [
  http.get('/api/system/api-status', () => {
    return HttpResponse.json({
      success: true,
      data: { endpoints: [...] }
    })
  }),
  http.get('/api/websocket/migration-status', () => {
    return HttpResponse.json({
      rolloutPercentage: 100,
      websocketEnabled: true
    })
  })
]

const server = setupServer(...handlers)
```

## Performance Testing

Integration tests also verify:
- Initial render time < 1s
- Filter response time < 100ms
- No memory leaks
- Efficient re-renders

## Debugging

```bash
# Run with debug output
npm run test -- integration/api-monitor --reporter=verbose

# Run in UI mode
npm run test:ui
```
