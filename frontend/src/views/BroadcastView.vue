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

      <section
        class="ui-card bench"
        :class="{ 'is-open': composeOpen }"
        aria-label="建立群發"
      >
        <!-- Phones start with the log; the composer opens from this bar -->
        <div class="bench-bar">
          <div>
            <h2 class="bench-title">
              建立群發
            </h2>
            <p class="bench-sub">
              選擇一個標籤，系統會先凍結收件人快照再發送。
            </p>
          </div>
          <button
            type="button"
            class="btn btn-sm"
            :class="composeOpen ? 'btn-secondary' : 'btn-primary'"
            :aria-expanded="composeOpen"
            @click="composeOpen = !composeOpen"
          >
            {{ composeOpen ? '收合' : '新增群發' }}
          </button>
        </div>

        <div class="bench-body">
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

          <!-- Audience arithmetic over the phone the customer will hold -->
          <aside
            class="bench-side"
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
          </aside>
        </div>
      </section>

      <section
        class="ui-card log"
        :class="{ 'has-detail': isWide && detailOpen }"
        aria-label="發送紀錄與收件人"
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
      </section>
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
// phones keep the composer folded until asked for; wide screens always show it
const composeOpen = ref(false)
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
  if (!broadcastsStore.error) { composeOpen.value = false }
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
.broadcast-page {
  --ui-pane: color-mix(in srgb, var(--ui-accent) 4%, var(--ui-surface));
}

/* grouped headers inside the working cards: 17px, not the 19px card title */
.broadcast-page :deep(.ui-card-title) {
  font-size: 17px;
}

/* ---- workbench: the composer and what the customer will see, one card ---- */
.bench,
.log {
  padding: 0;
  overflow: hidden;
}

.bench-bar {
  display: none;
}

.bench-body {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  align-items: stretch;
}

.bench :deep(.ui-card),
.log :deep(.ui-card),
.log :deep(.is-inline .ui-card) {
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.bench :deep(.compose-card) {
  padding-top: 6px;
}

.bench-side {
  display: flex;
  flex-direction: column;
  background: var(--ui-pane);
}

.bench-side :deep(.preview-card) {
  flex: 1;
  justify-content: center;
  box-shadow: none;
}

/* ---- the log: records and the chosen record's recipients, one card ---- */
.log {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
}

@media (min-width: 1281px) {
  .log.has-detail {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  }

  .log.has-detail :deep(.modal-backdrop) {
    background: var(--ui-pane);
  }
}

@media (max-width: 1280px) {
  .bench-body {
    grid-template-columns: minmax(0, 1fr);
  }


}

@media (max-width: 768px) {
  .bench-bar {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px;
  }

  .bench-title {
    margin: 0;
    font: 600 17px / 1.3 var(--ui-font-display);
  }

  .bench-sub {
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--ui-ink-2);
  }

  .bench:not(.is-open) .bench-body {
    display: none;
  }

  .bench :deep(.compose-card > .ui-card-head) {
    display: none;
  }

  .bench-side.is-idle {
    display: none;
  }
}
</style>
