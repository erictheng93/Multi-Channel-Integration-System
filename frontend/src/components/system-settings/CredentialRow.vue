<!--
  CredentialRow.vue

  One stored credential. The server never returns the secret, only { configured, last4 }:
  a configured field shows 「已設定 ••••1234」 with a 更換 button; replacing (or an empty field)
  shows an input whose value is the only thing sent to the server.
-->

<template>
  <SettingsRow
    :label="label"
    :hint="hint"
    :for-id="showMasked ? undefined : inputId"
  >
    <template #lead>
      <span
        class="cred-ico"
        :class="{ 'is-set': configured }"
        aria-hidden="true"
      >
        <!-- eslint-disable vue/no-v-html -->
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          v-html="icon || KEY_ICON"
        />
        <!-- eslint-enable vue/no-v-html -->
      </span>
    </template>
    <template v-if="showMasked">
      <div class="cred-state">
        <span class="ui-pill ui-pill-green ui-pill-dot">已設定</span>
        <code class="cred-last4">{{ maskedText }}</code>
      </div>
      <button
        type="button"
        class="btn btn-secondary"
        :disabled="disabled"
        @click="startReplace"
      >
        更換
      </button>
    </template>
    <template v-else>
      <input
        :id="inputId"
        class="ui-input"
        :class="{ mono: !multiline }"
        :type="secret ? 'password' : 'text'"
        autocomplete="off"
        spellcheck="false"
        :value="modelValue"
        :placeholder="placeholder"
        :required="!configured"
        @input="onInput"
      >
      <button
        v-if="configured"
        type="button"
        class="btn btn-secondary"
        :disabled="disabled"
        @click="cancelReplace"
      >
        取消
      </button>
    </template>
  </SettingsRow>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import SettingsRow from './SettingsRow.vue'

interface Props {
  label: string
  hint?: string
  inputId: string
  modelValue: string
  /** Server-reported state of the stored value */
  configured: boolean
  last4: string | null
  /** Hide typed characters (secrets and tokens) */
  secret?: boolean
  placeholder?: string
  disabled?: boolean
  multiline?: boolean
  /** Inner markup of a 24x24 outline icon shown in the leading tile (static, never user input) */
  icon?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const KEY_ICON = '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>'
const replacing = ref(false)

const showMasked = computed(() => props.configured && !replacing.value)

const maskedText = computed(() =>
  props.last4 ? `••••${props.last4}` : '••••••••'
)

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function startReplace() {
  replacing.value = true
}

function cancelReplace() {
  replacing.value = false
  emit('update:modelValue', '')
}
</script>

<style scoped>
.cred-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: var(--ui-fill);
  color: var(--ui-muted);
}

.cred-ico.is-set {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.cred-ico svg {
  width: 18px;
  height: 18px;
}

/* the stored value: a state pill and the last four characters, pushed against the replace button */
.cred-state {
  display: flex;
  flex: 1;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

.cred-last4 {
  font: 13px var(--ui-font-mono);
  letter-spacing: 0.06em;
  color: var(--ui-ink-2);
}


.mono {
  font-family: var(--ui-font-mono);
}
</style>
