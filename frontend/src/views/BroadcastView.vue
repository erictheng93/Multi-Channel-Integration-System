<template>
  <AppLayout>
    <main
      class="ui-page broadcast-page ui-rise"
      aria-label="群發訊息"
    >
      <UiPageHead
        title="群發訊息"
        subtitle="針對標籤受眾發送 LINE 圖文訊息，並逐位追蹤結果。發送前會先凍結收件人名單。"
      />

      <LineQuotaCard :pending="pendingByChannel" />

      <div class="page-grid">
        <BroadcastComposeCard
          :tags="tagsStore.tags"
          :preview="broadcastsStore.preview"
          :preview-tag-id="broadcastsStore.previewTagId"
          :preview-loading="broadcastsStore.previewLoading"
          :sending="broadcastsStore.sending"
          :error="broadcastsStore.error"
          @preview="handlePreview"
          @send="handleSend"
          @draft="draft = $event"
        />

        <!-- One panel for audience + LINE preview. Desktop: always open, same height as the form.
             Phone: an accordion after the form, shown once there is input to preview. -->
        <details
          v-show="!isPhone || hasInput"
          class="ui-card side-panel"
          :open="!isPhone || phoneOpen"
          @toggle="onPanelToggle"
        >
          <summary class="side-summary">
            <span>受眾與 LINE 預覽</span>
            <svg
              class="side-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          <BroadcastAudienceCard
            :preview="broadcastsStore.preview"
            :tag-name="previewTagName"
            :loading="broadcastsStore.previewLoading"
          />
          <BroadcastLinePreview
            :content="draft.content"
            :image-urls="draft.imageUrls"
          />
        </details>
      </div>

      <div
        class="page-grid"
        :class="{ 'has-detail': isWide && detailOpen }"
      >
        <BroadcastHistoryList
          :broadcasts="broadcastsStore.broadcasts"
          :loading="broadcastsStore.loading"
          :pagination="broadcastsStore.pagination"
          :selected-id="detailOpen ? detailBroadcastId : null"
          @refresh="broadcastsStore.fetchBroadcasts()"
          @page-change="handleHistoryPageChange"
          @select="openDetail"
        />

        <BroadcastDetailModal
          v-model="recipientStatus"
          :open="detailOpen"
          :inline="isWide"
          :broadcast="broadcastsStore.selectedBroadcast"
          :recipients="broadcastsStore.recipients"
          @close="detailOpen = false"
          @page-change="handleRecipientPageChange"
        />
      </div>
    </main>
  </AppLayout>
</template>

<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AppLayout from '@/components/ui/AppLayout.vue'
import BroadcastComposeCard from '@/components/broadcast/BroadcastComposeCard.vue'
import BroadcastHistoryList from '@/components/broadcast/BroadcastHistoryList.vue'
import BroadcastDetailModal from '@/components/broadcast/BroadcastDetailModal.vue'
import BroadcastAudienceCard from '@/components/broadcast/BroadcastAudienceCard.vue'
import BroadcastLinePreview from '@/components/broadcast/BroadcastLinePreview.vue'
import LineQuotaCard from '@/components/broadcast/LineQuotaCard.vue'
import { useTagsStore } from '@/stores/tags'
import { useBroadcastsStore } from '@/stores/broadcasts'
import type {
  BroadcastPreviewRequest,
  BroadcastRecipientStatus,
  CreateBroadcastRequest
} from '@/api/broadcasts'

const tagsStore = useTagsStore()
const broadcastsStore = useBroadcastsStore()
const detailOpen = ref(false)
const detailBroadcastId = ref<string | null>(null)
const recipientStatus = ref<BroadcastRecipientStatus | undefined>()
const recipientPage = ref(1)
const draft = ref<{ content: string; imageUrls: string[] }>({ content: '', imageUrls: [] })
const hasInput = computed(() => !!draft.value.content || draft.value.imageUrls.length > 0 || !!broadcastsStore.preview)

// Phone: audience + preview collapse into an accordion (open state is the user's choice)
const phoneMql = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: 768px)')
  : null
const isPhone = ref(phoneMql?.matches ?? false)
const phoneOpen = ref(false)
const onPhoneChange = (event: { matches: boolean }) => { isPhone.value = event.matches }
phoneMql?.addEventListener('change', onPhoneChange)
const onPanelToggle = (event: Event) => {
  if (isPhone.value) { phoneOpen.value = (event.target as HTMLElement & { open: boolean }).open }
}

