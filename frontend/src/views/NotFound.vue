<template>
  <!-- Signed-in users get the app shell; the 404 route is public, so signed-out visitors get a bare page -->
  <component
    :is="isAuthenticated ? AppLayout : 'div'"
    :class="{ 'bare-shell': !isAuthenticated }"
  >
    <div class="ui-page not-found-page">
      <section
        class="nf ui-lead"
        :class="{ 'is-solo': !isAuthenticated }"
      >
        <div class="nf-lead">
          <!-- The zero is a lost signal: a ring with a quiet echo inside. Decoration; the number is read as 404 -->
          <div
            class="code"
            role="img"
            aria-label="404"
          >
            <span aria-hidden="true">4</span>
            <svg
              class="zero"
              viewBox="0 0 100 124"
              aria-hidden="true"
              focusable="false"
            >
              <ellipse
                class="nf-ring r1"
                cx="50"
                cy="62"
                rx="52"
                ry="68"
              />
              <ellipse
                class="nf-ring r3"
                cx="50"
                cy="62"
                rx="42"
                ry="56"
              />
              <ellipse
                class="nf-ring r2"
                cx="50"
                cy="62"
                rx="24"
                ry="33"
              />
              <circle
                class="nf-dot"
                cx="50"
                cy="62"
                r="7"
              />
            </svg>
            <span aria-hidden="true">4</span>
          </div>
          <h1 class="nf-title">
            找不到這個頁面
          </h1>
          <p class="nf-reason">
            網址輸入有誤、頁面已被移除，或你沒有權限查看。
          </p>

          <!-- The address, taken apart: the parts that exist, and the first one that does not -->
          <div class="trace">
            <p class="trace-k">
              你開啟的網址
            </p>
            <div class="trace-bar">
              <code
                class="trace-path"
                :title="route.fullPath"
              ><template
                v-for="(seg, i) in trace.segments"
                :key="i"
              ><span class="trace-slash">/</span><span
                class="seg"
                :class="`is-${seg.state}`"
              >{{ seg.text }}</span></template><span
                v-if="trace.segments.length === 0"
                class="trace-slash"
              >/</span><span
                v-if="trace.extra"
                class="trace-extra"
              >{{ trace.extra }}</span></code>
              <button
                type="button"
                class="copy"
                :aria-label="copied ? '已複製網址' : '複製網址'"
                @click="copyUrl"
              >
                <svg
                  v-if="!copied"
                  class="ico"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                ><rect
                  x="9"
                  y="9"
                  width="11"
                  height="11"
                  rx="2.5"
                /><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" /></svg>
                <svg
                  v-else
                  class="ico"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                ><path d="m5 12.5 4.5 4.5L19 7" /></svg>
              </button>
            </div>
            <p
              v-if="trace.bad && trace.goodPrefix"
              class="trace-note"
            >
              「{{ trace.goodPrefix }}」存在，但底下沒有「{{ trace.bad }}」
            </p>
          </div>

          <router-link
            v-if="guess"
            :to="guess.path"
            class="guess"
          >
            <span class="guess-k">你是不是要找</span>
            <span class="guess-v">{{ guess.label }}<span class="guess-path">{{ guess.path }}</span></span>
            <svg
              class="ico"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="m9 6 6 6-6 6" /></svg>
          </router-link>

          <div class="nf-actions">
            <button
              type="button"
              class="btn btn-secondary"
              @click="goBack"
            >
              <svg
                class="ico"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
              返回上頁
            </button>
            <router-link
              :to="homePath"
              class="btn btn-primary"
            >
              <svg
                class="ico"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>
              {{ isAuthenticated ? '回到儀表板' : '前往登入' }}
            </router-link>
          </div>
        </div>

        <!-- Every page you may open, in the sidebar's order (the icon's tint is its section); type to narrow, Enter opens the first -->
        <div
          v-if="isAuthenticated"
          class="nf-find"
        >
          <div
            v-if="recents.length > 0 && query.trim() === ''"
            class="recent"
          >
            <h2 class="find-label">
              最近造訪
            </h2>
            <ul class="recent-list">
              <li
                v-for="page in recents"
                :key="page.path"
              >
                <router-link
                  :to="page.path"
                  class="find-item"
                >
                  <span
                    class="find-ico"
                    aria-hidden="true"
                  >
                    <component :is="page.icon" />
                  </span>
                  <span class="find-name">{{ page.label }}</span>
                  <svg
                    class="ico recent-go"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  ><path d="m9 6 6 6-6 6" /></svg>
                </router-link>
              </li>
            </ul>
          </div>
          <label
            class="find-label"
            for="nf-search"
          >要去哪裡？</label>
          <input
            id="nf-search"
            v-model="query"
            type="search"
            class="ui-input find-input"
            placeholder="輸入頁面名稱，例如「標籤」"
            autocomplete="off"
            @keydown.enter.prevent="openFirst"
          >
          <ul
            v-if="shownPages.length > 0"
            class="find-list"
          >
            <li
              v-for="page in shownPages"
              :key="page.path"
            >
              <router-link
                :to="page.path"
                class="find-item"
                :class="`tone-${page.tone}`"
              >
                <span
                  class="find-ico"
                  aria-hidden="true"
                >
                  <component :is="page.icon" />
                </span>
                <span class="find-name">{{ page.label }}</span>
              </router-link>
            </li>
          </ul>
          <button
            v-if="canExpand"
            type="button"
            class="find-more"
            @click="showAll = true"
          >
            顯示全部 {{ allowed.length }} 個頁面
          </button>
          <p
            v-if="shownPages.length === 0"
            class="find-empty"
            role="status"
          >
            沒有符合「{{ query.trim() }}」的頁面
          </p>
          <p class="find-note">
            看不到想找的頁面？可能是你的帳號沒有權限，請聯絡管理員開通。
          </p>
        </div>
      </section>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppLayout from '@/components/ui/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { NAV_SECTIONS, sectionForPath, type SectionId } from '@/config/nav-sections'
