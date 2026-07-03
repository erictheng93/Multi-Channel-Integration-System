<template>
  <section
    class="compose-card"
    aria-labelledby="broadcast-compose-title"
  >
    <div class="section-heading">
      <div>
        <h2 id="broadcast-compose-title">
          建立群發
        </h2>
        <p>選擇一個標籤，系統會先凍結收件人快照再發送。</p>
      </div>
    </div>

    <form
      class="compose-form"
      @submit.prevent="handleSubmit"
    >
      <label class="field">
        <span>活動名稱</span>
        <input
          v-model.trim="title"
          maxlength="100"
          type="text"
          required
          placeholder="七月製造業客戶通知"
        >
      </label>

      <label class="field">
        <span>目標標籤</span>
        <select
          v-model.number="selectedTagId"
          required
          @change="emitPreview"
        >
          <option
            :value="0"
            disabled
          >選擇標籤</option>
          <option
            v-for="tag in tags"
            :key="tag.id"
            :value="tag.id"
          >{{ tag.name }}</option>
        </select>
      </label>

      <label class="field">
        <span>訊息內容</span>
        <textarea
          v-model.trim="content"
          maxlength="2000"
          rows="6"
          required
          placeholder="輸入要推送給 LINE 客戶的文字訊息"
        />
        <small>{{ content.length }} / 2000</small>
      </label>

      <div
        v-if="currentPreview"
        class="preview-panel"
        aria-live="polite"
      >
        <strong>符合 {{ currentPreview.total }} 人</strong>
        <span>LINE 可發 {{ currentPreview.byPlatform.line }} 人</span>
        <span>Facebook {{ currentPreview.byPlatform.facebook }} 人本期略過</span>
      </div>

      <p
        v-if="error"
        class="error-text"
      >
        {{ error }}
      </p>

      <div class="actions">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="previewLoading || !selectedTagId"
          @click="emitPreview"
        >
          {{ previewLoading ? '預覽中...' : '更新預覽' }}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="sending || !canSubmit"
        >
          {{ sending ? '發送中...' : '建立並發送' }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Tag } from '@/api/tags'
import type {
  BroadcastAudiencePreview,
  BroadcastPreviewRequest,
  CreateBroadcastRequest
} from '@/api/broadcasts'

const props = defineProps<{
  tags: Tag[]
  preview: BroadcastAudiencePreview | null
  previewTagId: number | null
  previewLoading: boolean
  sending: boolean
  error: string | null
}>()

const emit = defineEmits<{
  preview: [input: BroadcastPreviewRequest]
  send: [input: CreateBroadcastRequest]
}>()

const title = ref('')
const content = ref('')
const selectedTagId = ref(0)

const input = computed<CreateBroadcastRequest>(() => ({
  title: title.value,
  content: content.value,
  tagIds: selectedTagId.value ? [selectedTagId.value] : []
}))

const previewInput = computed<BroadcastPreviewRequest>(() => ({
  tagIds: selectedTagId.value ? [selectedTagId.value] : []
}))

const currentPreview = computed(() =>
  props.previewTagId === selectedTagId.value ? props.preview : null
)

const canSubmit = computed(() =>
  title.value.length > 0 &&
  content.value.length > 0 &&
  selectedTagId.value > 0 &&
  currentPreview.value?.sendable &&
  currentPreview.value.sendable > 0
)

function emitPreview() {
  if (selectedTagId.value > 0) {
    emit('preview', previewInput.value)
  }
}

function handleSubmit() {
  if (selectedTagId.value > 0 && props.previewTagId !== selectedTagId.value) {
    emitPreview()
    return
  }
  if (!canSubmit.value) {return}
  const confirmed = window.confirm(`即將發送給 ${currentPreview.value?.sendable ?? 0} 位 LINE 客戶，送出後無法復原。`)
  if (confirmed) {
    emit('send', input.value)
  }
}
</script>

<style scoped>
.compose-card {
  background: #fff;
  border-radius: 16px;
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.section-heading h2 {
  margin: 0;
  font-size: var(--text-xl);
}

.section-heading p,
.field small {
  color: var(--gray-500);
}

.compose-form {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-5);
}

.field {
  display: grid;
  gap: var(--space-2);
  font-weight: 600;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  border: 0;
  border-radius: 12px;
  background: #f2f2f7;
  padding: var(--space-3) var(--space-4);
  font: inherit;
}

.field textarea {
  resize: vertical;
}

.preview-panel {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-4);
  border-radius: 14px;
  background: #f2f2f7;
}

.error-text {
  color: #ff3b30;
  margin: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
</style>
