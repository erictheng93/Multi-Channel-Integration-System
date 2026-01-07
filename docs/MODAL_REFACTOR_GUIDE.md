# Modal Component Refactoring Guide

## Overview
This guide documents the refactoring of all custom Modal implementations to use the base `Modal.vue` component. This ensures consistency, reduces code duplication, and provides built-in features like ESC key handling and click-outside-to-close.

## Base Modal Component API

**Location:** `frontend/src/components/ui/Modal.vue`

### Props
```typescript
interface Props {
  show: boolean              // Controls visibility (use with v-model)
  title?: string            // Modal title (optional if using header slot)
  size?: 'sm' | 'md' | 'lg' | 'xl'  // Modal size (default: 'md')
  fullscreen?: boolean      // Fullscreen mode (default: false)
  closeOnOverlay?: boolean  // Close when clicking overlay (default: true)
  showHeader?: boolean      // Show header section (default: true)
  showCloseButton?: boolean // Show X close button (default: true)
  noPadding?: boolean       // Remove body padding (default: false)
  closeButtonLabel?: string // Accessibility label (default: '關閉')
}
```

### Emits
```typescript
interface Emits {
  (e: 'close'): void                // Emitted when modal closes
  (e: 'update:show', value: boolean): void  // For v-model support
}
```

### Slots
- `header` - Custom header content (overrides title prop)
- `default` - Main body content
- `footer` - Footer content (buttons, actions)

### Built-in Features
✅ ESC key handling (properly managed lifecycle)
✅ Click outside to close (configurable)
✅ Scroll lock when open
✅ Teleport to body
✅ Responsive design
✅ Smooth animations
✅ z-index: 10000 (highest priority)

## Refactoring Pattern

### Before (Custom Modal)
```vue
<template>
  <div v-if="visible" class="modal-overlay">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h2>Modal Title</h2>
        <button class="close-btn" @click="handleClose">&times;</button>
      </div>
      <div class="modal-body">
        <!-- Content here -->
      </div>
      <div class="modal-actions">
        <button @click="handleClose">Cancel</button>
        <button @click="handleSubmit">Submit</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean
  // other props
}

const emit = defineEmits<{
  (_e: 'close'): void
  (_e: 'submit'): void
}>()

function handleClose() {
  emit('close')
}
</script>

<style scoped>
.modal-overlay { /* 50+ lines of duplicate styles */ }
.modal { /* ... */ }
.modal-header { /* ... */ }
.close-btn { /* ... */ }
.modal-body { /* ... */ }
.modal-actions { /* ... */ }
</style>
```

### After (Using Base Modal)
```vue
<template>
  <Modal
    :show="visible"
    title="Modal Title"
    size="md"
    @close="handleClose"
  >
    <!-- Body content in default slot -->
    <template #default>
      <!-- Content here -->
    </template>

    <!-- Footer in footer slot -->
    <template #footer>
      <button class="btn btn-secondary" @click="handleClose">
        Cancel
      </button>
      <button class="btn btn-primary" @click="handleSubmit">
        Submit
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Modal from '@/components/ui/Modal.vue'

interface Props {
  visible: boolean
  // other props
}

const emit = defineEmits<{
  (_e: 'close'): void
  (_e: 'submit'): void
}>()

function handleClose() {
  emit('close')
}
</script>

<style scoped>
/* Only keep form-specific styles */
.form-group { /* ... */ }
.btn { /* ... */ }
/* Remove all modal-overlay, modal-container, modal-header styles */
</style>
```

## Step-by-Step Refactoring Process

### 1. Import Base Modal
```typescript
import Modal from '@/components/ui/Modal.vue'
```

### 2. Replace Template Structure
- Remove `<div v-if="visible" class="modal-overlay">`
- Replace with `<Modal :show="visible" @close="handleClose">`
- Move title to `title` prop or `header` slot
- Move body content to default slot
- Move footer to `footer` slot

### 3. Update Props Mapping
- `visible` → `show` (or keep `visible` and map it)
- Add `size` prop if needed ('sm', 'md', 'lg', 'xl')
- Add `closeOnOverlay` if custom behavior needed

### 4. Keep Business Logic
- Keep all `emit()` calls
- Keep all form handling logic
- Keep all computed properties
- Keep all methods

