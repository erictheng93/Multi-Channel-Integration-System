<template>
  <aside class="sidebar-widgets">
    <div class="widgets-container">
      <div
        v-if="$slots['quick-actions']"
        class="ui-card widget-wrapper"
      >
        <slot name="quick-actions" />
      </div>
      <div
        v-if="$slots['popular-types']"
        class="ui-card widget-wrapper"
      >
        <slot name="popular-types" />
      </div>
      <div
        v-if="$slots['recent-activity']"
        class="ui-card widget-wrapper"
      >
        <slot name="recent-activity" />
      </div>
      <div
        v-if="$slots.default"
        class="ui-card widget-wrapper"
      >
        <slot />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
</script>

<style scoped>
.widgets-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
