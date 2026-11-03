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

      <div class="page-grid compose-row">
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

        <!-- One panel for audience + LINE preview, always visible (on a phone it sits right under the form) -->
        <div
          class="ui-card side-panel"
          :class="{ 'is-idle': sideIdle }"
        >
          <BroadcastAudienceCard
            :preview="broadcastsStore.preview"
            :tag-name="previewTagName"
            :loading="broadcastsStore.previewLoading"
          />
          <BroadcastLinePreview
            :content="draft.content"
            :image-urls="draft.imageUrls"
            :sample="lastSample"
          />
        </div>
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

// Recipients the current audience preview would send, per LINE channel (feeds the quota card)
const pendingByChannel = computed(() =>
  Object.fromEntries(
    (broadcastsStore.preview?.tokenGroups ?? []).map(group => [group.channelKey, group.recipientCount])
  )
)
// nothing chosen and nothing typed: on a phone the panel would only restate the empty form
const sideIdle = computed(
  () => !broadcastsStore.preview && !broadcastsStore.previewLoading && !draft.value.content && !draft.value.imageUrls.length
)
const lastSample = computed(() => broadcastsStore.broadcasts.find(b => b.content.trim())?.content.trim() ?? '')
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
let unmounted = false
onUnmounted(() => {
  unmounted = true
  wideMql?.removeEventListener('change', onWideChange)
})

onMounted(async () => {
  // Before the await: onUnmounted cannot remove a listener that is added after it ran
  wideMql?.addEventListener('change', onWideChange)
  await Promise.all([
    tagsStore.fetchTags({ pageSize: 100, includeGlobal: true }),
    broadcastsStore.fetchBroadcasts()
  ])
  if (unmounted) { return }
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

@media (min-width: 1281px) {
  .compose-row {
    align-items: stretch;
  }
}

/* the two cards share one panel: flatten them and separate with one hairline */
.side-panel :deep(.ui-card) {
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.side-panel :deep(.preview-card) {
  flex: 1;
}

@media (min-width: 1281px) {
  .page-grid {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  }
  /* records and recipient detail end on the same line */
  .page-grid.has-detail {
    align-items: stretch;
  }
  .page-grid:has(> :only-child) {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .side-panel {
    align-self: start;
  }

  .side-panel.is-idle {
    display: none;
  }

}
</style>
