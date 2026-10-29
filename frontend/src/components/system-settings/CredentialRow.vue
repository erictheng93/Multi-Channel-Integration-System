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
    :for-id="inputId"
  >
    <template v-if="showMasked">
      <input
        :id="inputId"
        class="ui-input secret"
        type="text"
        readonly
        :value="maskedText"
        :aria-label="`${label}（已設定）`"
      >
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
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const replacing = ref(false)

const showMasked = computed(() => props.configured && !replacing.value)

const maskedText = computed(() =>
  props.last4 ? `已設定 ••••${props.last4}` : '已設定 ••••••••'
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
.secret {
  font-family: var(--ui-font-mono);
  letter-spacing: 0.04em;
}

.mono {
  font-family: var(--ui-font-mono);
}
</style>
