<template>
  <section
    ref="composeRoot"
    class="ui-card compose-card"
    aria-labelledby="broadcast-compose-title"
  >
    <div class="ui-card-head">
      <div>
        <h2
          id="broadcast-compose-title"
          class="ui-card-title"
        >
          建立群發
        </h2>
        <p class="ui-card-sub">
          選擇一個標籤，系統會先凍結收件人快照再發送。
        </p>
      </div>
    </div>

    <form
      class="compose-form"
      @submit.prevent="handleSubmit"
    >
      <div class="field-pair">
        <label class="ui-field">
          <span class="lbl">活動名稱</span>
          <input
            v-model.trim="title"
            class="ui-input"
            maxlength="100"
            type="text"
            required
            placeholder="七月製造業客戶通知"
          >
          <span class="ui-hint hint-split"><span>僅內部紀錄，客戶看不到</span><span class="num">{{ title.length }} / 100</span></span>
        </label>

        <label class="ui-field">
          <span class="lbl">目標標籤</span>
          <select
            v-model.number="selectedTagId"
            class="ui-select"
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
          <span class="ui-hint">一次只能選一個標籤</span>
        </label>
      </div>

      <label class="ui-field">
        <span class="lbl">訊息內容 <small>選填，可只發圖片</small></span>
        <textarea
          v-model.trim="content"
          class="ui-textarea"
          maxlength="2000"
          rows="6"
          placeholder="輸入文字（選填，可只發圖片）"
        />
        <span class="ui-hint hint-split"><span>LINE 單則文字上限 2,000 字</span><span class="num">{{ content.length }} / 2000</span></span>
      </label>

      <div class="ui-field">
        <span class="lbl">圖片 <small>最多 4 張，JPEG / PNG，每張 10 MB 以內</small></span>
        <ul class="image-grid">
          <li
            v-for="(image, index) in images"
            :key="image.key"
            :data-image-key="image.key"
            class="image-tile"
            :class="{ 'is-error': image.status === 'error' }"
          >
            <img
              :src="image.objectUrl"
              :alt="`圖片 ${index + 1}`"
            >
            <span class="tile-n">{{ index + 1 }}</span>
            <span
              v-if="image.status === 'uploading'"
              class="tile-busy"
            >上傳中</span>
            <div class="tile-actions">
              <button
                v-if="image.status === 'error'"
                type="button"
                class="tile-btn"
                :aria-label="`重試上傳圖片 ${index + 1}`"
                @click="retry(image)"
              >
                重試
              </button>
              <button
                type="button"
                class="tile-btn"
                :disabled="index === 0"
                data-action="move-before"
                :aria-label="`將圖片 ${index + 1} 往前移`"
                @click="move(index, -1)"
              >
                前移
              </button>
              <button
                type="button"
                class="tile-btn"
                :disabled="index === images.length - 1"
                data-action="move-after"
                :aria-label="`將圖片 ${index + 1} 往後移`"
                @click="move(index, 1)"
              >
                後移
              </button>
              <button
                type="button"
                class="tile-btn"
                :aria-label="`移除圖片 ${index + 1}`"
                data-action="remove"
                @click="remove(index)"
              >
                移除
              </button>
            </div>
          </li>
          <li
            v-if="images.length < MAX_IMAGES"
            class="image-add"
          >
            <label class="image-picker">
              <svg
                class="plus"
                viewBox="0 0 24 24"
                aria-hidden="true"
              ><path d="M12 5v14M5 12h14" /></svg>
              加入圖片
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                class="visually-hidden"
                @change="onPick"
              >
            </label>
          </li>
          <li
            v-for="slot in emptySlots"
            :key="`slot-${slot}`"
            class="image-slot"
            aria-hidden="true"
          >
            {{ slot }}
          </li>
        </ul>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          class="tile-state"
        >
          <span v-if="uploadingCount">{{ uploadingCount }} 張圖片上傳中...</span>
          <span v-else-if="images.length">LINE 會把每張圖片當成獨立訊息，順序即送達順序。</span>
          <small v-if="imageNotice">{{ imageNotice }}</small>
        </div>
        <div
          role="alert"
          aria-atomic="true"
          class="tile-state is-error"
        >
          <span
            v-for="(image, index) in images"
            :key="image.key"
          >
            <template v-if="image.status === 'error'">圖片 {{ index + 1 }}：{{ image.error }}</template>
          </span>
        </div>
      </div>

      <p
        v-if="error"
        class="error-text"
        role="alert"
      >
        {{ error }}
      </p>

      <div class="compose-foot">
        <p class="foot-note">
          <template v-if="currentPreview && !missing.length">
            將發送給 <b>{{ currentPreview.sendable }}</b> 位 LINE 客戶，送出時會凍結名單。
          </template>
          <template v-else-if="missing.length">
            還需要：<b class="missing">{{ missing.join('、') }}</b>
          </template>
          <template v-else-if="imagesBusy">
            圖片上傳完成後即可發送。
          </template>
          <template v-else>
            尚未取得受眾預覽，請按「更新預覽」。
          </template>
        </p>
        <div class="actions">
          <button
            v-if="selectedTagId"
            type="button"
            class="btn btn-secondary"
            :disabled="previewLoading"
            @click="emitPreview"
          >
            {{ previewLoading ? '預覽中...' : '更新預覽' }}
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="sending"
          >
            {{ sending ? '發送中...' : '建立並發送' }}
          </button>
        </div>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
  import type { Tag } from '@/api/tags'
  import { cleanupBroadcastImage, uploadBroadcastImage, type BroadcastAttachmentInput } from '@/api/broadcasts'
  import type {
    BroadcastAudiencePreview,
    BroadcastPreviewRequest,
    CreateBroadcastRequest,
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
    // The parent calls onCreateSettled once the create request ends: true when the broadcast
    // exists and references the uploads, false when it was not created.
    send: [input: CreateBroadcastRequest, onCreateSettled: (_created: boolean) => void]
    // Live draft for the LINE preview card (text + object URLs of the picked images, in order)
    draft: [value: { content: string; imageUrls: string[] }]
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
    file: File
    status: 'uploading' | 'done' | 'error'
    attachment?: BroadcastAttachmentInput
    error?: string
  }

  const images = ref<PickedImage[]>([])
  const imageNotice = ref('')
  const uploadingCount = computed(
    () => images.value.filter(image => image.status === 'uploading').length
  )
  const composeRoot = ref<HTMLElement | null>(null)
  let disposed = false
  // Uploads this form must not delete, by attachment: those a create request in flight is
  // validating, and those a created broadcast references (even if sending then fails). Tracked per
  // attachment because images can still be added or removed while the request runs.
  const submittedIds = new Set<string>()
  const ownedByBroadcastIds = new Set<string>()
  const ownedByForm = (attachment: BroadcastAttachmentInput) =>
    !submittedIds.has(attachment.attachmentId) && !ownedByBroadcastIds.has(attachment.attachmentId)

  async function onPick(event: Event) {
    const fileInput = event.target as HTMLInputElement
    const picked = Array.from(fileInput.files ?? [])
    fileInput.value = ''
    imageNotice.value = ''
    const notices: string[] = []

    const valid = picked.filter(
      file => ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES
    )
    if (valid.length < picked.length) {
      notices.push('僅接受 10MB 以內的 JPEG / PNG 圖片')
    }
    const room = MAX_IMAGES - images.value.length
    if (valid.length > room) {
      notices.push('最多 4 張圖片，超出的已略過')
    }
    imageNotice.value = notices.join('；')

    await Promise.all(
      valid.slice(0, room).map(file => {
        const image: PickedImage = {
          key: crypto.randomUUID(),
          objectUrl: URL.createObjectURL(file),
          file,
          status: 'uploading',
        }
        images.value.push(image)
        return uploadImage(image.key, file)
      })
    )
  }

  async function uploadImage(key: string, file: File) {
    // Look up by key so remove/reorder while the upload is in flight stays safe.
    const target = () => images.value.find(item => item.key === key)
    try {
      const attachment = await uploadBroadcastImage(file)
      const current = target()
      if (!current || disposed) {
        void cleanupBroadcastImage(attachment)
        return
      }
      Object.assign(current, { status: 'done', attachment, error: undefined })
    } catch (err) {
      Object.assign(target() ?? {}, {
        status: 'error',
        error: err instanceof Error ? err.message : '上傳失敗',
      })
    }
  }

  async function retry(image: PickedImage) {
    const current = images.value.find(item => item.key === image.key)
    if (!current || current.status !== 'error') {
      return
    }
    Object.assign(current, { status: 'uploading', error: undefined })
    await uploadImage(current.key, current.file)
  }

  async function remove(index: number) {
    const [removed] = images.value.splice(index, 1)
    if (removed) {
      URL.revokeObjectURL(removed.objectUrl)
      if (removed.attachment && ownedByForm(removed.attachment)) {void cleanupBroadcastImage(removed.attachment)}
    }
    await nextTick()
    const nextImage = images.value[Math.min(index, images.value.length - 1)]
    if (nextImage) {
      focusTile(nextImage.key, 'remove')
    } else {
      composeRoot.value?.querySelector<HTMLInputElement>('input[type="file"]')?.focus()
    }
  }

  function focusTile(key: string, action: string) {
    const tile = Array.from(
      composeRoot.value?.querySelectorAll<HTMLElement>('[data-image-key]') ?? []
    ).find(element => element.dataset.imageKey === key)
    const preferred = tile?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
    const fallback = tile?.querySelector<HTMLButtonElement>('button:not(:disabled)')
    ;(preferred && !preferred.disabled ? preferred : fallback)?.focus()
  }

  async function move(index: number, delta: number) {
    const next = index + delta
    if (next < 0 || next >= images.value.length) {
      return
    }
    const [moved] = images.value.splice(index, 1)
    if (moved) {
      images.value.splice(next, 0, moved)
    }
    await nextTick()
    if (moved) {
      focusTile(moved.key, delta > 0 ? 'move-after' : 'move-before')
    }
  }

  onBeforeUnmount(() => {
    disposed = true
    images.value.forEach(image => {
      URL.revokeObjectURL(image.objectUrl)
      if (image.attachment && ownedByForm(image.attachment)) {void cleanupBroadcastImage(image.attachment)}
    })
  })

  watch(
    () => [content.value, images.value.map(image => image.objectUrl)] as const,
    ([text, urls]) => emit('draft', { content: text, imageUrls: [...urls] }),
    { immediate: true }
  )

  const imagesReady = computed(() => images.value.every(image => image.status === 'done'))

  const input = computed<CreateBroadcastRequest>(() => ({
    title: title.value,
    content: content.value,
    tagIds: selectedTagId.value ? [selectedTagId.value] : [],
    attachments: images.value.flatMap(image => (image.attachment ? [image.attachment] : [])),
  }))

  const previewInput = computed<BroadcastPreviewRequest>(() => ({
    tagIds: selectedTagId.value ? [selectedTagId.value] : [],
  }))

  const currentPreview = computed(() =>
    props.previewTagId === selectedTagId.value ? props.preview : null
  )

  // What still blocks sending, in form order (shown beside the primary action)
  const missing = computed(() => {
    const items: string[] = []
    if (!title.value) {items.push('活動名稱')}
    if (!selectedTagId.value) {items.push('目標標籤')}
    if (!content.value && !images.value.length) {items.push('文字或圖片')}
    return items
  })
  // The unused slots after the add tile, numbered, so the 4-image limit reads as a row
  const emptySlots = computed(() =>
    Array.from({ length: Math.max(MAX_IMAGES - images.value.length - 1, 0) }, (_, i) => images.value.length + i + 2)
  )
  const imagesBusy = computed(() => !imagesReady.value)

  const canSubmit = computed(
    () =>
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

  // Pressing the primary action with something missing takes the user to the first missing field
  function focusFirstMissing() {
    const root = composeRoot.value
    if (!root) {return}
    const target = !title.value
      ? root.querySelector<HTMLElement>('input[type="text"]')
      : !selectedTagId.value
        ? root.querySelector<HTMLElement>('select')
        : root.querySelector<HTMLElement>('textarea')
    target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    target?.focus({ preventScroll: true })
  }

  function handleSubmit() {
    if (missing.value.length > 0) {
      focusFirstMissing()
      return
    }
    if (selectedTagId.value > 0 && props.previewTagId !== selectedTagId.value) {
      emitPreview()
      return
    }
    if (!canSubmit.value) {
      return
    }
    const parts = [
      content.value ? '文字' : '',
      images.value.length ? `${images.value.length} 張圖片` : '',
    ].filter(Boolean)
    const confirmed = window.confirm(
      `即將發送「${parts.join(' + ')}」給 ${currentPreview.value?.sendable ?? 0} 位 LINE 客戶，送出後無法復原。`
    )
    if (confirmed) {
      const sent = input.value.attachments
      sent.forEach(attachment => submittedIds.add(attachment.attachmentId))
      emit('send', input.value, created => {
        sent.forEach(attachment => {
          submittedIds.delete(attachment.attachmentId)
          if (created) {
            ownedByBroadcastIds.add(attachment.attachmentId)
            return
          }
          // Not created: the form owns it again, unless it was removed or the form unmounted
          // meanwhile; that cleanup was deferred to here.
          const stillInForm =
            !disposed && images.value.some(image => image.attachment?.attachmentId === attachment.attachmentId)
          if (!stillInForm) {void cleanupBroadcastImage(attachment)}
        })
      })
    }
  }
</script>

<style scoped>
  .compose-card {
    padding-bottom: 0;
  }

  .compose-form {
    display: grid;
    gap: 18px;
    padding: 4px 22px 0;
  }

  .field-pair {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 16px;
  }

  .lbl {
    font-size: 13px;
    font-weight: 600;
    color: var(--ui-ink-2);
  }

  .lbl small {
    margin-left: 6px;
    font-size: 13px;
    font-weight: 400;
    color: var(--ui-muted);
  }

  .hint-split {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .num {
    font-variant-numeric: tabular-nums;
  }

  .ui-textarea {
    min-height: 150px;
  }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .image-slot {
    display: grid;
    aspect-ratio: 1;
    place-items: center;
    border: 1.5px dashed rgba(60, 60, 67, 0.22);
    border-radius: var(--ui-r-inner);
    background: transparent;
    font-size: var(--ui-t-meta);
    font-variant-numeric: tabular-nums;
    color: var(--ui-muted);
  }

  .image-tile,
  .image-add {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: var(--ui-r-inner);
    background: var(--ui-surface-2);
  }

  .image-tile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .image-tile.is-error {
    box-shadow: inset 0 0 0 2px var(--ui-red);
  }

  .tile-n {
    position: absolute;
    top: 6px;
    left: 6px;
    display: grid;
    width: 22px;
    height: 22px;
    place-items: center;
    border-radius: 7px;
    background: rgb(0 0 0 / 0.5);
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }

  .tile-busy {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(255 255 255 / 0.7);
    font-size: 13px;
    font-weight: 600;
  }

  .tile-actions {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px;
    background: linear-gradient(transparent, rgb(0 0 0 / 0.55));
    opacity: 0;
    transition: opacity var(--ui-dur) var(--ui-ease);
  }

  .image-tile:hover .tile-actions,
  .image-tile:focus-within .tile-actions {
    opacity: 1;
  }

  @media (hover: none) {
    .tile-actions {
      opacity: 1;
    }
  }

  .tile-btn {
    height: 24px;
    padding: 0 8px;
    border: 0;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.92);
    font-size: 13px;
    font-weight: 600;
    color: var(--ui-ink);
    cursor: pointer;
  }

  .tile-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .image-add {
    background: var(--ui-surface);
    box-shadow: inset 0 0 0 1px var(--ui-sep);
  }

  .image-picker {
    display: grid;
    height: 100%;
    place-content: center;
    justify-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ui-ink-2);
    cursor: pointer;
  }

  .image-picker .plus {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentcolor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  .image-picker:focus-within {
    outline: 2px solid var(--ui-accent);
    outline-offset: -2px;
    border-radius: var(--ui-r-inner);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .tile-state {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: 13px;
    font-weight: 400;
    color: var(--ui-muted);
  }

  .tile-state:empty {
    display: none;
  }

  .tile-state.is-error {
    color: var(--ui-red-ink);
  }

  .error-text {
    margin: 0;
    font-size: 13px;
    color: var(--ui-red-ink);
  }

  .compose-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 0 -22px;
    padding: 14px 22px;
    box-shadow: 0 -0.5px 0 var(--ui-sep);
  }

  .foot-note {
    margin: 0;
    font-size: 13px;
    color: var(--ui-muted);
  }

  .foot-note b.missing {
    font-weight: 600;
    color: var(--ui-orange-ink);
  }

  .foot-note b {
    color: var(--ui-ink);
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  @media (max-width: 768px) {
    .field-pair {
      grid-template-columns: 1fr;
    }
    .image-grid {
      gap: 8px;
    }
    .actions {
      width: 100%;
    }
    .actions .btn {
      flex: 1;
    }
  }

  .ui-input::placeholder,
  .ui-textarea::placeholder {
    color: var(--ui-muted);
  }
</style>
