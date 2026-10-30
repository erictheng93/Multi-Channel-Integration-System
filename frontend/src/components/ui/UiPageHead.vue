<!--
  UiPageHead.vue

  The one page header. Every routed page renders exactly one, as the first child of its
  `.ui-page` root, so the title and the content start at the same x/y everywhere.

    <div class="ui-page">
      <UiPageHead title="對話" subtitle="LINE 與 Messenger 的客戶對話" >
        <template #actions>
          <button class="btn btn-primary">新增</button>
        </template>
      </UiPageHead>
      ...page body...
    </div>

  Rules the component enforces (see ROUND2 section 1):
  - Title row is 36px; the actions sit on that row's vertical centre (36px controls).
  - The subtitle is ONE line (ellipsis, full text in the `title` attribute) and its line is
    always reserved, so a late-loading or missing subtitle never shifts the content.
  - No eyebrow: the breadcrumb in the top bar already names the section.
  - Below 768px the actions drop under the subtitle as one wrapping row.

  The title row starts with a 40px icon tile: the page's nav glyph, white on the section hue
  (--section-hue, set by AppLayout from the route). Title is 34px / 700 (28px on phone).

  Props
    tile      false hides the icon tile (default true)
    title     page name; must equal the nav label / route meta.title (one name per concept)
    subtitle  one line of context. Keep it under ~60 characters; put detail in a tooltip.

  Slots
    title     replaces the title text (e.g. the dashboard greeting); still rendered in the h1
    subtitle  rich subtitle; also pass the `subtitle` prop (plain text) so the full text is
              available in the title attribute
    actions   buttons / pills / switches (right-aligned on the title row)
-->

<template>
  <header class="ui-page-head">
    <h1 class="ui-page-title">
      <span
        v-if="icon"
        class="ui-page-ico"
        aria-hidden="true"
      >
        <component :is="icon" />
      </span>
      <!-- Phone, section pages (報表 / 資料管理 / 系統設定): the title IS the section switcher,
           an iOS large-title menu. Elsewhere the title is plain text. -->
      <span
        v-if="switcherItems.length > 1"
        ref="pull"
        class="ui-page-switch"
      >
        <button
          type="button"
          class="ui-page-switch-btn"
          :aria-label="`${title}，切換${sectionLabel}分頁`"
          aria-haspopup="true"
          :aria-expanded="menuOpen"
          :aria-controls="menuId"
          @click="menuOpen = !menuOpen"
          @keydown.esc="closeMenu(true)"
        >
          <span class="ui-page-title-text"><slot name="title">{{ title }}</slot></span>
          <span
            class="ui-page-switch-chev"
            :class="{ 'is-open': menuOpen }"
            aria-hidden="true"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><path d="m2.5 4.5 3.5 3.5 3.5-3.5" /></svg>
          </span>
        </button>
        <ul
          v-if="menuOpen"
          :id="menuId"
          class="ui-page-switch-menu"
          @keydown.esc="closeMenu(true)"
        >
          <li
            v-for="item in switcherItems"
            :key="item.path"
          >
            <router-link
              :to="item.path"
              :aria-current="item.path === route.path ? 'page' : undefined"
              :class="{ 'is-on': item.path === route.path }"
              @click="closeMenu(false)"
            >
              <span>{{ item.label }}</span>
              <svg
                v-if="item.path === route.path"
                class="ui-page-switch-check"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><path d="m5 12.5 4.5 4.5L19 7" /></svg>
            </router-link>
          </li>
        </ul>
      </span>
      <span
        v-else
        class="ui-page-title-text"
      ><slot name="title">{{ title }}</slot></span>
    </h1>
    <div
      v-if="$slots.actions"
      class="ui-page-actions"
    >
      <slot name="actions" />
    </div>
    <p
      class="ui-page-sub"
      :title="subtitle || undefined"
    >
      <slot name="subtitle">
        {{ subtitle }}
      </slot>
    </p>
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getActivePinia } from 'pinia'
import { navIconForPath } from '@/config/nav-icons'
import { useAuthStore } from '@/stores/auth'
import { SECTION_NAV, sectionNavItems, sectionNavKeyForPath } from '@/config/section-nav'

