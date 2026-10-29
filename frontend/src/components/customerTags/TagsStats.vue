<template>
  <section class="ui-grid ui-cols-3 tag-kpis">
    <article class="ui-card ui-kpi">
      <div class="ui-kpi-top">
        <span class="ui-kpi-ico ico-blue"><TagIcon /></span>
        標籤總數
      </div>
      <div class="ui-kpi-value">
        {{ stats.totalTags }}
      </div>
      <div class="ui-kpi-foot hide-phone">
        目前建立的全部標籤
      </div>
    </article>
    <article class="ui-card ui-kpi">
      <div class="ui-kpi-top">
        <span class="ui-kpi-ico ico-indigo"><MessageCircleIcon /></span>
        標記對話數
      </div>
      <div class="ui-kpi-value">
        {{ stats.totalConversations }}
      </div>
      <div class="ui-kpi-foot hide-phone">
        同一對話可套用多個標籤
      </div>
    </article>
    <article class="ui-card ui-kpi">
      <div class="ui-kpi-top">
        <span class="ui-kpi-ico ico-green"><CheckCircleIcon /></span>
        使用中標籤
      </div>
      <div class="ui-kpi-value">
        {{ stats.activeTags }}<small>/ {{ stats.totalTags }}</small>
      </div>
      <div class="ui-kpi-foot hide-phone">
        {{ stats.totalTags - stats.activeTags > 0 ? `${stats.totalTags - stats.activeTags} 個標籤尚未被使用` : '每個標籤都已被使用' }}
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { TagIcon, MessageCircleIcon, CheckCircleIcon } from '@/components/icons'

defineProps<{
  stats: {
    totalTags: number
    totalConversations: number
    activeTags: number
  }
}>()
</script>

<style scoped>
.ico-blue {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}
.ico-indigo {
  background: var(--ui-indigo-soft);
  color: var(--ui-indigo);
}
.ico-green {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

/* Three tiles stay in one row on phones (compact), the foot lines are hidden */
@media (max-width: 768px) {
  .tag-kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .tag-kpis .ui-kpi {
    padding: 14px 14px 12px;
    gap: 8px;
  }
  .tag-kpis .ui-kpi-top {
    font-size: 13px;
  }
  .tag-kpis .ui-kpi-ico,
  .hide-phone {
    display: none;
  }
  .tag-kpis .ui-kpi-value {
    font-size: 26px;
  }
}
</style>
