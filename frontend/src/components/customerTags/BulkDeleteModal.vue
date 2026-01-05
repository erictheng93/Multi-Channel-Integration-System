<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="modal-overlay"
        @click.self="$emit('update:visible', false)"
      >
        <div class="modal-container modal-danger">
          <header class="modal-header">
            <h2>確認批量刪除</h2>
            <button
              class="modal-close"
              @click="$emit('update:visible', false)"
            >
              <XIcon />
            </button>
          </header>

          <div class="modal-body">
            <div class="warning-icon">
              <AlertTriangleIcon />
            </div>
            <p class="warning-text">
              您確定要刪除 <strong>{{ selectedCount }}</strong> 個標籤嗎？
            </p>
            <p class="warning-subtext">
              此操作無法復原。這些標籤將從所有相關的客戶和對話中移除。
            </p>

            <!-- Preview of tags being deleted -->
            <div
              v-if="selectedTags.length > 0"
              class="tags-preview"
            >
              <div class="preview-title">
                將要刪除的標籤：
              </div>
              <div class="preview-tags">
                <span
                  v-for="tag in previewTags"
                  :key="tag.id"
                  class="preview-tag"
                  :style="{ borderColor: tag.color, color: tag.color }"
                >
                  {{ tag.name }}
                </span>
                <span
                  v-if="remainingCount > 0"
                  class="preview-more"
                >
                  及其他 {{ remainingCount }} 個標籤
                </span>
              </div>
            </div>
          </div>

          <footer class="modal-footer">
            <button
              class="btn btn-secondary"
              @click="$emit('update:visible', false)"
            >
              取消
            </button>
            <button
              class="btn btn-danger"
              @click="$emit('confirm')"
            >
              確認刪除全部
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { XIcon, AlertTriangleIcon } from '@/components/icons'
import type { Tag } from '@/types/tag'

const props = defineProps<{
  visible: boolean
  selectedTags: Tag[]
  selectedCount: number
}>()

defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
}>()

// Show max 5 tags in preview
const previewTags = computed(() => props.selectedTags.slice(0, 5))
const remainingCount = computed(() => Math.max(0, props.selectedCount - 5))
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.modal-container {
  width: 100%;
  max-width: 500px;
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-2xl);
  overflow: hidden;
}

.modal-danger {
  border-top: 4px solid var(--red-500);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--gray-200);
}

.modal-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--red-700);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--gray-500);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.modal-close:hover {
  background: var(--gray-100);
  color: var(--gray-700);
}

.modal-body {
  padding: var(--space-6);
  text-align: center;
}

.warning-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: var(--red-100);
  border-radius: var(--radius-full);
  color: var(--red-600);
  margin-bottom: var(--space-4);
}

.warning-icon svg {
  width: 32px;
  height: 32px;
}

.warning-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.warning-text strong {
  color: var(--red-600);
  font-size: 1.125rem;
}

.warning-subtext {
  font-size: 0.875rem;
  color: var(--gray-600);
  margin: 0 0 var(--space-4);
  line-height: 1.5;
}

.tags-preview {
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: var(--gray-50);
  border-radius: var(--radius-lg);
  text-align: left;
}

.preview-title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--gray-700);
  margin-bottom: var(--space-2);
}

.preview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.preview-tag {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  font-size: 0.75rem;
  font-weight: 500;
  background: white;
  border: 1px solid;
  border-radius: var(--radius-md);
}

.preview-more {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gray-600);
  background: white;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--gray-200);
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

.btn-danger {
  background: var(--red-500);
  color: white;
}

.btn-danger:hover {
  background: var(--red-600);
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn-secondary:hover {
  background: var(--gray-200);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(20px);
}
</style>
