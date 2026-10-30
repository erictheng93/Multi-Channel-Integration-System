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
        共 {{ stats.totalTags }} 個標籤；同一對話可套用多個標籤
      </div>
    </div>

    <div class="lead-rings">
      <ServiceRings
        summary="標籤使用概況"
        :rings="rings"
        :size="136"
        center-label="使用中"
        :center-value="stats.activeTags"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ServiceRings from '@/components/ui/ServiceRings.vue'

const props = defineProps<{
  stats: {
    totalTags: number
    totalConversations: number
    activeTags: number
  }
}>()

const unusedCount = computed(() => Math.max(0, props.stats.totalTags - props.stats.activeTags))

// One real ratio: tags that are applied to at least one conversation / all tags
const rings = computed(() => [
  {
    label: unusedCount.value > 0 ? `使用中標籤（${unusedCount.value} 個尚未套用）` : '使用中標籤（皆已套用）',
    value: props.stats.activeTags,
    total: props.stats.totalTags,
    of: '個標籤',
    hue: 'var(--section-hue)',
  },
])
</script>

<style scoped>
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

.lead-rings {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.lead-rings::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: -20px;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

@media (max-width: 768px) {
  .lead {
    grid-template-columns: minmax(0, 1fr);
    padding: 22px 20px;
  }

  .lead-num {
    font-size: 48px;
  }

  .lead-rings {
    justify-content: flex-start;
  }

  .lead-rings::before {
    display: none;
  }
}
</style>
