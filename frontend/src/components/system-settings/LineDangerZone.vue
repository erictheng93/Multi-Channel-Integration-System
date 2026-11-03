<!--
  LineDangerZone.vue
  The destructive action of the LINE page, kept apart from the credential form so the page can always
  place it last (phone order: message path, credentials, steps, danger zone). Deliberately quiet:
  a plain row with a text-weight button, no tinted slab.
-->
<template>
  <section
    class="danger-zone"
    aria-labelledby="line-danger-title"
  >
    <div class="dz-text">
      <h2
        id="line-danger-title"
        class="dz-title"
      >
        清除已儲存的憑證
      </h2>
      <p class="dz-desc">
        清除後無法收發 LINE 訊息，直到重新填入憑證。這個動作不會刪除對話與客戶資料。
      </p>
    </div>
    <button
      type="button"
      class="btn btn-secondary dz-btn"
      :disabled="disabled"
      @click="emit('clear')"
    >
      清除憑證
    </button>
  </section>
</template>

<script setup lang="ts">
defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ clear: [] }>()
</script>

<style scoped>
.danger-zone {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px 0;
}

.dz-text {
  flex: 1;
  min-width: 0;
}

.dz-title {
  margin: 0;
  font: 600 15px / 1.3 var(--ui-font-display);
  color: var(--ui-ink);
}

.dz-desc {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-muted);
}

.dz-btn.btn {
  flex: none;
  background: var(--ui-red-soft);
  color: color-mix(in srgb, var(--ui-red-ink) 72%, var(--ui-pill-shade));
}

@media (max-width: 768px) {
  .danger-zone {
    flex-wrap: wrap;
  }

  .dz-text {
    flex: 1 1 100%;
  }

  .dz-btn.btn {
    width: 100%;
  }
}
</style>
