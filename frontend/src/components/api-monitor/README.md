# API Monitor Components

This directory contains all components related to the API monitoring dashboard.

## Component Architecture

```
ApiMonitor.vue (Parent Container)
├── ApiHeader.vue # Page header with title and refresh button
├── MigrationStatus.vue # WebSocket migration status card
├── ApiStatsGrid.vue # Statistics overview (4 stat cards)
│ └── StatCard (internal) # Individual stat card
├── ApiFilter.vue # Filter controls (status, category, search)
├── ApiCardList.vue # API endpoint cards container
│ └── ApiCard.vue # Individual API endpoint card
├── ApiModal.vue # Statistics detail modal
└── ApiEmptyState.vue # Empty state component
```

## Component Responsibilities

### ApiHeader.vue
- **Purpose**: Display page title and action buttons
- **Props**: `loading: boolean`
- **Events**: `@refresh` - Triggered when refresh button is clicked
- **Size**: ~80 lines

### MigrationStatus.vue
- **Purpose**: Show WebSocket migration progress and status
- **Props**: `status: MigrationStatus`
- **Events**: None (display only)
- **Size**: ~120 lines

### ApiStatsGrid.vue
- **Purpose**: Display 4 statistics cards (healthy, warning, error, total)
- **Props**: `stats: ApiStatistics`
- **Events**: `@stat-click(type: string)` - Clicked on a stat card
- **Size**: ~120 lines

### ApiFilter.vue
- **Purpose**: Filter controls for status, category, and search
- **Props**: `modelValue: FilterState`
- **Events**: `@update:modelValue` - Filter changes
- **Size**: ~100 lines

### ApiCardList.vue
- **Purpose**: Container for API endpoint cards with virtualization support
- **Props**: `apis: ApiEndpoint[]`, `expandedCard: string | null`
- **Events**: `@card-click(id: string)` - Card expand/collapse
- **Size**: ~200 lines

### ApiCard.vue
- **Purpose**: Individual API endpoint card with expand/collapse
- **Props**: `api: ApiEndpoint`, `expanded: boolean`
- **Events**:
  - `@toggle` - Toggle expand/collapse
  - `@test` - Test API
  - `@view-logs` - View logs
  - `@view-docs` - View documentation
- **Size**: ~150 lines

### ApiModal.vue
- **Purpose**: Modal dialog for detailed statistics view
- **Props**: `modalState: ModalState`
- **Events**: `@close` - Close modal
- **Size**: ~180 lines

### ApiEmptyState.vue
- **Purpose**: Empty state when no APIs match filters
- **Props**: `message?: string`
- **Events**: None
- **Size**: ~50 lines

## Usage Example

```vue
<script setup>
import { useApiMonitorController } from '@/composables/useApiMonitorController'
import {
  ApiHeader,
  ApiStatsGrid,
  ApiFilter,
  ApiCardList,
  ApiModal,
  MigrationStatus
} from '@/components/api-monitor'

const controller = useApiMonitorController()
</script>

<template>
  <AppLayout>
    <ApiHeader
      :loading="controller.isRefreshing"
      @refresh="controller.refreshAll"
    />

    <MigrationStatus :status="controller.migrationStatus" />

    <ApiStatsGrid
      :stats="controller.stats"
      @stat-click="controller.showStatDetails"
    />

    <ApiFilter v-model="controller.filters" />

    <ApiCardList
      :apis="controller.filteredApis"
      :expanded-card="controller.expandedCard"
      @card-click="controller.toggleCard"
      @test="controller.testApi"
    />

    <ApiModal
      v-if="controller.modal.show"
      :modal-state="controller.modal"
      @close="controller.closeModal"
    />
  </AppLayout>
</template>
```

## Design Principles

1. **Single Responsibility**: Each component has one clear purpose
2. **Props Down, Events Up**: Follow Vue's unidirectional data flow
3. **Composition over Inheritance**: Use composables for shared logic
4. **Type Safety**: All props and events are fully typed
5. **Accessibility**: ARIA labels and keyboard navigation support
6. **Performance**: Virtual scrolling for large lists

## Testing

Each component should have:
- Unit tests for rendering and props
- Event emission tests
- Edge case tests
- Accessibility tests

Test files are located in:
- `frontend/tests/unit/components/api-monitor/`
