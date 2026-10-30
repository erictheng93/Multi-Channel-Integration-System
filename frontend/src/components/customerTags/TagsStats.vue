<template>
  <article class="ui-lead lead">
    <div class="lead-main">
      <div class="lead-kicker">
        已標記對話
      </div>
      <div class="lead-num">
        {{ stats.totalConversations.toLocaleString('en-US') }}<small>個</small>
      </div>
      <div class="lead-meaning">
        同一對話可套用多個標籤
      </div>
      <dl class="lead-facts">
        <div>
          <dt>標籤數</dt>
          <dd>{{ stats.totalTags }}</dd>
        </div>
        <div>
          <dt>最常用</dt>
          <dd>{{ parts[0]?.name ?? '-' }}</dd>
        </div>
        <div v-if="unusedCount > 0">
          <dt>尚未套用</dt>
          <dd>{{ unusedCount }}</dd>
        </div>
      </dl>
    </div>

    <div
      v-if="parts.length > 0"
      class="lead-mix"
    >
      <div class="mix-head">
        標籤分佈<span>前 {{ parts.length }} 名佔 {{ coverage }}%</span>
      </div>
      <div
        class="mix-bar"
        role="img"
        :aria-label="`標籤分佈：${parts.map((p) => `${p.name} ${p.count}`).join('、')}`"
      >
        <i
          v-for="p in parts"
          :key="p.id"
          :style="{ flexGrow: p.count, background: p.color }"
        />
        <i
          v-if="rest"
          class="mix-rest"
          :style="{ flexGrow: rest.count }"
        />
      </div>
      <ul class="mix-legend">
        <li
          v-for="p in parts"
          :key="p.id"
        >
          <i :style="{ background: p.color }" />
          <span class="mix-name">{{ p.name }}</span>
          <b>{{ p.count }}</b>
        </li>
        <li v-if="rest">
          <i class="mix-rest" />
          <span class="mix-name">其他 {{ rest.tags }} 個標籤</span>
          <b>{{ rest.count }}</b>
        </li>
      </ul>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Tag } from '@/types/tag'

const props = defineProps<{
  stats: {
    totalTags: number
    totalConversations: number
    activeTags: number
  }
  tags: Tag[]
}>()

const unusedCount = computed(() => Math.max(0, props.stats.totalTags - props.stats.activeTags))

// The five most-applied tags in their own colours: what the counts are made of, not a restated fraction
const parts = computed(() =>
  [...props.tags]
    .filter((t) => (t.conversationCount || 0) > 0)
    .sort((a, b) => (b.conversationCount || 0) - (a.conversationCount || 0))
    .slice(0, 5)
    .map((t) => ({ id: t.id, name: t.name, color: t.color, count: t.conversationCount || 0 })),
)

/** Everything outside the top five, so the bar and legend add up to the whole */
const rest = computed(() => {
  const total = props.tags.reduce((n, t) => n + (t.conversationCount || 0), 0)
  const count = total - parts.value.reduce((n, p) => n + p.count, 0)
  const tags = props.tags.filter((t) => (t.conversationCount || 0) > 0).length - parts.value.length
  return count > 0 ? { count, tags } : null
})

const coverage = computed(() => {
  const total = props.tags.reduce((n, t) => n + (t.conversationCount || 0), 0)
  if (total <= 0) { return 0 }
  return Math.round((parts.value.reduce((n, p) => n + p.count, 0) / total) * 100)
})
</script>

<style scoped>
.mix-rest {
  background: var(--ui-muted);
  opacity: 0.55;
}

.lead-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 32px;
  margin: 22px 0 0;
}

.lead-facts dt {
  font-size: 13px;
  color: var(--ui-muted);
}

.lead-facts dd {
  margin: 2px 0 0;
  font: 600 18px / 1.2 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.lead {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 20px 40px;
  align-items: center;
  padding: 24px 40px;
}

.lead-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.lead-kicker {
  font-size: 15px;
  font-weight: 600;
  color: var(--section-ink);
}

.lead-num {
  margin-top: 4px;
  font: 600 56px / 1.05 var(--ui-font-display);
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.lead-num small {
  margin-left: 6px;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.lead-meaning {
  margin-top: 6px;
  font-size: 15px;
  color: var(--ui-ink-2);
}

.lead-mix {
  position: relative;
  min-width: 0;
}

.lead-mix::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: -20px;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.mix-head {
  display: flex;
  gap: 10px;
  align-items: baseline;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.mix-head span {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.mix-bar {
  display: flex;
  gap: 3px;
  height: 14px;
  margin-top: 12px;
}

.mix-bar i {
  flex-basis: 0;
  min-width: 6px;
  border-radius: 999px;
}

.mix-legend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 230px));
  gap: 8px 36px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.mix-legend li {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  font-size: 14px;
}

.mix-legend li i {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.mix-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ui-ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mix-legend b {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
  .lead {
    grid-template-columns: minmax(0, 1fr);
    padding: 22px 20px;
  }

  .lead-num {
    font-size: 48px;
  }

  .lead-mix::before {
    display: none;
  }

  .lead-facts {
    margin-top: 14px;
  }
}
</style>
