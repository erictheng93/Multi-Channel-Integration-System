<template>
  <div
    v-if="visible"
    class="success-toast"
  >
    <div class="toast-content">
      <div class="toast-icon" />
      <div class="toast-message">
        <div class="toast-title">
          報表生成成功！
        </div>
        <div class="toast-text">
          報表正在後台處理中
        </div>
      </div>
      <button
        class="toast-close"
        @click="$emit('close')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean;
}

defineProps<Props>();

defineEmits<{
  close: [];
}>();
</script>

<style scoped>
.success-toast {
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 1000;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #10b981;
  animation: slideIn 0.3s ease-out;
}

.toast-content {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
}

.toast-icon {
  font-size: 1.5rem;
  margin-right: 1rem;
}

.toast-message {
  flex: 1;
}

.toast-title {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.toast-text {
  color: #6b7280;
  font-size: 0.9rem;
}

.toast-close {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 1.2rem;
  margin-left: 1rem;
}

.toast-close:hover {
  color: #374151;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .success-toast {
    top: 1rem;
    right: 1rem;
    left: 1rem;
  }
}
</style>
