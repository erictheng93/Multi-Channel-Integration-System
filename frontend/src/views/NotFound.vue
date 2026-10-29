<template>
  <!-- Signed-in users get the app shell; the 404 route is public, so signed-out visitors get a bare page -->
  <component
    :is="isAuthenticated ? AppLayout : 'div'"
    :class="{ 'bare-shell': !isAuthenticated }"
  >
    <div class="ui-page not-found-page">
      <UiPageHead
        title="找不到這個頁面"
        :subtitle="headSubtitle"
      >
        <template #actions>
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
        </template>
      </UiPageHead>

      <section
        class="nf"
        :class="{ single: links.length === 0 }"
      >
        <article class="ui-card hero">
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
          <p>可能原因：網址輸入有誤、頁面已被移除，或你沒有權限查看。</p>
          <div class="asked ui-well">
            <span class="k">你開啟的網址</span>
            <span
              class="mono"
              :title="route.fullPath"
            >{{ route.fullPath }}</span>
          </div>
        </article>

        <article
          v-if="links.length > 0"
          class="ui-card"
        >
          <div class="ui-card-head">
            <div>
              <h2 class="ui-card-title">
                常用頁面
              </h2>
              <div class="ui-card-sub">
                直接前往工作台的主要區域
              </div>
            </div>
          </div>
          <div class="list">
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
              <svg
                class="chev"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><path d="m9 18 6-6-6-6" /></svg>
            </router-link>
          </div>
        </article>
      </section>
    </div>
  </component>
</template>

<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
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
    tone: 'green',
    icon: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"/>'
  },
  {
    to: '/notifications',
    title: '通知',
    text: '指派、提及與系統提醒',
    tone: 'orange',
    icon: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'
  },
  {
    to: '/tags',
    title: '客戶標籤',
    text: '分類與客戶經營',
    tone: 'indigo',
    icon: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r="1.2"/>'
  },
  {
    to: '/settings',
    title: '系統設定',
    text: '整合、備份與健康檢查',
    tone: 'blue',
    icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    adminOnly: true
  }
]

/** Only pages this user can open (admin-only pages would bounce a non-admin to the dashboard); none when signed out. */
const links = computed(() =>
  isAuthenticated.value ? QUICK_LINKS.filter(link => !link.adminOnly || isAdmin.value) : []
)

const headSubtitle = computed(() =>
  `抱歉，您要找的頁面不存在或已被移除。${links.value.length > 0 ? '可以從下方常用頁面繼續。' : ''}`)

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
  min-height: 100vh;
  min-height: 100dvh;
  padding: 32px 20px;
  background: var(--ui-canvas);
}

.ico {
  width: 16px;
  height: 16px;
}

.nf {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 16px;
}

.nf.single {
  grid-template-columns: minmax(0, 1fr);
}

.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 36px 32px 32px;
  overflow: hidden;
  text-align: center;
}

/* The rings live in the numerals' own box, so they can never reach the sentence below */
.code-wrap {
  position: relative;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
  padding: 8px 40px;
}

.code {
  position: relative;
  font: 300 128px / 1 var(--ui-font-display);
  letter-spacing: -0.05em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.code span {
  color: var(--ui-accent);
}

.hero p {
  max-width: 34ch;
  margin: 0;
  font-size: 14.5px;
  color: var(--ui-muted);
  text-wrap: balance;
}

.asked {
  width: min(100%, 420px);
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 10px;
  padding: 12px 14px;
  font-size: 13px;
}

.asked .k {
  flex: none;
  color: var(--ui-muted);
}

.asked .mono {
  min-width: 0;
  overflow: hidden;
  font-family: var(--ui-font-mono);
  color: var(--ui-ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-disc {
  position: absolute;
  top: 50%;
  left: 50%;
  translate: -50% -50%;
  opacity: 0.8;
  pointer-events: none;
}

.list {
  padding-bottom: 8px;
}

.go {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 22px;
  color: inherit;
  text-decoration: none;
  transition: background var(--ui-dur) var(--ui-ease);
}

.go + .go::before {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  left: 66px;
  height: 0.5px;
  background: var(--ui-sep);
}

.go:hover {
  background: color-mix(in srgb, var(--ui-fill) 45%, transparent);
}

.go:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.go-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
}

.go-ico svg {
  width: 16px;
  height: 16px;
}

.go-ico.blue {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.go-ico.green {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.go-ico.orange {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.go-ico.indigo {
  background: var(--ui-indigo-soft);
  color: var(--ui-indigo);
}

.go b {
  display: block;
  font-size: var(--ui-t-head);
  font-weight: 600;
}

.go small {
  font-size: 13px;
  color: var(--ui-muted);
}

.go .chev {
  width: 15px;
  height: 15px;
  margin-left: auto;
  color: var(--ui-faint);
}

@media (max-width: 1024px) {
  .nf {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 480px) {
  .code {
    font-size: 92px;
  }

  .hero {
    padding: 28px 22px 22px;
  }

  .asked {
    flex-wrap: wrap;
  }
}
</style>