### 5. Clean Up Styles
**Remove these (handled by base Modal):**
- `.modal-overlay`
- `.modal`, `.modal-container`
- `.modal-header`
- `.close-btn`, `.modal-close`
- `.modal-body` (unless custom padding needed)
- `.modal-actions`, `.modal-footer`

**Keep these (component-specific):**
- `.form-group`, `.form-label`, `.form-input`
- `.btn`, `.btn-primary`, `.btn-secondary`
- Custom content styles (member lists, avatars, etc.)

### 6. Test Checklist
- [ ] Modal opens correctly
- [ ] Modal closes with X button
- [ ] Modal closes with ESC key ✨ NEW
- [ ] Modal closes when clicking overlay
- [ ] Modal doesn't close when clicking content
- [ ] Scroll is locked when modal open
- [ ] All form functionality works
- [ ] All buttons emit correct events
- [ ] Responsive design works on mobile

## Size Guidelines

| Size | Max Width | Use Case |
|------|-----------|----------|
| `sm` | 400px | Simple confirmations, alerts |
| `md` | 600px | Standard forms (default) |
| `lg` | 800px | Forms with multiple sections |
| `xl` | 1200px | Complex data tables, multi-column |

## Common Patterns

### Simple Confirmation Modal
```vue
<Modal
  :show="visible"
  title="Confirm Action"
  size="sm"
  @close="handleClose"
>
  <p>Are you sure you want to proceed?</p>

  <template #footer>
    <button class="btn btn-secondary" @click="handleClose">Cancel</button>
    <button class="btn btn-danger" @click="handleConfirm">Confirm</button>
  </template>
</Modal>
```

### Form Modal with Validation
```vue
<Modal
  :show="visible"
  title="Add Member"
  size="md"
  @close="handleClose"
>
  <form @submit.prevent="handleSubmit">
    <div class="form-group">
      <label>Name *</label>
      <input v-model="form.name" required />
    </div>
    <!-- more fields -->
  </form>

  <template #footer>
    <button class="btn btn-secondary" @click="handleClose">Cancel</button>
    <button class="btn btn-primary" @click="handleSubmit" :disabled="loading">
      {{ loading ? 'Saving...' : 'Save' }}
    </button>
  </template>
</Modal>
```

### Modal with Custom Header
```vue
<Modal
  :show="visible"
  size="lg"
  @close="handleClose"
>
  <template #header>
    <div class="custom-header">
      <h2>Custom Title with Icon</h2>
      <span class="badge">New</span>
    </div>
  </template>

  <!-- content -->
</Modal>
```

## Migration Status

### Completed ✅
1. `frontend/src/components/customerTags/TagFormModal.vue` - ESC key fix only

### Pending ⏳
1. `frontend/src/components/team/AddMemberModal.vue` - 188 lines
2. `frontend/src/components/team/AddTeamModal.vue` - 475 lines
3. `frontend/src/components/team/EditTeamModal.vue`
4. `frontend/src/components/team/PasswordResetModal.vue`
5. `frontend/src/components/team/QRCodeModal.vue`
6. `frontend/src/components/customerTags/BulkDeleteModal.vue`
7. `frontend/src/components/customerTags/DeleteConfirmModal.vue`
8. `frontend/src/components/customer/TagStatsModal.vue`
9. `frontend/src/components/notification/NotificationSettingsModal.vue`
10. `frontend/src/components/ui/AccountDisabledModal.vue`

## Benefits

### Code Reduction
- **Estimated reduction**: 150-200 lines per modal
- **Total savings**: ~1,500-2,000 lines across 10 modals

### Consistency
- Unified z-index management (10000)
- Consistent animations and transitions
- Standard keyboard navigation (ESC key)
- Unified accessibility features

### Maintainability
- Single source of truth for modal behavior
- Easier to update modal features globally
- Reduced testing surface area

### User Experience
- ESC key works everywhere ✨
- Consistent behavior across all modals
- Better accessibility
- Smoother animations

## Notes

- The base Modal uses `z-index: 10000` (higher than custom modals which use 1000)
- All custom ESC key handling should be removed
- The base Modal handles scroll lock automatically
- Teleport ensures modals render at body level, avoiding z-index issues
