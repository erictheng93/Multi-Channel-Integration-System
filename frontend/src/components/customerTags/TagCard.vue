<template>
  <div
    class="tag-card ui-card"
    :class="{ 'tag-selected': isSelected, 'tag-active': isActive, 'tag-unused': !(tag.conversationCount || 0) }"
    :style="{ '--tag-c': tag.color }"
    @click="$emit('view-conversations')"
  >
    <div class="t-top">
      <span class="tag-chip">
        <span
          class="tag-color-indicator"
          :style="{ background: tag.color }"
        />
        <h3 class="tag-name">{{ tag.name }}</h3>
      </span>
      <div
        class="tag-checkbox"
        @click.stop
      >
        <input
          :id="`tag-${tag.id}`"
          type="checkbox"
          :checked="isSelected"
          class="checkbox-input"
          :aria-label="`選取 ${tag.name}`"
          @change="$emit('select')"
        >
        <label
          :for="`tag-${tag.id}`"
          class="checkbox-label"
        />
      </div>
    </div>

    <p
      v-if="tag.description"
      class="tag-description"
    >
      {{ tag.description }}
    </p>
    <div
      v-else
      class="tag-description-spacer"
    />

    <div class="t-foot">
      <div class="tag-stats">
        <button
          class="stat-item stat-item-clickable"
          :title="`查看 ${tag.conversationCount || 0} 個對話`"
          @click.stop="$emit('view-conversations')"
        >
          <span class="t-count">{{ tag.conversationCount || 0 }}</span>
          <small>個對話</small>
        </button>
      </div>
      <span
        v-if="!(tag.conversationCount || 0)"
        class="ui-pill"
      >尚未套用</span>
      <span
        class="meter"
        aria-hidden="true"
      ><i :style="{ width: meterWidth }" /></span>

      <div class="tag-actions">
        <button
          class="action-btn action-btn-info"
          title="查看統計"
          aria-label="查看統計"
          @click.stop="$emit('view-stats')"
        >
          <BarChartIcon />
        </button>
        <button
          class="action-btn action-btn-primary"
          title="編輯標籤"
          aria-label="編輯標籤"
          @click.stop="$emit('edit')"
        >
          <EditIcon />
        </button>
        <button
          class="action-btn action-btn-danger"
          title="刪除標籤"
          aria-label="刪除標籤"
          @click.stop="$emit('delete')"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  BarChartIcon,
  EditIcon,
  TrashIcon
} from '@/components/icons'
import type { Tag } from '@/types/tag'

const props = defineProps<{
  tag: Tag
  isSelected: boolean
  /** Tag whose conversations are open in the side panel */
  isActive?: boolean
  /** Largest conversationCount among the listed tags (scales the usage bar) */
  maxCount?: number
}>()

defineEmits<{
  select: []
  edit: []
  delete: []
  'view-stats': []
  'view-conversations': []
}>()

const meterWidth = computed(() => {
  const max = props.maxCount ?? 0
  const n = props.tag.conversationCount || 0
  if (max <= 0 || n <= 0) { return '0%' }
  return `${Math.max(6, Math.round((n / max) * 100))}%`
})
</script>

<style scoped>
.tag-card {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 10px;
  padding: 16px 16px 14px;
  cursor: pointer;
  transition:
    box-shadow var(--ui-dur) var(--ui-ease),
    transform var(--ui-dur) var(--ui-ease);
}

.tag-card:hover {
  box-shadow: var(--ui-shadow-raised);
  transform: translateY(-1px);
}

/* Selection reads as tint + lift, never as a hard ring */
.tag-card.tag-active {
  background: color-mix(in srgb, var(--tag-c) 9%, var(--ui-surface));
  box-shadow: var(--ui-shadow-raised);
}

.tag-card.tag-selected {
  background: color-mix(in srgb, var(--ui-accent-soft) 70%, var(--ui-surface));
  box-shadow: var(--ui-shadow-raised);
}

