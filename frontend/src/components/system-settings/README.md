# System Settings Components

This directory contains all reusable components for the System Settings feature, refactored from the monolithic `SystemSettings.vue` component.

## Architecture

This follows the **Controller Pattern + Component Composition** architecture successfully used in the ApiMonitor refactoring.

## Components

### 1. SettingsHeader.vue
**Purpose**: Page header with title, subtitle, and refresh button

**Props**:
- `loading: boolean` - Loading state
- `message: string` - Message to display
- `messageType: MessageType` - Message type (success/error/info)

**Events**:
- `@refresh` - Triggered when refresh button is clicked

### 2. SettingsNav.vue
**Purpose**: Tab navigation for settings sections

**Props**:
- `modelValue: SettingsTab` - Active tab (v-model)
- `tabs: TabConfig[]` - Tab configuration array

**Events**:
- `@update:modelValue` - Tab change event

### 3. GeneralSettingsForm.vue
**Purpose**: General system settings form

**Props**:
- `settings: GeneralSettings` - General settings data
- `saving: boolean` - Save operation status

**Events**:
- `@save` - Save button clicked

### 4. LineIntegrationForm.vue
**Purpose**: LINE integration configuration form

**Props**:
- `settings: LineIntegration` - LINE settings data
- `saving: boolean` - Save operation status
- `testing: boolean` - Test operation status

**Events**:
- `@save` - Save button clicked
- `@test` - Test connection clicked
- `@clear` - Clear credentials clicked

### 5. FacebookIntegrationForm.vue
**Purpose**: Facebook integration configuration form

**Props**:
- `settings: FacebookIntegration` - Facebook settings data
- `saving: boolean` - Save operation status
- `testing: boolean` - Test operation status

**Events**:
- `@save` - Save button clicked
- `@test` - Test connection clicked
- `@clear` - Clear credentials clicked

### 6. AdvancedSettingsForm.vue
**Purpose**: Advanced system configuration form

**Props**:
- `settings: AdvancedSettings` - Advanced settings data
- `saving: boolean` - Save operation status

**Events**:
- `@save` - Save button clicked

### 7. BackupManager.vue
**Purpose**: Database backup and restore management

**Props**:
- `backups: Backup[]` - List of backups
- `processing: boolean` - Processing operation status

**Events**:
- `@backup` - Create backup clicked
- `@restore` - Restore backup clicked (payload: backupId)
- `@backup-credentials` - Backup credentials clicked

### 8. CacheManager.vue
**Purpose**: System maintenance and cache management

**Props**:
- `processing: boolean` - Processing operation status

**Events**:
- `@clear-cache` - Clear cache clicked (payload: CacheType)
- `@health-check` - Health check clicked
- `@restart` - Restart system clicked

## Usage

```vue
<script setup>
import { useSystemSettingsController } from '@/composables/useSystemSettingsController'
import {
  SettingsHeader,
  SettingsNav,
  GeneralSettingsForm,
  // ... other components
} from '@/components/system-settings'

const controller = useSystemSettingsController()
</script>

<template>
  <SettingsHeader
    :loading="controller.loading.value"
    :message="controller.message.value"
    :message-type="controller.messageType.value"
    @refresh="controller.loadSettings"
  />

  <SettingsNav
    v-model="controller.activeTab.value"
    :tabs="controller.tabs.value"
  />

  <!-- Other components... -->
</template>
```

## Design Patterns

- **Props Down, Events Up**: Unidirectional data flow
- **Single Responsibility**: Each component has one clear purpose
- **Composition API**: Vue 3 Composition API with TypeScript
- **Type Safety**: Full TypeScript support with proper types

## Testing

Each component has corresponding unit tests in:
- `frontend/tests/unit/components/system-settings/`

Integration tests are in:
- `frontend/tests/integration/SystemSettings.integration.test.ts`

## Related Files

- **Types**: `frontend/src/types/system-settings.ts`
- **Controller**: `frontend/src/composables/useSystemSettingsController.ts`
- **Main Component**: `frontend/src/views/SystemSettings.refactored.vue`
