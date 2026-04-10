<template>
  <div id="app" class="app-container">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue';
import { useDeploymentStore } from '@/stores/deploymentStore';

// ========================================
// STORE
// ========================================

const deploymentStore = useDeploymentStore();

// ========================================
// LIFECYCLE
// ========================================

// Cleanup on unmount — the store was refactored from SSE to polling,
// so `disconnectEventStream` no longer exists. `$dispose` stops the
// poll timer and is the correct teardown hook.
onUnmounted(() => {
  deploymentStore.$dispose();
});
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Page transition animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
