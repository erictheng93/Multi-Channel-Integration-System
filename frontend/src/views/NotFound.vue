<template>
  <!-- Signed-in users get the app shell; the 404 route is public, so signed-out visitors get a bare page -->
  <component
    :is="isAuthenticated ? AppLayout : 'div'"
    :class="{ 'bare-shell': !isAuthenticated }"
  >
    <div class="ui-page not-found-page">
      <section class="nf">
        <div class="code-wrap">
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
        </div>
        <h1 class="nf-title">
          找不到這個頁面
        </h1>
        <p class="nf-reason">
          可能原因：網址輸入有誤、頁面已被移除，或你沒有權限查看。
        </p>
        <div class="asked ui-well">
          <span class="k">你開啟的網址</span>
          <span
            class="mono"
            :title="route.fullPath"
          >{{ route.fullPath }}</span>
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

        <div
          v-if="links.length > 0"
          class="list-wrap"
        >
          <h2 class="list-label">
            常用的頁面
          </h2>
          <div class="list ui-group">
            <router-link
              v-for="link in links"
              :key="link.to"
              :to="link.to"
              class="go"
            >
              <span
                class="go-ico"
                :class="link.tone"
                aria-hidden="true"
              >
                <!-- eslint-disable vue/no-v-html -->
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  v-html="link.icon"
                />
              <!-- eslint-enable vue/no-v-html -->
              </span>
              <div class="go-text">
                <b>{{ link.title }}</b>
                <small>{{ link.text }}</small>
              </div>
              <svg
                class="go-chev"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><path d="m9 6 6 6-6 6" /></svg>
            </router-link>
          </div>
        </div>

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
      </section>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppLayout from '@/components/ui/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'

interface QuickLink {
  to: string
  title: string
  text: string
  tone: 'blue' | 'green' | 'orange' | 'indigo'
  /** Inner SVG markup, static */
  icon: string
  adminOnly?: boolean
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { isAuthenticated, isAdmin } = storeToRefs(authStore)

const QUICK_LINKS: QuickLink[] = [
  {
    to: '/conversations',
    title: '對話',
    text: 'LINE 與 Messenger 訊息',
    tone: 'blue',
    icon: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"/>'
  },
  {
    to: '/tags',
    title: '客戶標籤',
    text: '分類與客戶經營',
    tone: 'orange',
    icon: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r="1.2"/>'
  },
  {
    to: '/team',
    title: '團隊成員',
    text: '成員、角色與團隊',
    tone: 'green',
    icon: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.4-3.4 2.8-5.2 6-5.2s5.6 1.8 6 5.2"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.9c1.8.6 2.8 2.3 3 5.1"/>',
    adminOnly: true
  },
  {
    to: '/settings',
    title: '系統設定',
    text: '整合、備份與健康檢查',
    tone: 'indigo',
    icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    adminOnly: true
  }
]

/** Only pages this user can open (admin-only pages would bounce a non-admin to the dashboard); none when signed out. */
const links = computed(() =>
  isAuthenticated.value ? QUICK_LINKS.filter(link => !link.adminOnly || isAdmin.value) : []
)

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

/* One centred column, vertically centred in the viewport; nothing stretches */
.not-found-page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100vh - var(--ui-topbar-h) - 2 * var(--ui-gutter));
  min-height: calc(100dvh - var(--ui-topbar-h) - 2 * var(--ui-gutter));
}

.bare-shell .not-found-page {
  min-height: 0;
}

.nf {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  text-align: center;
}

.code-wrap {
  display: grid;
  place-items: center;
  padding: 8px 56px;
  border-radius: 999px;
  /* a quiet wash of the section blue behind the numeral gives the page a centre of gravity */
  background: radial-gradient(closest-side, color-mix(in srgb, var(--ui-blue) 9%, transparent), transparent);
}

.code {
  display: flex;
  gap: 0.04em;
  align-items: center;
  font: 500 132px / 1 var(--ui-font-display);
  letter-spacing: -0.05em;
  color: var(--ui-ink);
}

