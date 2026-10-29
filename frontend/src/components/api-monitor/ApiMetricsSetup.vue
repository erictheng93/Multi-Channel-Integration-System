<!--
  ApiMetricsSetup.vue

  Shown instead of the endpoint list while metrics.configured is false: reading per-endpoint metrics
  needs two Worker secrets (summary of docs/operations/API_METRICS_SETUP.md). When configured but the
  last query failed, `error` explains it and the same steps help to fix it.
-->

<template>
  <article class="ui-card setup">
    <div class="setup-head">
      <span
        class="setup-ico"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></svg>
      </span>
      <div>
        <h2 class="setup-title">
          {{ error ? '無法讀取端點指標' : '尚未設定 Analytics Engine 權杖' }}
        </h2>
        <p class="setup-sub">
          {{ error
            ? `查詢 Analytics Engine 失敗：${error}`
            : '端點的請求數、P50 / P95 延遲、成功率與狀態碼分布來自 Workers Analytics Engine。寫入不需設定；讀取需要兩個 Worker secrets，設定前這裡不會顯示任何數字。' }}
        </p>
      </div>
    </div>

    <ol class="steps">
      <li>
        <b>建立 API 權杖</b>
        <span>Cloudflare 控制台 &gt; My Profile &gt; API Tokens &gt; Create Custom Token，權限只給「Account | Account Analytics | Read」，並限定在正式環境帳號。</span>
      </li>
      <li>
        <b>設定兩個 secrets</b>
        <span>
          執行 <code>wrangler secret put CF_ACCOUNT_ID</code> 與 <code>wrangler secret put CF_ANALYTICS_TOKEN</code>。
        </span>
      </li>
      <li>
        <b>重新部署 Worker</b>
        <span>Secrets 要到下一個 Worker 版本才生效；部署後按「重新整理」，資料約需數秒到一分鐘出現。</span>
      </li>
    </ol>

    <p class="setup-note">
      完整步驟見 <code>docs/operations/API_METRICS_SETUP.md</code>。指標涵蓋最近一小時並快取 60 秒，保留 3 個月；本機 <code>wrangler dev</code> 不會寫入指標。
    </p>
  </article>
</template>

<script setup lang="ts">
defineProps<{
  /** Query failure reported by the server while the metrics are configured */
  error?: string | null
}>()
</script>

<style scoped>
.setup {
  padding: 24px 22px 22px;
}

.setup-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.setup-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 15px;
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.setup-ico svg {
  width: 24px;
  height: 24px;
}

.setup-title {
  margin: 0;
  font: 600 18px / 1.3 var(--ui-font-display);
  letter-spacing: -0.015em;
}

.setup-sub {
  max-width: 62ch;
  margin: 4px 0 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--ui-muted);
}

.steps {
  display: grid;
  gap: 4px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
  counter-reset: step;
}

.steps li {
  position: relative;
  display: grid;
  gap: 2px;
  padding: 10px 0 10px 40px;
  counter-increment: step;
}

.steps li::before {
  content: counter(step);
  position: absolute;
  top: 10px;
  left: 0;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--ui-fill);
  font: 600 13px var(--ui-font-display);
  color: var(--ui-ink-2);
}

.steps b {
  font-size: 14px;
}

.steps span {
  font-size: 13px;
  line-height: 1.55;
  color: var(--ui-muted);
}

code {
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--ui-fill);
  font: 12px var(--ui-font-mono);
  color: var(--ui-ink-2);
  overflow-wrap: anywhere;
}

.setup-note {
  margin: 12px 0 0;
  padding: 12px 14px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
  font-size: 13px;
  line-height: 1.6;
  color: var(--ui-muted);
}
</style>
