<template>
  <div
    class="tag-card"
    :class="{ 'tag-selected': isSelected, 'tag-active': isActive, 'tag-unused': !(tag.conversationCount || 0) }"
    :style="{ '--tag-c': tag.color }"
    @click="$emit('view-conversations')"
  >
    <div class="t-top">
      <span class="tag-head">
        <span class="tag-chip">
          <span
            class="tag-color-indicator"
            :style="{ background: tag.color }"
          />
          <h3 class="tag-name">{{ tag.name }}</h3>
        </span>
        <span
          v-if="!(tag.conversationCount || 0)"
          class="ui-pill unused"
        >尚未套用</span>
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
        class="meter"
        aria-hidden="true"
      ><i :style="{ width: meterWidth }" /></span>

      <button
        class="phone-edit"
        :aria-label="`編輯 ${tag.name}`"
        @click.stop="$emit('edit')"
      >
        <EditIcon />
      </button>
      <div class="tag-actions">
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
import { EditIcon, TrashIcon } from '@/components/icons'
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
/* One row of an inset-grouped list: [select] [chip + description] [usage bar] [count] [actions].
   .t-top / .t-foot only group the markup, their children are placed on the row grid. */
.tag-card {
  position: relative;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) minmax(72px, 150px) 104px 80px;
  grid-template-areas:
    'check chip meter count actions'
    'check desc meter count actions';
  align-items: center;
  column-gap: 14px;
  row-gap: 3px;
  margin: 0 8px;
  padding: 12px 12px 12px 14px;
  border-radius: 16px;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.t-top,
.t-foot,
.tag-stats {
  display: contents;
}

.tag-card + .tag-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 14px;
  left: 50px;
  height: 0.5px;
  background: var(--ui-sep);
}

/* A selected or open row is an inset rounded tint: no hairline against it */
.tag-card.tag-active::before,
.tag-card.tag-selected::before,
.tag-card.tag-active + .tag-card::before,
.tag-card.tag-selected + .tag-card::before {
  opacity: 0;
}

.tag-card:hover {
  background: color-mix(in srgb, var(--ui-fill) 45%, transparent);
}

/* Selection reads as a tint, never as a hard outline */
.tag-card.tag-active {
  background: var(--ui-surface-2);
}

.tag-card.tag-selected {
  background: color-mix(in srgb, var(--ui-accent-soft) 70%, var(--ui-surface));
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  justify-self: start;
  min-width: 0;
  max-width: 100%;
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
  grid-area: check;
  display: grid;
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
  grid-area: desc;
  margin: 0;
  display: -webkit-box;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-muted);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tag-description-spacer {
  display: none;
}

.stat-item {
  grid-area: count;
  display: inline-flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.t-count {
  min-width: 2ch;
  text-align: right;
  font: 600 22px var(--ui-font-display);
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


.tag-head {
  grid-area: chip;
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.phone-edit {
  display: none;
}

.meter {
  grid-area: meter;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill-strong);
}

.tag-unused .meter {
  display: none;
}

.meter i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--tag-c, var(--section-hue));
}

.tag-actions {
  grid-area: actions;
  display: flex;
  justify-content: flex-end;
  gap: 2px;
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
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ui-muted);
  cursor: pointer;
  transition:
    background var(--ui-dur) var(--ui-ease),
    color var(--ui-dur) var(--ui-ease);
}

.action-btn svg {
  width: 18px;
  height: 18px;
}

.action-btn {
  color: var(--ui-ink-2);
}

.action-btn:hover {
  background: var(--ui-fill);
  color: var(--ui-ink);
}

.action-btn-danger:hover {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

/* The detail panel takes the right column on wide screens: drop the usage note to keep names readable */
@media (max-width: 1280px) {
  .tag-card {
    grid-template-columns: 22px minmax(0, 1fr) minmax(72px, 150px) 104px 80px;
  }
}

@media (max-width: 1024px) {
  .tag-card {
    grid-template-columns: 22px minmax(0, 1fr) minmax(72px, 150px) 104px 80px;
  }
}

/* Phone: name, description and count; edit and delete live in the detail sheet */
@media (max-width: 768px) {
  /* No empty select column on a phone: the checkbox column exists only where there is no hover to reveal it */
  .tag-card {
    grid-template-columns: minmax(0, 1fr) auto 36px;
    grid-template-areas:
      'chip count edit'
      'desc count edit';
    column-gap: 8px;
    margin: 0 4px;
    padding: 12px 12px;
  }

  .tag-checkbox {
    display: none;
  }

  .tag-card + .tag-card::before {
    right: 12px;
    left: 12px;
  }

  .meter,
  .tag-actions {
    display: none;
  }

  .phone-edit {
    display: grid;
    grid-area: edit;
    width: 36px;
    height: 36px;
    place-items: center;
    border: 0;
    border-radius: 10px;
    background: var(--ui-fill);
    color: var(--ui-ink-2);
    cursor: pointer;
  }

  .phone-edit svg {
    width: 18px;
    height: 18px;
  }

  /* numeral over unit: the count stays narrow and never competes with the name */
  .stat-item {
    flex-direction: column;
    align-items: flex-end;
    gap: 0;
  }

  .stat-item small {
    font-size: 13px;
    line-height: 1.2;
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

  @media (hover: none) {
    .tag-card {
      grid-template-columns: 22px minmax(0, 1fr) auto 36px;
      grid-template-areas:
        'check chip count edit'
        'check desc count edit';
    }

    .tag-checkbox {
      display: grid;
    }

    .tag-card + .tag-card::before {
      left: 48px;
    }
  }

  /* the count doubles as the entry to the tag's conversations */
  .stat-item-clickable::after {
    display: none;
    content: '';
  }
}
</style>
