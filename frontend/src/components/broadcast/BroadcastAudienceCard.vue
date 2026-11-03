<template>
  <section
    class="ui-card audience-card"
    aria-labelledby="broadcast-audience-title"
    aria-live="polite"
  >
    <h2
      id="broadcast-audience-title"
      class="ledger-title"
    >
      發送明細
      <span v-if="tagName">「{{ tagName }}」</span>
    </h2>

    <div
      class="ledger"
      :class="{ 'is-wait': !preview }"
    >
      <div class="cell">
        <b>{{ preview ? preview.total : '—' }}</b>
        <span>人符合標籤</span>
      </div>
      <i
        class="op"
        aria-hidden="true"
      >−</i>
      <div class="cell is-skip">
        <b>{{ preview ? skipped : '—' }}</b>
        <span>人略過</span>
      </div>
      <i
        class="op"
        aria-hidden="true"
      >=</i>
      <div class="cell is-send">
        <b>{{ preview ? preview.sendable : '—' }}</b>
        <span>人收到</span>
      </div>
    </div>

    <p
      v-if="!preview"
      class="ledger-wait"
    >
      {{ loading ? '計算受眾中...' : '選擇目標標籤後，算出符合、略過與實際收件的人數。' }}
    </p>

    <div
      v-if="preview"
      class="mix"
      role="img"
      :aria-label="preview ? `LINE ${preview.sendable} 人，Facebook ${preview.byPlatform.facebook} 人，其他略過 ${otherSkipped} 人` : '尚無受眾'"
    >
      <i
        v-if="preview"
        class="m-line"
        :style="{ flexGrow: preview.sendable }"
      />
      <i
        v-if="preview && preview.byPlatform.facebook > 0"
        class="m-fb"
        :style="{ flexGrow: preview.byPlatform.facebook }"
      />
      <i
        v-if="preview && otherSkipped > 0"
        class="m-other"
        :style="{ flexGrow: otherSkipped }"
      />
    </div>
    <p
      v-if="preview"
      class="mix-key"
    >
      <span><i class="k-line" />LINE 可發，每人耗 1 則額度</span>
      <span v-if="preview.byPlatform.facebook > 0"><i class="k-fb" />Facebook 本期略過</span>
      <span v-if="otherSkipped > 0"><i class="k-other" />其他略過</span>
    </p>

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

const skipped = computed(() => (props.preview ? Math.max(props.preview.total - props.preview.sendable, 0) : 0))
const otherSkipped = computed(() => (props.preview ? Math.max(skipped.value - props.preview.byPlatform.facebook, 0) : 0))

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
/* The tear-off stub of the broadcast: the arithmetic from audience to recipients */
.audience-card {
  margin-top: 0;
  padding: 20px 24px 22px;
}

.ledger-wait {
  margin: 14px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-ink-2);
}

.ledger-title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.ledger {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  align-items: end;
}

.cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.cell b {
  font: 600 40px / 1 var(--ui-font-display);
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
}

.cell span {
  font-size: 13px;
  color: var(--ui-muted);
}

/* nothing calculated yet: the figures are drawn as quiet placeholder bars */
.is-wait b {
  display: block;
  width: 56px;
  height: 12px;
  margin: 0 0 12px;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 0;
}

.is-wait .op {
  padding-bottom: 32px;
}

.is-wait .is-send b {
  background: var(--ui-accent-soft);
}

.is-skip b {
  color: var(--ui-muted);
}

.is-send b {
  color: var(--ui-accent);
}

.is-send span {
  font-weight: 600;
  color: var(--ui-ink-2);
}

.op {
  padding-bottom: 20px;
  font: 400 24px / 1 var(--ui-font-display);
  font-style: normal;
  color: var(--ui-muted);
}

.mix {
  display: flex;
  gap: 3px;
  height: 12px;
  margin-top: 18px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.mix i {
  flex-basis: 0;
  min-width: 6px;
}

.m-line {
  background: var(--ui-line);
}

.m-fb {
  background: var(--ui-messenger);
}

.m-other {
  background: var(--ui-faint);
}

.mix-key {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--ui-ink-2);
}

.mix-key span {
  display: flex;
  gap: 6px;
  align-items: center;
}

.mix-key i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.k-line {
  background: var(--ui-line);
}

.k-fb {
  background: var(--ui-messenger);
}

.k-other {
  background: var(--ui-faint);
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
  font-weight: 600;
}
</style>
