<!--
  SettingsRail.vue

  Section rail shared by every settings page (一般 / LINE / Facebook / 進階 / 健康檢查).
  Status dots come from the controller: integration connection state and the last health check.
  Becomes a horizontally scrolling pill row below 1024px.
-->

<template>
  <nav
    class="srail ui-card"
    aria-label="設定分類"
  >
    <template
      v-for="group in groups"
      :key="group.label"
    >
      <div class="srail-label">
        {{ group.label }}
      </div>
      <router-link
        v-for="section in group.items"
        :key="section.key"
        :to="section.path"
        class="sitem"
        active-class="is-active"
      >
        <span
          class="stile"
          :class="section.color"
        >
          <!-- icon markup is a static constant from settings-pages.ts, never user input -->
          <!-- eslint-disable vue/no-v-html -->
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            v-html="section.icon"
          />
          <!-- eslint-enable vue/no-v-html -->
        </span>
        <span class="sname">{{ section.title }}</span>
        <span
          v-if="dotFor(section.key)"
          class="sdot"
          :class="dotFor(section.key)?.tone"
          :title="dotFor(section.key)?.label"
          role="img"
          :aria-label="dotFor(section.key)?.label"
        />
      </router-link>
    </template>
  </nav>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { SETTINGS_SECTIONS, type SettingsSection, type SettingsSectionKey } from './settings-pages'

interface Dot {
  tone: 'ok' | 'warn' | 'bad'
  label: string
}

const controller = inject(SETTINGS_CONTROLLER_KEY, null)

const groups = computed(() => {
  const map = new Map<string, SettingsSection[]>()
  for (const section of SETTINGS_SECTIONS) {
    map.set(section.group, [...(map.get(section.group) ?? []), section])
  }
  return [...map.entries()].map(([label, items]) => ({ label, items }))
})

function integrationDot(status: string | undefined): Dot | null {
  if (status === 'connected') {
    return { tone: 'ok', label: '已連線' }
  }
  if (status === 'error') {
    return { tone: 'warn', label: '連線異常' }
  }
  if (status === 'disconnected') {
    return { tone: 'warn', label: '未連線' }
  }
  return null
}

function dotFor(key: SettingsSectionKey): Dot | null {
  if (!controller) {
    return null
  }
  if (key === 'line') {
    return integrationDot(controller.settings.integrations.line.status)
  }
  if (key === 'facebook') {
    return integrationDot(controller.settings.integrations.facebook.status)
  }
  if (key === 'health') {
    const status = controller.healthOverall.value?.status
    if (status === 'healthy') {
      return { tone: 'ok', label: '系統正常' }
    }
    if (status === 'warning') {
      return { tone: 'warn', label: '部分降級' }
    }
    if (status === 'critical') {
      return { tone: 'bad', label: '系統異常' }
    }
  }
  return null
}
</script>

<style scoped>
.srail {
  position: sticky;
  top: 0;
  display: grid;
  gap: 2px;
  padding: 8px;
}

.srail-label {
  padding: 12px 12px 4px;
  font-size: var(--ui-t-cap);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--ui-muted);
}

.srail-label:first-child {
  padding-top: 6px;
}

.sitem {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 42px;
  padding: 0 10px;
  border-radius: 13px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-ink);
  text-decoration: none;
  white-space: nowrap;
  transition: background var(--ui-dur) var(--ui-ease);
}

.sitem:hover {
  background: color-mix(in srgb, var(--ui-fill) 60%, transparent);
}

.sitem:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.sitem.is-active {
  background: var(--ui-fill);
  font-weight: 600;
}

.stile {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #fff;
}

.stile svg {
  width: 16px;
  height: 16px;
}

.stile.gray {
  background: var(--ui-muted);
}

.stile.green {
  background: var(--ui-line);
}

.stile.blue {
  background: var(--ui-messenger);
}

.stile.indigo {
  background: var(--ui-indigo);
}

.stile.orange {
  background: var(--ui-orange);
}

.sdot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-left: auto;
  border-radius: 50%;
  background: var(--ui-green);
}

.sdot.warn {
  background: var(--ui-orange);
}

.sdot.bad {
  background: var(--ui-red);
}

@media (max-width: 1024px) {
  .srail {
    position: static;
    display: flex;
    gap: 4px;
    padding: 6px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .srail::-webkit-scrollbar {
    display: none;
  }

  .srail-label {
    display: none;
  }

  .sitem {
    flex: none;
  }

  .sdot {
    margin-left: 2px;
  }
}
</style>
