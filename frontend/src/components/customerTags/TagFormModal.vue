<template>
  <Modal
    :show="visible"
    :title="isEdit ? '編輯標籤' : '新增標籤'"
    size="md"
    @close="$emit('update:visible', false)"
  >
    <!-- Tag Name -->
    <div class="form-group">
      <label
        for="tag-name"
        class="form-label"
      >標籤名稱 *</label>
      <input
        id="tag-name"
        :value="formData.name"
        type="text"
        class="form-input"
        placeholder="輸入標籤名稱..."
        maxlength="50"
        @input="$emit('update:formData', { ...formData, name: ($event.target as HTMLInputElement).value })"
      >
    </div>

    <!-- Color Picker -->
    <div class="form-group">
      <label class="form-label">標籤顏色</label>
      <div class="color-picker">
        <div
          v-for="color in predefinedColors"
          :key="color"
          class="color-option"
          :class="{ 'color-selected': formData.color === color }"
          :style="{ background: color }"
          @click="$emit('update:formData', { ...formData, color })"
        />
      </div>
    </div>

    <!-- Description -->
    <div class="form-group">
      <label
        for="tag-desc"
        class="form-label"
      >描述 (選填)</label>
      <textarea
        id="tag-desc"
        :value="formData.description"
        class="form-textarea"
        placeholder="輸入標籤描述..."
        rows="3"
        maxlength="200"
        @input="$emit('update:formData', { ...formData, description: ($event.target as HTMLTextAreaElement).value })"
      />
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <button
        class="btn btn-secondary"
        @click="$emit('update:visible', false)"
      >
        取消
      </button>
      <button
        class="btn btn-primary"
        @click="$emit('save')"
      >
        {{ isEdit ? '更新' : '創建' }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Modal from '@/components/ui/Modal.vue'

defineProps<{
  visible: boolean
  isEdit: boolean
  formData: {
    name: string
    color: string
    description: string
  }
  predefinedColors: string[]
}>()

defineEmits<{
  'update:visible': [value: boolean]
  'update:formData': [value: { name: string; color: string; description: string }]
  save: []
}>()
</script>

<style scoped>
.form-group {
  margin-bottom: var(--space-5);
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-700);
  margin-bottom: var(--space-2);
}

.form-input,
.form-textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-lg);
  font-size: 0.9375rem;
  color: var(--gray-900);
  transition: all var(--transition-fast);
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
}

.color-picker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--space-2);
}

.color-option {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 3px solid transparent;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.color-selected {
  border-color: var(--gray-900);
  box-shadow: 0 0 0 2px white, 0 0 0 4px var(--gray-900);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--primary-500);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-600);
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn-secondary:hover {
  background: var(--gray-200);
}
</style>
