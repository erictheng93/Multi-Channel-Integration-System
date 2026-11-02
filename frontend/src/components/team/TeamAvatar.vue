<template>
  <span
    class="team-avatar"
    :class="{ 'is-sm': size === 'sm' }"
    :style="{ background: tone.bg, color: tone.ink }"
  >
    <img
      v-if="src"
      :src="src"
      :alt="name"
      loading="lazy"
    >
    <template v-else>{{ initial }}</template>
    <span
      v-if="presence"
      class="presence"
      :class="`is-${presence}`"
      :title="presence === 'online' ? '在線' : '離線'"
    />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { pastelBackground, pastelInk } from '@/utils/team-tone'

interface Props {
  name: string
  /** Stable key (member id) so the colour does not change between renders. */
  seed: string
  src?: string
  size?: 'md' | 'sm'
  /** Omit when presence is unknown. */
  presence?: 'online' | 'offline'
}

const props = withDefaults(defineProps<Props>(), { src: undefined, size: 'md', presence: undefined })

const TONES = ['accent', 'indigo', 'green', 'orange', 'red'] as const

const initial = computed(() => (props.name || '?').charAt(0).toUpperCase())

const tone = computed(() => {
  let hash = 0
  for (const ch of props.seed) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  }
  const token = TONES[hash % TONES.length] ?? 'accent'
  return { bg: pastelBackground(token), ink: pastelInk(token) }
})
</script>

<style scoped>
.team-avatar {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  font: 600 14px var(--ui-font-display);
}
.team-avatar > img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.team-avatar.is-sm {
  width: 28px;
  height: 28px;
  font-size: 12px;
  box-shadow: 0 0 0 2px var(--ui-surface);
}
.presence {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--ui-surface);
}
.presence.is-online {
  background: var(--ui-green);
}
.presence.is-offline {
  background: var(--ui-faint);
}
</style>
