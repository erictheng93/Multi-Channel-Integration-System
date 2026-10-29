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
    :class="{ 'is-overflowing': overflowing }"
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

    <!-- Phone: iOS-style pull-down. One full-width button naming the current section; the rest in a menu -->
    <div
      ref="pull"
      class="ui-section-pull"
    >
      <button
        type="button"
        class="ui-section-pull-btn"
        aria-haspopup="true"
        :aria-expanded="menuOpen"
        :aria-controls="menuId"
        @click="menuOpen = !menuOpen"
        @keydown.esc="closeMenu(true)"
      >
        <span class="ui-section-pull-label">{{ activeLabel }}</span>
        <svg
          class="ui-section-pull-chev"
          :class="{ 'is-open': menuOpen }"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <ul
        v-if="menuOpen"
        :id="menuId"
        class="ui-section-pull-menu"
        @keydown.esc="closeMenu(true)"
      >
        <li
          v-for="item in items"
          :key="item.path"
        >
          <router-link
            :to="item.path"
            :aria-current="isActive(item.path) ? 'page' : undefined"
            :class="{ 'is-on': isActive(item.path) }"
            @click="closeMenu(false)"
          >
            {{ item.label }}
          </router-link>
        </li>
      </ul>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const activeLabel = computed(() => items.value.find(i => isActive(i.path))?.label ?? items.value[0]?.label ?? '')

// Phone pull-down
const menuOpen = ref(false)
const menuId = `ui-section-menu-${props.section}`
const pull = ref<HTMLElement | null>(null)
const closeMenu = (refocus: boolean) => {
  menuOpen.value = false
  if (refocus) { pull.value?.querySelector<HTMLElement>('button')?.focus() }
}
const onDocPointer = (e: Event) => {
  if (menuOpen.value && pull.value && !pull.value.contains(e.target as globalThis.Node)) { menuOpen.value = false }
}
onMounted(() => document.addEventListener('pointerdown', onDocPointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer))
watch(() => route.path, () => { menuOpen.value = false })

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

// The fade only means something when the row actually scrolls
const overflowing = ref(false)
const measure = () => {
  const box = track.value
  overflowing.value = !!box && box.scrollWidth > box.clientWidth + 1
}
let observer: globalThis.ResizeObserver | null = null
onMounted(() => {
  measure()
  if (track.value && typeof window.ResizeObserver !== 'undefined') {
    observer = new window.ResizeObserver(measure)
    observer.observe(track.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.ui-section-nav {
  display: none;
  position: relative;
  min-width: 0;
}

/* Edge fade: tells the user the row scrolls, without clipping a label (only when it does scroll) */
.ui-section-nav.is-overflowing::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 44px;
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
  /* Segments share the width evenly when they fit; when they don't, they keep their size and scroll */
  flex: 1 0 auto;
  justify-content: center;
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

/* Phone: the segmented track is replaced by a pull-down (full-width button + menu) */
.ui-section-pull {
  display: none;
}

@media (max-width: 768px) {
  .ui-section-nav-track,
  .ui-section-nav.is-overflowing::after {
    display: none;
  }

  .ui-section-pull {
    display: block;
    position: relative;
  }

  .ui-section-pull-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: 12px;
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow-pill), inset 0 0 0 1px var(--ui-field-edge);
    color: var(--ui-ink);
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }

  .ui-section-pull-btn:focus-visible,
  .ui-section-pull-menu a:focus-visible {
    outline: 2px solid var(--ui-accent);
    outline-offset: 2px;
  }

  .ui-section-pull-chev {
    color: var(--ui-ink-2);
    transition: transform 200ms ease-out;
  }

  .ui-section-pull-chev.is-open {
    transform: rotate(180deg);
  }

  .ui-section-pull-menu {
    position: absolute;
    z-index: 30;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 6px;
    list-style: none;
    border-radius: 14px;
    background: var(--ui-surface);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.16), inset 0 0 0 1px var(--ui-sep);
  }

  .ui-section-pull-menu a {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 9px;
    color: var(--ui-ink);
    font-size: 15px;
    text-decoration: none;
  }

  .ui-section-pull-menu a.is-on {
    background: var(--ui-sel-bg);
    font-weight: 600;
  }
}
</style>
