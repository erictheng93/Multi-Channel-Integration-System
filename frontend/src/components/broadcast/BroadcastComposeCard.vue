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
          placeholder="輸入文字（選填，可只發圖片）"
        />
        <small>{{ content.length }} / 2000</small>
      </label>

      <div class="field">
        <span>圖片（選填，最多 4 張，JPEG / PNG，每張 10MB 以內）</span>
        <ul
          v-if="images.length"
          class="image-grid"
        >
          <li
            v-for="(image, index) in images"
            :key="image.key"
            class="image-tile"
          >
            <img
              :src="image.objectUrl"
              :alt="`圖片 ${index + 1}`"
            >
            <span
              v-if="image.status === 'uploading'"
              class="tile-state"
            >上傳中...</span>
            <span
              v-else-if="image.status === 'error'"
              class="tile-state is-error"
            >{{ image.error }}</span>
            <div class="tile-actions">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="index === 0"
                :aria-label="`將圖片 ${index + 1} 往前移`"
                @click="move(index, -1)"
              >
                前移
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :aria-label="`移除圖片 ${index + 1}`"
                @click="remove(index)"
              >
                移除
              </button>
            </div>
          </li>
        </ul>
        <label
          v-if="images.length < MAX_IMAGES"
          class="btn btn-secondary btn-sm image-picker"
        >
          加入圖片
          <input
            type="file"
            accept="image/jpeg,image/png"
            multiple
            class="visually-hidden"
            @change="onPick"
          >
        </label>
        <small v-if="imageNotice">{{ imageNotice }}</small>
      </div>

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
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Tag } from '@/api/tags'
import { uploadBroadcastImage, type BroadcastAttachmentInput } from '@/api/broadcasts'
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

const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png']

interface PickedImage {
  key: string
  objectUrl: string
  status: 'uploading' | 'done' | 'error'
  attachment?: BroadcastAttachmentInput
  error?: string
}

const images = ref<PickedImage[]>([])
const imageNotice = ref('')

async function onPick(event: Event) {
  const fileInput = event.target as HTMLInputElement
  const picked = Array.from(fileInput.files ?? [])
  fileInput.value = ''
  imageNotice.value = ''

  const valid = picked.filter((file) => ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES)
  if (valid.length < picked.length) {
    imageNotice.value = '僅接受 10MB 以內的 JPEG / PNG 圖片'
  }
  const room = MAX_IMAGES - images.value.length
  if (valid.length > room) {
    imageNotice.value = '最多 4 張圖片，超出的已略過'
  }

  await Promise.all(valid.slice(0, room).map(async (file) => {
    const image: PickedImage = { key: crypto.randomUUID(), objectUrl: URL.createObjectURL(file), status: 'uploading' }
    images.value.push(image)
    const target = () => images.value.find((item) => item.key === image.key)
    try {
      const attachment = await uploadBroadcastImage(file)
      Object.assign(target() ?? {}, { status: 'done', attachment })
    } catch (err) {
      Object.assign(target() ?? {}, { status: 'error', error: err instanceof Error ? err.message : '上傳失敗' })
    }
  }))
}

function remove(index: number) {
  const [removed] = images.value.splice(index, 1)
  if (removed) {URL.revokeObjectURL(removed.objectUrl)}
}

function move(index: number, delta: number) {
  const next = index + delta
  if (next < 0 || next >= images.value.length) {return}
  const [moved] = images.value.splice(index, 1)
  if (moved) {images.value.splice(next, 0, moved)}
}

onBeforeUnmount(() => images.value.forEach((image) => URL.revokeObjectURL(image.objectUrl)))

const imagesReady = computed(() => images.value.every((image) => image.status === 'done'))

const input = computed<CreateBroadcastRequest>(() => ({
  title: title.value,
  content: content.value,
  tagIds: selectedTagId.value ? [selectedTagId.value] : [],
  attachments: images.value.flatMap((image) => (image.attachment ? [image.attachment] : []))
}))

const previewInput = computed<BroadcastPreviewRequest>(() => ({
  tagIds: selectedTagId.value ? [selectedTagId.value] : []
}))

const currentPreview = computed(() =>
  props.previewTagId === selectedTagId.value ? props.preview : null
)

const canSubmit = computed(() =>
  title.value.length > 0 &&
  (content.value.length > 0 || images.value.length > 0) &&
  imagesReady.value &&
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
  const parts = [content.value ? '文字' : '', images.value.length ? `${images.value.length} 張圖片` : ''].filter(Boolean)
  const confirmed = window.confirm(
    `即將發送「${parts.join(' + ')}」給 ${currentPreview.value?.sendable ?? 0} 位 LINE 客戶，送出後無法復原。`
  )
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

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.image-tile {
  position: relative;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: 14px;
  background: #f2f2f7;
}

.image-tile img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 10px;
}

.tile-state {
  font-size: var(--text-sm);
  font-weight: 500;
  color: #8e8e93;
}

.tile-state.is-error {
  color: #ff3b30;
}

.tile-actions {
  display: flex;
  justify-content: space-between;
}

.image-picker {
  justify-self: start;
  cursor: pointer;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