// Recipients the current audience preview would send, per LINE channel (feeds the quota card)
const pendingByChannel = computed(() =>
  Object.fromEntries(
    (broadcastsStore.preview?.tokenGroups ?? []).map(group => [group.channelKey, group.recipientCount])
  )
)
const previewTagName = computed(
  () => tagsStore.tags.find(tag => tag.id === broadcastsStore.previewTagId)?.name
)

// Recipient detail sits beside the history on wide screens and is a dialog below that.
const wideMql = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(min-width: 1281px)')
  : null
const isWide = ref(wideMql?.matches ?? false)
const onWideChange = (event: { matches: boolean }) => {
  isWide.value = event.matches
  detailOpen.value = event.matches && !!broadcastsStore.broadcasts.length
  const first = broadcastsStore.broadcasts[0]
  if (detailOpen.value && !detailBroadcastId.value && first) {
    void openDetail(first.id)
  }
}
onUnmounted(() => {
  wideMql?.removeEventListener('change', onWideChange)
  phoneMql?.removeEventListener('change', onPhoneChange)
})

onMounted(async () => {
  await Promise.all([
    tagsStore.fetchTags({ pageSize: 100, includeGlobal: true }),
    broadcastsStore.fetchBroadcasts()
  ])
  wideMql?.addEventListener('change', onWideChange)
  // Wide layout shows the newest broadcast's recipients by default
  const first = broadcastsStore.broadcasts[0]
  if (isWide.value && first) {
    await openDetail(first.id)
  }
})

async function handlePreview(input: BroadcastPreviewRequest) {
  await broadcastsStore.fetchPreview(input)
}

async function handleSend(input: CreateBroadcastRequest, onCreateSettled: (_created: boolean) => void) {
  await broadcastsStore.createAndSend(input, onCreateSettled)
  if (broadcastsStore.selectedBroadcast) {
    await openDetail(broadcastsStore.selectedBroadcast.id)
  }
}

async function openDetail(id: string) {
  detailBroadcastId.value = id
  recipientStatus.value = undefined
  recipientPage.value = 1
  detailOpen.value = true
  await broadcastsStore.fetchBroadcast(id)
  await fetchCurrentRecipients()
}

watch(recipientStatus, async (status) => {
  if (detailOpen.value && detailBroadcastId.value) {
    recipientPage.value = 1
    await broadcastsStore.fetchRecipients(detailBroadcastId.value, { page: 1, status })
  }
})

async function handleHistoryPageChange(page: number) {
  await broadcastsStore.fetchBroadcasts({ page })
}

async function handleRecipientPageChange(page: number) {
  recipientPage.value = page
  await fetchCurrentRecipients()
}

async function fetchCurrentRecipients() {
  if (!detailBroadcastId.value) {return}
  await broadcastsStore.fetchRecipients(detailBroadcastId.value, {
    page: recipientPage.value,
    status: recipientStatus.value
  })
}
</script>


<style scoped>
/* grouped headers inside the working cards: 17px, not the 19px card title */
.broadcast-page :deep(.ui-card-title) {
  font-size: 17px;
}

.page-grid {
  display: grid;
  /* minmax(0, ...) so a card's min-content cannot widen the track past the page */
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.side-panel {
  display: flex;
  flex-direction: column;
  align-self: stretch;
}

/* The browser wraps open <details> content in a slot; make it a flex column so the preview can fill the panel */
.side-panel::details-content {
  display: flex;
  flex: 1;
  flex-direction: column;
}

/* the two cards share one panel: flatten them and separate with one hairline */
.side-panel :deep(.ui-card) {
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.side-panel :deep(.preview-card) {
  flex: 1;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.side-summary {
  display: none;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  font: 600 var(--ui-t-head) var(--ui-font-display);
  list-style: none;
  cursor: pointer;
}

.side-summary::-webkit-details-marker {
  display: none;
}

.side-chevron {
  width: 18px;
  height: 18px;
  color: var(--ui-muted);
  transition: transform var(--ui-dur) var(--ui-ease);
}

.side-panel[open] .side-chevron {
  transform: rotate(180deg);
}

@media (min-width: 1281px) {
  .page-grid {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  }
  .page-grid:has(> :only-child) {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .side-panel {
    align-self: start;
  }

  .side-summary {
    display: flex;
    min-height: 44px;
  }
}
</style>