import { NAV_ICONS } from '@/config/nav-icons'
import { SECTION_NAV } from '@/config/section-nav'
import { readRecentPaths } from '@/utils/recent-pages'

interface Page {
  path: string
  label: string
  icon: Component
  adminOnly: boolean
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { isAuthenticated, isAdmin } = storeToRefs(authStore)

// The same destinations the sidebar offers (admin-only ones are for admins only: a non-admin would bounce to the dashboard)
const PAGES: readonly Page[] = [
  { path: '/dashboard', label: '儀表板', adminOnly: false },
  { path: '/conversations', label: '對話', adminOnly: false },
  { path: '/notifications', label: '通知', adminOnly: false },
  { path: '/tags', label: '客戶標籤', adminOnly: false },
  { path: '/broadcasts', label: '群發訊息', adminOnly: false },
  { path: '/auto-reply', label: '自動回覆', adminOnly: true },
  { path: '/reports', label: SECTION_NAV.reports.label, adminOnly: false },
  { path: '/team', label: '團隊成員', adminOnly: true },
  { path: '/channels', label: '頻道', adminOnly: true },
  { path: '/activities', label: '活動記錄', adminOnly: true },
  { path: '/data', label: SECTION_NAV.data.label, adminOnly: false },
  { path: '/monitoring/api', label: 'API 監控', adminOnly: true },
  { path: '/monitoring/websocket', label: '即時連線監控', adminOnly: true },
  { path: '/settings', label: SECTION_NAV.settings.label, adminOnly: true }
].map(p => ({ ...p, icon: NAV_ICONS[p.path] as Component }))

const allowed = computed(() => PAGES.filter(p => !p.adminOnly || isAdmin.value))

// Sub-pages are only used to guess what a mistyped address meant
const GUESS_TARGETS = computed(() => [
  ...allowed.value.map(p => ({ path: p.path, label: p.label })),
  ...(Object.values(SECTION_NAV)).flatMap(section =>
    section.items.filter(i => !i.adminOnly || isAdmin.value).map(i => ({ path: i.path, label: i.label }))
  ).filter(i => isAdmin.value || !i.path.startsWith('/settings'))
])

// ---- the address, taken apart ----
type SegState = 'ok' | 'bad' | 'rest'

const unknown = (path: string): boolean => {
  const matched = router.resolve(path).matched
  return matched.length === 0 || matched.some(m => m.name === 'NotFound')
}

const trace = computed(() => {
  const parts = route.path.split('/').filter(Boolean)
  const decode = (s: string): string => { try { return decodeURIComponent(s) } catch { return s } }
  let acc = ''
  let badAt = -1
  parts.forEach((part, i) => {
    acc += `/${part}`
    if (badAt < 0 && unknown(acc)) { badAt = i }
  })
  const segments = parts.map((part, i) => ({
    text: decode(part),
    state: (badAt < 0 || i < badAt ? 'ok' : i === badAt ? 'bad' : 'rest') as SegState
  }))
  return {
    segments,
    badAt,
    bad: badAt >= 0 ? decode(parts[badAt] ?? '') : '',
    goodPrefix: badAt > 0 ? `/${parts.slice(0, badAt).map(decode).join('/')}` : '',
    extra: route.fullPath.slice(route.path.length)
  }
})

const distance = (a: string, b: string): number => {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] ?? 0
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j] ?? 0
      prev[j] = Math.min(up + 1, (prev[j - 1] ?? 0) + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return prev[b.length] ?? 0
}

