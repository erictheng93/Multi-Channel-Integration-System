<template>
  <!-- Deprecated: Close/reopen functionality removed -->
  <div v-if="false" />
</template>

<script setup lang="ts">
/**
 * ClosedConversationBanner - DEPRECATED
 *
 * Close/reopen functionality has been removed as part of status cleanup.
 * This component is kept as a no-op for backward compatibility.
 */

interface Props {
  isVisible?: boolean
  loading?: boolean
}

defineProps<Props>()
defineEmits<{ reopen: [] }>()
</script>