/* The zero is drawn, sized in the numerals' own em so it follows the font size at every width */
.zero {
  width: 0.6em;
  height: 0.745em;
  margin: 0 0.07em;
  overflow: visible;
}

.nf-ring {
  fill: none;
  stroke: var(--ui-blue);
  transform-origin: 50px 62px;
}

.nf-ring.r3 {
  stroke-width: 9;
}

.nf-ring.r2 {
  stroke-width: 3;
  opacity: 0.4;
}

.nf-dot {
  fill: var(--ui-blue);
}

/* The echo goes out once on arrival and settles; nothing loops */
@media (prefers-reduced-motion: no-preference) {
  .nf-ring.r2 {
    animation: nf-ping 900ms var(--ui-ease) 150ms both;
  }
}

@keyframes nf-ping {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}

.nf-title {
  margin: 22px 0 0;
  font: 700 34px/1.2 var(--ui-font-display);
  letter-spacing: -0.035em;
}

.nf-reason {
  max-width: 38ch;
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--ui-ink-2);
  text-wrap: balance;
}

.asked {
  display: flex;
  gap: 10px;
  align-items: center;
  width: min(100%, 460px);
  margin-top: 20px;
  padding: 12px 14px;
  font-size: 14px;
  background: var(--ui-surface);
}

.asked .k {
  flex: none;
  color: var(--ui-ink-2);
}

.copy {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  margin: -6px -6px -6px 0;
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

.asked .mono {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-align: left;
  font-family: var(--ui-font-mono);
  font-weight: 500;
  color: var(--ui-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Shortcuts: one inset-grouped list (iOS Settings), a row per destination */
.list-wrap {
  width: min(100%, 460px);
  margin-top: 28px;
  text-align: left;
}

.list-label {
  margin: 0 0 8px;
  padding: 0 6px 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.list {
  --row-inset: 66px;
}

.go {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 64px;
  padding: 10px 16px 10px 18px;
  color: inherit;
  text-decoration: none;
  transition: background var(--ui-dur) var(--ui-ease);
}

.go + .go::before {
  position: absolute;
  top: 0;
  right: 16px;
  left: 68px;
  height: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.go:hover {
  background: color-mix(in srgb, var(--ui-fill) 45%, transparent);
}

.go:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.go-text {
  flex: 1;
  min-width: 0;
}

.go-chev {
  flex: none;
  width: 16px;
  height: 16px;
  color: var(--ui-muted);
}

.go-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
}

.go-ico svg {
  width: 18px;
  height: 18px;
}

/* Solid section hue tile, white glyph (same language as the page-title tile and the sidebar sections) */
.go-ico {
  color: #fff;
}

.go-ico.blue {
  background: linear-gradient(180deg, color-mix(in srgb, var(--ui-blue) 82%, #fff), var(--ui-blue));
}

.go-ico.orange {
  background: linear-gradient(180deg, color-mix(in srgb, var(--ui-orange) 82%, #fff), var(--ui-orange));
}

.go-ico.green {
  background: linear-gradient(180deg, color-mix(in srgb, var(--ui-green) 82%, #fff), var(--ui-green));
}

.go-ico.indigo {
  background: linear-gradient(180deg, color-mix(in srgb, var(--ui-indigo) 82%, #fff), var(--ui-indigo));
}

.go b {
  display: block;
  font-size: var(--ui-t-head);
  font-weight: 600;
}

.go small {
  font-size: 13px;
  line-height: 1.4;
  color: var(--ui-muted);
}

.nf-actions {
  display: flex;
  gap: 10px;
  width: min(100%, 460px);
  margin-top: 20px;
}

.nf-actions > .btn {
  flex: 1 1 0;
  justify-content: center;
}

@media (max-width: 480px) {
  .code {
    font-size: 96px;
  }

  .asked {
    flex-wrap: wrap;
  }
}
</style>