const props = withDefaults(defineProps<{
  title?: string
  subtitle?: string
  /** Show the section icon tile (default). Pass false for a page that must not wear one. */
  tile?: boolean
}>(), {
  title: '',
  subtitle: '',
  tile: true,
})

// The tile is the page's own nav glyph on the section hue (config/nav-icons.ts + nav-sections.ts)
const route = useRoute()
const icon = computed(() => (props.tile ? navIconForPath(route?.path ?? '') : undefined))

// Phone section switcher (see the template). Outside an app with pinia (isolated component
// tests) nobody is an admin.
const authStore = getActivePinia() ? useAuthStore() : null
const sectionKey = computed(() => sectionNavKeyForPath(route?.path ?? ''))
const isPhone = ref(false)
const switcherItems = computed(() =>
  isPhone.value && sectionKey.value
    ? sectionNavItems(sectionKey.value, authStore?.currentAgent?.role === 'admin')
    : [],
)
const sectionLabel = computed(() => (sectionKey.value ? SECTION_NAV[sectionKey.value].label : ''))

const menuOpen = ref(false)
const menuId = 'ui-page-switch-menu'
const pull = ref<HTMLElement | null>(null)
const closeMenu = (refocus: boolean) => {
  menuOpen.value = false
  if (refocus) { pull.value?.querySelector<HTMLElement>('button')?.focus() }
}
const onDocPointer = (e: Event) => {
  if (menuOpen.value && pull.value && !pull.value.contains(e.target as globalThis.Node)) { menuOpen.value = false }
}
let mq: globalThis.MediaQueryList | null = null
const onMq = () => { isPhone.value = !!mq?.matches }
onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer)
  if (typeof window.matchMedia === 'function') {
    mq = window.matchMedia('(max-width: 768px)')
    onMq()
    mq.addEventListener('change', onMq)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer)
  mq?.removeEventListener('change', onMq)
})
watch(() => route?.path, () => { menuOpen.value = false })
</script>

<style scoped>
.ui-page-switch {
  position: relative;
  min-width: 0;
}

.ui-page-switch-btn {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  max-width: 100%;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  cursor: pointer;
}

.ui-page-switch-btn:focus-visible,
.ui-page-switch-menu a:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
  border-radius: 8px;
}

/* iOS large-title menu: a small tinted chevron disc trails the title */
.ui-page-switch-chev {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--ui-fill);
  color: var(--ui-ink-2);
  transition: transform 200ms ease-out;
}

.ui-page-switch-chev.is-open {
  transform: rotate(180deg);
}

.ui-page-switch-menu {
  position: absolute;
  z-index: 30;
  top: calc(100% + 6px);
  left: 0;
  width: min(280px, calc(100vw - 2 * var(--ui-gutter, 16px)));
  margin: 0;
  padding: 6px 0;
  list-style: none;
  border-radius: 16px;
  background: var(--ui-glass);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  box-shadow: 0 16px 40px rgb(0 0 0 / 0.18), 0 0 0 0.5px var(--ui-sep);
  transform-origin: 24px 0;
  animation: ui-page-switch-in 180ms var(--ui-ease);
  font: 400 16px / 1.4 var(--ui-font-ui);
  letter-spacing: 0;
}

.ui-page-switch-menu li + li {
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
  margin: 0 16px;
}

.ui-page-switch-menu a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 46px;
  margin: 0 -16px;
  padding: 0 16px;
  color: var(--ui-ink);
  text-decoration: none;
}

.ui-page-switch-menu a.is-on {
  color: var(--section-ink, var(--ui-accent));
  font-weight: 600;
}

@keyframes ui-page-switch-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-page-switch-menu {
    animation: none;
  }
}
</style>
