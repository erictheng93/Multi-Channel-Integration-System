<!-- 需要留意: failed, in-progress and about-to-expire reports, derived from the loaded list -->
<template>
  <section
    class="attn"
    :aria-label="heading"
  >
    <h3 class="attn-h">
      {{ heading }}
      <span class="attn-n">{{ items.length }}</span>
    </h3>
    <ul>
      <li
        v-for="item in items"
        :key="item.id"
      >
        <button
          type="button"
          class="attn-row"
          @click="$emit('open', item.id)"
        >
          <i
            class="attn-dot"
            :class="item.tone"
          />
          <span class="attn-main">
            <b>{{ item.title }}</b>
            <span>{{ item.note }}</span>
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
export interface AttentionItem {
  id: string
  title: string
  note: string
  tone: 'red' | 'orange' | 'grey'
}

withDefaults(defineProps<{ items: AttentionItem[]; heading?: string }>(), { heading: '需要留意' })
defineEmits<{ open: [id: string] }>()
</script>

<style scoped>
.attn {
  padding: 18px 20px 10px;
}

.attn-h {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 0 4px;
  font: 600 17px / 1.3 var(--ui-font-display);
}

.attn-n {
  min-width: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--ui-red-soft);
  font: 600 13px / 22px var(--ui-font-ui);
  text-align: center;
  color: var(--ui-red-ink);
}

.attn ul {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.attn-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  width: 100%;
  min-height: 44px;
  padding: 10px 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.attn li + li .attn-row {
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.attn-dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--ui-faint);
}

.attn-dot.red {
  background: var(--ui-red);
}

.attn-dot.orange {
  background: var(--ui-orange);
}

.attn-main {
  display: grid;
  min-width: 0;
}

.attn-main b {
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.attn-main span {
  font-size: 13px;
  color: var(--ui-muted);
}
</style>