.t-top {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  height: 26px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tag-c) 16%, var(--ui-surface));
  color: color-mix(in srgb, var(--tag-c) 62%, #000);
}

.tag-color-indicator {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.tag-name {
  margin: 0;
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Selection checkbox: revealed on hover/focus/selection, always on touch */
.tag-checkbox {
  position: relative;
  display: grid;
  margin-left: auto;
  opacity: 0;
  transition: opacity var(--ui-dur) var(--ui-ease);
}

.tag-card:hover .tag-checkbox,
.tag-card:focus-within .tag-checkbox,
.tag-card.tag-selected .tag-checkbox {
  opacity: 1;
}

@media (hover: none) {
  .tag-checkbox {
    opacity: 1;
  }
}

.checkbox-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}

.checkbox-label {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 7px;
  background: var(--ui-surface);
  box-shadow: inset 0 0 0 1.5px var(--ui-faint);
  cursor: pointer;
  transition:
    background var(--ui-dur) var(--ui-ease),
    box-shadow var(--ui-dur) var(--ui-ease);
}

.checkbox-input:focus-visible + .checkbox-label {
  box-shadow:
    inset 0 0 0 1.5px var(--ui-accent),
    0 0 0 3px var(--ui-accent-soft);
}

.checkbox-input:checked + .checkbox-label {
  background: var(--ui-accent);
  box-shadow: none;
}

.checkbox-label::after {
  content: '';
  display: none;
  width: 9px;
  height: 5px;
  border-bottom: 2px solid #fff;
  border-left: 2px solid #fff;
  transform: rotate(-45deg) translate(1px, -1px);
}

.checkbox-input:checked + .checkbox-label::after {
  display: block;
}

.tag-description {
  min-height: 38px;
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-muted);
}

.tag-description-spacer {
  min-height: 38px;
}

.t-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
}

.tag-stats {
  flex: none;
}

.stat-item {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.t-count {
  font: 600 18px var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.tag-unused .t-count {
  color: var(--ui-muted);
}

.stat-item small {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.meter {
  order: 3;
  flex: 1 1 100%;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.meter i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-accent);
  opacity: 0.85;
}

.tag-actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
  opacity: 0;
  transition: opacity var(--ui-dur) var(--ui-ease);
}

.tag-card:hover .tag-actions,
.tag-card:focus-within .tag-actions,
.tag-card.tag-active .tag-actions {
  opacity: 1;
}

@media (hover: none) {
  .tag-actions {
    opacity: 1;
  }
}

.action-btn {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--ui-muted);
  cursor: pointer;
  transition:
    background var(--ui-dur) var(--ui-ease),
    color var(--ui-dur) var(--ui-ease);
}

.action-btn svg {
  width: 15px;
  height: 15px;
}

.action-btn:hover {
  background: var(--ui-fill);
  color: var(--ui-ink);
}

.action-btn-danger:hover {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

@media (max-width: 768px) {
  .tag-card {
    gap: 8px;
    padding: 12px;
  }

  /* Compact tile: chip + count only. Edit and delete live in the detail sheet. */
  .tag-description,
  .tag-description-spacer,
  .meter,
  .tag-actions {
    display: none;
  }

  .t-top {
    gap: 6px;
  }

  /* the whole name stays readable: the chip grows to two lines instead of cutting it */
  .tag-chip {
    height: auto;
    min-height: 26px;
    padding: 4px 10px;
    border-radius: 14px;
  }

  .tag-name {
    overflow: visible;
    line-height: 1.3;
    white-space: normal;
  }

  /* the count doubles as the entry to the tag's conversations */
  .stat-item-clickable::after {
    margin-left: 2px;
    color: var(--ui-faint);
    font-size: 18px;
    content: '›';
  }

  .t-foot {
    flex-wrap: wrap;
    min-height: 28px;
  }
}
</style>