// The closest real page for the first part that does not exist (a typo, a missing "s"); nothing when nothing is close
const guess = computed(() => {
  const { bad, badAt, goodPrefix } = trace.value
  if (!bad || !isAuthenticated.value) { return null }
  const want = bad.toLowerCase()
  const limit = Math.max(2, Math.floor(want.length / 3))
  let best: { path: string; label: string; d: number } | null = null
  for (const target of GUESS_TARGETS.value) {
    const parts = target.path.split('/').filter(Boolean)
    if (parts.length !== badAt + 1 || (goodPrefix && !target.path.startsWith(`${goodPrefix}/`))) { continue }
    const d = distance(want, (parts[badAt] ?? '').toLowerCase())
    if (d <= limit && d < want.length && (!best || d < best.d)) { best = { ...target, d } }
  }
  return best
})

// ---- the finder ----
const query = ref('')

// The last pages this browser opened: each resolves to the closest known page (a conversation counts as 對話), up to three
const recents = computed(() => {
  const out: Page[] = []
  for (const raw of readRecentPaths()) {
    const hit = allowed.value
      .filter(p => raw === p.path || raw.startsWith(`${p.path}/`))
      .sort((a, b) => b.path.length - a.path.length)[0]
    if (hit && !out.some(o => o.path === hit.path) && hit.path !== route.path) { out.push(hit) }
    if (out.length === 3) { break }
  }
  return out
})

// A 404 is not a second sidebar: the six pages people open most are offered, the rest are one tap or one word away
const FIRST_PAGES = ['/dashboard', '/conversations', '/notifications', '/tags', '/broadcasts', '/reports']
// Every width starts with the six: the full list is the sidebar's job, here it is one tap away
const showAll = ref(false)
const canExpand = computed(() => query.value.trim() === '' && !showAll.value && allowed.value.length > FIRST_PAGES.length)

// One flat list in the sidebar's order; typing searches every page
const shownPages = computed(() => {
  const q = query.value.trim().toLowerCase()
  const narrow = q === '' && !showAll.value
  const match = (p: Page): boolean => q === ''
    ? !narrow || FIRST_PAGES.includes(p.path)
    : p.label.toLowerCase().includes(q) || p.path.toLowerCase().includes(q)
  return NAV_SECTIONS.flatMap(section =>
    allowed.value
      .filter(p => sectionForPath(p.path)?.id === section.id && match(p))
      .map(p => ({ ...p, tone: section.id as SectionId }))
  )
})

const openFirst = (): void => {
  const first = shownPages.value[0]
  if (first) { void router.push(first.path) }
}

const homePath = computed(() => (isAuthenticated.value ? '/dashboard' : '/login'))

