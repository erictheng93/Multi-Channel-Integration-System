<template>
  <div
    v-if="showShortcuts"
    class="keyboard-shortcuts-overlay"
    @click="showShortcuts = false"
  >
    <div
      class="keyboard-shortcuts-modal"
      @click.stop
    >
      <div class="modal-header">
        <h3>鍵盤快捷鍵</h3>
        <button
          class="close-button"
          @click="showShortcuts = false"
        >
          <XIcon />
        </button>
      </div>

      <div class="shortcuts-content">
        <div class="shortcut-section">
          <h4>消息輸入</h4>
          <div class="shortcut-list">
            <div class="shortcut-item">
              <kbd>Enter</kbd>
              <span>發送消息</span>
            </div>
            <div class="shortcut-item">
              <kbd>Shift</kbd> + <kbd>Enter</kbd>
              <span>換行</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
              <span>發送消息</span>
            </div>
            <div class="shortcut-item">
              <kbd>Esc</kbd>
              <span>清空輸入或關閉表情選擇器</span>
            </div>
          </div>
        </div>

        <div class="shortcut-section">
          <h4>導航</h4>
          <div class="shortcut-list">
            <div class="shortcut-item">
              <kbd>/</kbd>
              <span>焦點到輸入框</span>
            </div>
            <div class="shortcut-item">
              <kbd>Esc</kbd>
              <span>返回對話列表</span>
            </div>
            <div class="shortcut-item">
              <kbd>Home</kbd>
              <span>滾動到頂部</span>
            </div>
            <div class="shortcut-item">
              <kbd>End</kbd>
              <span>滾動到底部</span>
            </div>
          </div>
        </div>

        <div class="shortcut-section">
          <h4>操作</h4>
          <div class="shortcut-list">
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>F</kbd>
              <span>搜索消息</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>R</kbd>
              <span>刷新消息</span>
            </div>
            <div class="shortcut-item">
              <kbd>?</kbd>
              <span>顯示快捷鍵幫助</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { XIcon } from '@/components/icons'

const showShortcuts = ref(false)

const handleKeydown = (event: KeyboardEvent) => {
  // 忽略在輸入框內的快捷鍵
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
    return
  }

  if (event.key === '?' && !event.shiftKey) {
    event.preventDefault()
    showShortcuts.value = !showShortcuts.value
  }

  if (event.key === 'Escape' && showShortcuts.value) {
    event.preventDefault()
    showShortcuts.value = false
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

defineExpose({
  showShortcuts: () => {
    showShortcuts.value = true
  }
})
</script>

<style scoped>
.keyboard-shortcuts-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.keyboard-shortcuts-modal {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 600px;
  width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--gray-200);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: var(--gray-500);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.close-button:hover {
  background: var(--gray-100);
  color: var(--gray-700);
}

.shortcuts-content {
  padding: var(--space-6);
  display: grid;
  gap: var(--space-6);
}

.shortcut-section h4 {
  margin: 0 0 var(--space-4) 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
  border-bottom: 1px solid var(--gray-200);
  padding-bottom: var(--space-2);
}

.shortcut-list {
  display: grid;
  gap: var(--space-3);
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.shortcut-item span {
  flex: 1;
  color: var(--gray-700);
  font-size: 0.875rem;
}

kbd {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background: var(--gray-100);
  border: 1px solid var(--gray-300);
  border-radius: 4px;
  font-family: ui-monospace, 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gray-700);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  margin: 0 2px;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .keyboard-shortcuts-modal {
    width: 95vw;
    max-height: 85vh;
  }

  .modal-header,
  .shortcuts-content {
    padding: var(--space-4);
  }

  .shortcuts-content {
    gap: var(--space-4);
  }

  .shortcut-item {
    gap: var(--space-2);
  }

  .shortcut-item span {
    font-size: 0.8125rem;
  }

  kbd {
    font-size: 0.6875rem;
    padding: 1px 4px;
  }
}
</style>