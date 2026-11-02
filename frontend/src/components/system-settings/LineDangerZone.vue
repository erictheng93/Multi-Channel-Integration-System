<!--
  LineDangerZone.vue
  The destructive action of the LINE page, kept apart from the credential form so the page can always
  place it last (phone order: status, quota, credentials, webhook, danger zone).
-->
<template>
  <section
    class="danger-zone"
    aria-labelledby="line-danger-title"
  >
    <div
      class="dz-ico"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5v4M12 17h.01" /></svg>
    </div>
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
      class="btn btn-danger dz-btn"
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
/* its own card with a red icon tile so it never reads as one more settings row */
.danger-zone {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-top: 8px;
  padding: 18px 22px;
  border-radius: var(--ui-r-group);
  background: var(--ui-surface);
}

.dz-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.dz-ico svg {
  width: 22px;
  height: 22px;
}

.dz-text {
  flex: 1;
  min-width: 0;
}

.dz-title {
  margin: 0;
  font: 600 16px / 1.3 var(--ui-font-display);
  color: var(--ui-red-ink);
}

.dz-desc {
  margin: 2px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-ink-2);
}

.dz-btn {
  flex: none;
}

@media (max-width: 768px) {
  .danger-zone {
    flex-wrap: wrap;
    padding: 16px 18px;
  }

  .dz-text {
    flex: 1 1 calc(100% - 64px);
  }

  .dz-btn {
    width: 100%;
  }
}
</style>
