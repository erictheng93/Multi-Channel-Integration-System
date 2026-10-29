<!--
  UiSectionNav.vue

  The in-page fallback for sections whose children live in the sidebar (報表 / 資料管理 /
  系統設定). One navigation per section:
  - above 1024px the sidebar shows the children and this component renders nothing visible
  - at 1024px and below the sidebar is an icon rail or a drawer, so this segmented control
    appears under the page head. It scrolls horizontally with an edge fade and never clips
    a label mid-word.

    <UiPageHead ... />
    <UiSectionNav section="reports" />

  Names and order come from config/section-nav.ts (the same source as the sidebar).

  Props
    section  'reports' | 'data' | 'settings'
-->

<template>
  <nav
    class="ui-section-nav"
    :aria-label="SECTION_NAV[section].ariaLabel"
  >
    <div
      ref="track"
      class="ui-section-nav-track ui-seg"
    >
      <router-link
        v-for="item in items"
        :key="item.path"
        :to="item.path"
        :aria-current="isActive(item.path) ? 'page' : undefined"
        :class="{ 'is-on': isActive(item.path) }"
      >
        {{ item.label }}
      </router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { SECTION_NAV, sectionNavItems, type SectionNavKey } from '@/config/section-nav'

const props = defineProps<{
  section: SectionNavKey
}>()

const route = useRoute()
// Admin-only items (資料備份) are hidden from agents. Outside an app with pinia (isolated
// component tests) nobody is an admin.
const authStore = getActivePinia() ? useAuthStore() : null

const items = computed(() => sectionNavItems(props.section, authStore?.currentAgent?.role === 'admin'))

const isActive = (path: string): boolean => route.path === path

// Keep the active segment inside the scrolled row (only matters when the row overflows)
const track = ref<HTMLElement | null>(null)
const revealActive = async () => {
  await nextTick()
  const el = track.value?.querySelector<HTMLElement>('.is-on')
  if (!el || !track.value) { return }
  const box = track.value
  box.scrollLeft = Math.max(0, el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2)
}
onMounted(revealActive)
watch(() => route.path, revealActive)
</script>

<style scoped>
.ui-section-nav {
  display: none;
  position: relative;
  min-width: 0;
}

/* Edge fade: tells the user the row scrolls, without clipping a label */
.ui-section-nav::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 28px;
  border-radius: 0 10px 10px 0;
  background: linear-gradient(90deg, transparent, var(--ui-canvas));
  pointer-events: none;
}

.ui-section-nav-track {
  display: flex;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  scroll-snap-type: x proximity;
}

.ui-section-nav-track::-webkit-scrollbar {
  display: none;
}

.ui-section-nav-track > a {
  display: inline-flex;
  flex: none;
  align-items: center;
  height: 30px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink-2);
  text-decoration: none;
  white-space: nowrap;
  scroll-snap-align: start;
}

.ui-section-nav-track > a.is-on {
  background: var(--ui-sel-bg);
  color: var(--ui-ink);
  font-weight: 500;
  box-shadow: var(--ui-shadow-pill);
}

.ui-section-nav-track > a:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

@media (max-width: 1024px) {
  .ui-section-nav {
    display: block;
  }
}

@media (max-width: 768px) {
  .ui-section-nav-track > a {
    height: 36px;
  }
}
</style>
