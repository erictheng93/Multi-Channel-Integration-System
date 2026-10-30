<template>
  <!-- Signed-in users get the app shell; the 404 route is public, so signed-out visitors get a bare page -->
  <component
    :is="isAuthenticated ? AppLayout : 'div'"
    :class="{ 'bare-shell': !isAuthenticated }"
  >
    <div class="ui-page not-found-page">
      <section class="nf">
        <div class="code-wrap">
          <DiscRing
            class="hero-disc"
            tone="accent"
            :size="190"
            :weight="1.4"
            fade="strong"
            :grain="false"
          />
          <div class="code">
            4<span>0</span>4
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
        </div>

        <div
          v-if="links.length > 0"
          class="list"
        >
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
            <div>
              <b>{{ link.title }}</b>
              <small>{{ link.text }}</small>
            </div>
          </router-link>
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
import DiscRing from '@/components/ui/DiscRing.vue'
import { computed } from 'vue'
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
    text: 'LINE 與 Messenger 客戶訊息',
    tone: 'blue',
    icon: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"/>'
  },
  {
    to: '/notifications',
    title: '通知',
    text: '指派、提及與系統提醒',
    tone: 'blue',
    icon: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'
  },
  {
    to: '/tags',
    title: '客戶標籤',
    text: '分類與客戶經營',
    tone: 'orange',
    icon: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r="1.2"/>'
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

/* The rings live in the numerals' own box, so they can never reach the sentence below */
.code-wrap {
  position: relative;
  display: grid;
  place-items: center;
  padding: 8px 80px;
}

.code {
  position: relative;
  font: 600 160px / 1 var(--ui-font-display);
  letter-spacing: -0.05em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.code span {
  color: var(--ui-accent);
}

.hero-disc {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 320px !important;
  height: 320px !important;
  translate: -50% -50%;
  opacity: 0.8;
  pointer-events: none;
}

.nf-title {
  margin: 18px 0 0;
  font: 700 34px/1.2 var(--ui-font-display);
  letter-spacing: -0.035em;
}

.nf-reason {
  max-width: 38ch;
  margin: 8px 0 0;
  font-size: 15px;
  color: var(--ui-muted);
  text-wrap: balance;
}

.asked {
  display: flex;
  gap: 10px;
  align-items: center;
  width: min(100%, 420px);
  margin-top: 18px;
  padding: 12px 14px;
  font-size: 13px;
  background: var(--ui-fill);
}

.asked .k {
  flex: none;
  color: var(--ui-ink-2);
}

.asked .mono {
  min-width: 0;
  overflow: hidden;
  font-family: var(--ui-font-mono);
  font-weight: 500;
  color: var(--ui-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Compact shortcut tiles: 4 across on desktop, 2 x 2 on phone */
.list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
  margin-top: 28px;
}

.go {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 16px;
  border-radius: 18px;
  background: var(--ui-surface);
  color: inherit;
  text-align: left;
  text-decoration: none;
  transition: background var(--ui-dur) var(--ui-ease);
}

.go:hover {
  background: var(--ui-surface-2);
}

.go:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
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
  background: var(--ui-blue);
}

.go-ico.orange {
  background: var(--ui-orange);
}

.go-ico.indigo {
  background: var(--ui-indigo);
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
  justify-content: center;
  margin-top: 28px;
}

@media (max-width: 768px) {
  .list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .nf-actions {
    width: 100%;
  }

  .nf-actions > .btn {
    flex: 1 1 0;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .code {
    font-size: 96px;
  }

  .code-wrap {
    padding: 8px 40px;
  }

  .hero-disc {
    width: 200px !important;
    height: 200px !important;
  }

  .asked {
    flex-wrap: wrap;
  }
}
</style>
