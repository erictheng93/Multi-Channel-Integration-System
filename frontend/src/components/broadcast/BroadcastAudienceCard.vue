<template>
  <section
    class="ui-card audience-card"
    aria-labelledby="broadcast-audience-title"
    aria-live="polite"
  >
    <h2
      id="broadcast-audience-title"
      class="visually-hidden"
    >
      受眾預覽
    </h2>

    <div
      v-if="!preview"
      class="aud-empty"
    >
      <span
        class="aud-ico"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle
          cx="9"
          cy="7"
          r="4"
        /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>
      </span>
      <div>
        <b>受眾預覽</b>
        <span>{{ loading ? '計算受眾中...' : '選擇目標標籤後，會在這裡顯示會收到訊息的人數。' }}</span>
      </div>
    </div>

    <template v-else>
      <div class="big-row">
        <span class="big">{{ preview.total }}</span>
        <span class="of">人符合<template v-if="tagName">「{{ tagName }}」</template>標籤</span>
      </div>

      <div class="split">
        <div class="ui-well tile">
          <span class="tile-label"><span class="ui-ch ui-ch-line"><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>LINE 可發</span>
          <b>{{ preview.sendable }}</b>
          <small>會消耗額度</small>
        </div>
        <div class="ui-well tile">
          <span class="tile-label"><span class="ui-ch ui-ch-fb"><svg viewBox="0 0 24 24"><path d="M12 2C6.4 2 2 6.1 2 11.7c0 2.9 1.2 5.4 3.2 7.2V22l3-1.6c1.2.3 2.4.5 3.8.5 5.6 0 10-4.1 10-9.7S17.6 2 12 2Z" /></svg></span>Facebook</span>
          <b>{{ preview.byPlatform.facebook }}</b>
          <small>本期略過</small>
        </div>
      </div>

      <ul
        v-if="notes.length"
        class="notes"
      >
        <li
          v-for="note in notes"
          :key="note.text"
          :class="{ 'is-warn': note.warn }"
        >
          {{ note.text }}
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BroadcastPreviewResult, BroadcastRecipientErrorReason } from '@/api/broadcasts'

const props = defineProps<{
  preview: BroadcastPreviewResult | null
  tagName?: string
  loading?: boolean
}>()

function reasonLabel(reason: BroadcastRecipientErrorReason): string {
  switch (reason) {
    case 'platform_not_supported_phase1':
      return '本期不支援群發的平台'
    case 'no_channel_credentials':
      return '找不到可用的頻道憑證'
    case 'line_api_failed':
      return 'LINE 發送失敗'
    case 'quota_insufficient':
      return 'LINE 額度不足'
  }
}

const notes = computed(() => {
  const p = props.preview
  if (!p) {return []}
  const out: Array<{ text: string; warn?: boolean }> = []
  for (const item of p.skipped) {
    if (item.count > 0) {
      out.push({ text: `${reasonLabel(item.reason)}：${item.count} 人將被略過` })
    }
  }
  if (p.noCredentialsCount > 0 && !p.skipped.some(item => item.reason === 'no_channel_credentials')) {
    out.push({ text: `${p.noCredentialsCount} 人找不到可用的頻道憑證，將被略過`, warn: true })
  }
  if (p.tokenGroups.length > 1) {
    out.push({
      text: `將透過 ${p.tokenGroups.length} 個頻道發送：${p.tokenGroups.map(group => group.recipientCount).join(' + ')} 人`
    })
  }
  if (p.dailyCap) {
    const over = p.sendable > p.dailyCap.remaining
    out.push({
      text: `今日群發人數上限 ${p.dailyCap.limit.toLocaleString()}，已用 ${p.dailyCap.used.toLocaleString()}，剩餘 ${p.dailyCap.remaining.toLocaleString()}${over ? '，本次人數超出上限' : ''}`,
      warn: over
    })
  }
  return out
})
</script>

<style scoped>
.audience-card {
  padding: 18px 22px 20px;
}

.aud-empty {
  display: flex;
  gap: 14px;
  align-items: center;
}

.aud-ico {
  display: grid;
  flex: none;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 14px;
  background: var(--ui-fill);
  color: var(--ui-muted);
}

.aud-ico svg {
  width: 22px;
  height: 22px;
}

.aud-empty b {
  display: block;
  font: 600 var(--ui-t-title) / 1.3 var(--ui-font-display);
}

.aud-empty span {
  font-size: 13.5px;
  color: var(--ui-muted);
}

.big-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
}

.big {
  font: 600 38px / 1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.of {
  font-size: 14px;
  color: var(--ui-muted);
}

.split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.tile {
  display: grid;
  gap: 2px;
  padding: 12px 14px;
}

.tile-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ui-muted);
}

.tile b {
  font: 600 22px var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.tile small {
  font-size: 13px;
  color: var(--ui-muted);
}

.notes {
  display: grid;
  gap: 6px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--ui-muted);
}

.notes .is-warn {
  color: var(--ui-orange-ink);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
