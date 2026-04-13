<template>
  <div class="empty-state">
    <div class="empty-illustration">
      <div class="empty-bell">
        <BellOffIcon />
      </div>
      <div class="empty-particles">
        <span
          v-for="i in 5"
          :key="i"
          class="particle"
          :style="{ '--delay': i * 0.2 + 's' }"
        />
      </div>
    </div>
    <h3 class="empty-title">
      {{ hasActiveFilters ? '沒有符合條件的通知' : '暫無通知' }}
    </h3>
    <p class="empty-description">
      {{ hasActiveFilters ? '請嘗試調整篩選條件' : '新的通知將會顯示在這裡' }}
    </p>
    <button
      v-if="hasActiveFilters"
      class="btn btn-primary"
      @click="$emit('clear-filters')"
    >
      清除篩選條件
    </button>
  </div>
</template>

<script setup lang="ts">
import { BellOffIcon } from '@/components/icons'

defineProps<{
  hasActiveFilters: boolean
}>()

defineEmits<{
  'clear-filters': []
}>()
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  text-align: center;
}

.empty-illustration {
  position: relative;
  margin-bottom: var(--space-6);
}

.empty-bell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  background: var(--gray-100);
  border-radius: var(--radius-full);
  color: var(--gray-400);
}

.empty-bell svg {
  width: 48px;
  height: 48px;
}

.empty-particles {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--gray-300);
  border-radius: var(--radius-full);
  animation: float 3s ease-in-out infinite;
  animation-delay: var(--delay);
}

.particle:nth-child(1) { transform: translate(-40px, -30px); }
.particle:nth-child(2) { transform: translate(40px, -20px); }
.particle:nth-child(3) { transform: translate(-30px, 40px); }
.particle:nth-child(4) { transform: translate(35px, 35px); }
.particle:nth-child(5) { transform: translate(0, -50px); }

@keyframes float {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 0.7; transform: translateY(-10px); }
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.empty-description {
  color: var(--gray-500);
  margin: 0 0 var(--space-6);
}

</style>