// Copy the address that was asked for (handy for a bug report); the icon confirms for 1.6 s
const copied = ref(false)
const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${route.fullPath}`)
    copied.value = true
    window.setTimeout(() => { copied.value = false }, 1600)
  } catch {
    copied.value = false
  }
}

const goBack = () => {
  if (window.history.length > 1) {
    router.go(-1)
  } else {
    void router.push(homePath.value)
  }
}
</script>

<style scoped>
.bare-shell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 32px 20px;
  background: var(--ui-canvas);
}

.ico {
  width: 16px;
  height: 16px;
}

/* One card, vertically centred in the viewport */
.not-found-page {
  display: flex;
  flex: none;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100vh - var(--ui-topbar-h) - 2 * var(--ui-gutter));
  min-height: calc(100dvh - var(--ui-topbar-h) - 2 * var(--ui-gutter));
}

.bare-shell .not-found-page {
  min-height: 0;
}

.nf {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  /* never squeezed by the centring column: the whole card is reachable by scrolling */
  flex: none;
  overflow: hidden;
}

.nf.is-solo {
  max-width: 480px;
}

.nf-lead {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding: 36px 32px 32px;
}

.nf-find {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 28px 24px 24px;
  background: var(--ui-surface);
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

@media (min-width: 1025px) {
  .nf:not(.is-solo) {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  }

  .nf-lead {
    padding: 44px 44px 40px;
  }

  .nf-find {
    justify-content: center;
    padding: 36px 32px 32px;
    box-shadow: inset 0.5px 0 0 var(--ui-sep);
  }
}

/* ---- the numeral: quiet, so the headline leads ---- */
.code {
  display: flex;
  gap: 0.04em;
  align-items: center;
  font: 600 88px / 1 var(--ui-font-display);
  letter-spacing: -0.04em;
  color: var(--ui-ink);
}

.zero {
  width: 0.6em;
  height: 0.745em;
  margin: 0 0.16em;
  overflow: visible;
}

.nf-ring {
  fill: none;
  stroke: var(--ui-blue);
  transform-origin: 50px 62px;
}

.nf-ring.r3 {
  stroke-width: 13;
}

.nf-ring.r2 {
  stroke-width: 3;
  opacity: 0.4;
}

.nf-ring.r1 {
  stroke-width: 2;
  opacity: 0.18;
}

.nf-dot {
  fill: var(--ui-blue);
}

/* The echo goes out once on arrival and settles; nothing loops */
@media (prefers-reduced-motion: no-preference) {
  .nf-ring.r2 {
    animation: nf-ping 900ms var(--ui-ease) 150ms both;
  }

  .nf-ring.r1 {
    animation: nf-ping 1100ms var(--ui-ease) 300ms both;
  }
}

@keyframes nf-ping {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}

.nf-title {
  margin: 20px 0 0;
  font: 700 30px/1.2 var(--ui-font-display);
  letter-spacing: -0.035em;
}

.nf-reason {
  margin: 6px 0 0;
  font-size: 15px;
  color: var(--ui-ink-2);
}

/* ---- the address, taken apart ---- */
.trace {
  margin-top: 24px;
}

.trace-k {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.trace-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 10px 10px 16px;
  border-radius: 14px;
  background: var(--ui-surface-2);
}

.trace-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font: 500 15px var(--ui-font-mono);
  color: var(--ui-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-slash {
  color: var(--ui-muted);
}

.seg.is-ok {
  color: var(--ui-green-ink);
}

.seg.is-bad {
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
  font-weight: 700;
}

.seg.is-rest {
  color: var(--ui-muted);
}

.trace-extra {
  color: var(--ui-muted);
}

.trace-note {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.copy {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ui-ink-2);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.copy:hover {
  background: var(--ui-fill);
}

.copy:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 1px;
}

/* ---- did you mean ---- */
.guess {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 14px;
  background: var(--ui-accent-soft);
  color: var(--ui-ink);
  text-decoration: none;
  transition: background var(--ui-dur) var(--ui-ease);
}

.guess:hover {
  background: color-mix(in srgb, var(--ui-accent) 16%, var(--ui-surface));
}

.guess:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.guess-k {
  flex: none;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.guess-v {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
}

.guess-path {
  margin-left: 8px;
  font: 500 13px var(--ui-font-mono);
  color: var(--ui-ink-2);
}

.guess .ico {
  flex: none;
  color: var(--ui-accent);
}

.nf-actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}

.nf-actions > .btn {
  flex: 1 1 0;
  justify-content: center;
}

/* ---- the finder ---- */
.find-label {
  font-size: 17px;
  font-weight: 700;
}

.find-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* an odd last tile takes the whole row, so no group ends with a hole beside it */
.find-list > li:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}

.find-item {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 46px;
  padding: 6px 12px 6px 8px;
  border-radius: 14px;
  background: var(--ui-surface-2);
  color: var(--ui-ink);
  text-decoration: none;
  transition: box-shadow var(--ui-dur) var(--ui-ease);
}

.find-item:hover {
  box-shadow: inset 0 0 0 1.5px var(--tone);
}

.find-item:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.find-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--tone) 14%, var(--ui-surface-2));
  color: color-mix(in srgb, var(--tone) 78%, #000);
}

.find-ico :deep(svg) {
  width: 17px;
  height: 17px;
}

.find-name {
  min-width: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
}

.recent-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.recent-go {
  flex: none;
  margin-left: auto;
  color: var(--ui-ink-2);
}

/* one calm hue for every destination: colour is not information here */
.find-item {
  --tone: var(--ui-accent);
}

.find-more {
  align-self: flex-start;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ui-accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.find-more:hover {
  background: var(--ui-accent-soft);
}

.find-empty {
  margin: 8px 4px;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.find-note {
  margin: 6px 4px 0;
  padding-top: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-ink-2);
}

@media (min-width: 1025px) {
  /* the card is the page: it fills the viewport, so there is no void above and below it */
  .nf:not(.is-solo) {
    min-height: calc(100dvh - var(--ui-topbar-h) - 2 * var(--ui-gutter));
  }

  .nf:not(.is-solo) .code {
    font-size: 176px;
  }

  .nf:not(.is-solo) .nf-title {
    margin-top: 28px;
    font-size: 34px;
  }

  .nf:not(.is-solo) .trace {
    margin-top: 32px;
  }
}

@media (max-width: 480px) {
  .code {
    font-size: 72px;
  }

  .nf-lead {
    padding: 28px 20px 24px;
  }

  .nf-title {
    font-size: 26px;
  }

  .guess {
    flex-wrap: wrap;
    gap: 2px 12px;
  }

  .guess-v {
    flex-basis: 100%;
    order: 3;
  }

  .guess .ico {
    margin-left: auto;
    order: 2;
  }
}

@media (max-width: 768px) {
  .nf-find {
    padding: 22px 16px 20px;
  }

  .find-item {
    min-height: 48px;
  }
}
</style>
