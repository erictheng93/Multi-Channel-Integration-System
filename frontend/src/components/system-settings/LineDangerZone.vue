<!--
  LineDangerZone.vue
  The destructive action of the LINE page, kept apart from the credential form so the page can always
  place it last (phone order: status, quota, credentials, webhook, danger zone).
-->
<template>
  <SettingsGroup
    title="危險操作"
    danger
  >
    <SettingsRow
      label="清除已儲存的憑證"
      hint="清除後無法收發 LINE 訊息，直到重新填入憑證。"
      danger
      end
    >
      <button
        type="button"
        class="btn btn-danger"
        :disabled="disabled"
        @click="emit('clear')"
      >
        清除憑證
      </button>
    </SettingsRow>
  </SettingsGroup>
</template>

<script setup lang="ts">
import SettingsGroup from './SettingsGroup.vue'
import SettingsRow from './SettingsRow.vue'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ clear: [] }>()
</script>
