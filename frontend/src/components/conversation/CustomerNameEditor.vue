<template>
  <div class="customer-name-editor">
    <input
      v-if="editing"
      ref="inputRef"
      v-model="draft"
      class="name-input"
      type="text"
      maxlength="50"
      aria-label="客戶暱稱"
      placeholder="輸入暱稱（留空則清除）"
      :disabled="saving"
      @keydown.enter.prevent="save"
      @keydown.esc.prevent="cancel"
      @blur="save"
    >
    <h1
      v-else
      class="customer-name"
    >
      {{ displayName || '載入中...' }}
      <button
        v-if="customerId"
        type="button"
        class="edit-btn"
        aria-label="編輯客戶暱稱"
        @click="startEdit"
      >
        <EditIcon
          width="14"
          height="14"
        />
      </button>
    </h1>
    <div
      v-if="!editing && customName && platformName"
      class="platform-name"
    >
      {{ platformLabel }}：{{ platformName }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { EditIcon } from '@/components/icons'
import { updateCustomerName } from '@/api/customers'
import { useConversationsStore } from '@/stores/conversations'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  customerId?: number | null
  displayName?: string
  customName?: string | null
  platformName?: string | null
  platform?: string
}>()

const store = useConversationsStore()
const { showError } = useToast()

const editing = ref(false)
const saving = ref(false)
const draft = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const platformLabel = computed(() =>
  props.platform === 'facebook' ? 'Facebook 名稱' : props.platform === 'line' ? 'LINE 名稱' : '平台名稱'
)

const startEdit = async () => {
  draft.value = props.customName ?? ''
  editing.value = true
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

const cancel = () => {
  editing.value = false
}

const save = async () => {
  if (!editing.value || saving.value || !props.customerId) { return }
  const next = draft.value.trim() || null
  if (next === (props.customName ?? null)) {
    editing.value = false
    return
  }
  saving.value = true
  const prev = {
    customerId: props.customerId,
    customName: props.customName ?? null,
    platformName: props.platformName ?? null,
    name: props.displayName ?? null
  }
  // 樂觀更新：清除暱稱時退回平台名稱
  store.applyCustomerUpdate({
    ...prev,
    customName: next,
    name: next ?? props.platformName ?? props.displayName ?? null
  })
  editing.value = false
  try {
    await updateCustomerName(props.customerId, next)
  } catch (error) {
    store.applyCustomerUpdate(prev)
    showError('更新暱稱失敗', error instanceof Error ? error.message : undefined)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.customer-name {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1c1c1e;
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: #8e8e93;
  cursor: pointer;
  transition: background-color 0.2s ease-out, color 0.2s ease-out;
}

.edit-btn:hover,
.edit-btn:focus-visible {
  background: #f2f2f7;
  color: #007aff;
}

.name-input {
  width: 100%;
  max-width: 16rem;
  padding: 0.25rem 0.75rem;
  border: none;
  border-radius: 0.75rem;
  background: #f2f2f7;
  color: #1c1c1e;
  font-size: 1.125rem;
  font-weight: 600;
  outline: none;
}

.name-input:focus {
  box-shadow: 0 0 0 2px rgb(0 122 255 / 0.4);
}

.platform-name {
  margin-top: 0.125rem;
  font-size: 0.8125rem;
  color: #8e8e93;
}
</style>
