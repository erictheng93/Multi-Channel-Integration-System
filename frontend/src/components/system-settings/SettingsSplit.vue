<!--
  SettingsSplit.vue
  Two-column layout for settings form pages: the form column (720px at most) and a context
  column (preview, help) beside it. Collapses to one column at <= 1024px, context after the form.
-->
<template>
  <div class="settings-split">
    <div class="split-main">
      <slot />
    </div>
    <aside
      class="split-aside"
      :aria-label="asideLabel"
    >
      <slot name="aside" />
    </aside>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ asideLabel?: string }>(), { asideLabel: '說明與預覽' })
</script>

<style scoped>
.settings-split {
  display: grid;
  grid-template-columns: minmax(0, 720px) minmax(0, 1fr);
  gap: 22px;
  align-items: start;
  min-width: 0;
}

.split-main {
  display: grid;
  gap: 22px;
  min-width: 0;
}

.split-aside {
  position: sticky;
  top: 16px;
  display: grid;
  gap: 16px;
  min-width: 0;
}

@media (max-width: 1024px) {
  .settings-split {
    grid-template-columns: minmax(0, 1fr);
  }

  .split-aside {
    position: static;
  }
}
</style>
