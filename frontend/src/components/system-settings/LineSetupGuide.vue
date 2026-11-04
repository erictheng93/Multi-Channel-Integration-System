<!--
  LineSetupGuide.vue
  Beside the LINE credentials: the three steps to switch the webhook on in LINE Developers.
  The webhook address itself is drawn on the incoming wire of the signal path (LineSignalPath).
  Static help, no invented status.
-->
<template>
  <section class="guide">
    <h2 class="ui-group-label">
      在 LINE Developers 啟用 Webhook
    </h2>
    <ol class="ui-group steps">
      <li
        v-for="step in STEPS"
        :key="step.title"
        class="step"
      >
        <span
          class="step-n"
          aria-hidden="true"
        />
        <div class="step-text">
          <div class="step-title">
            {{ step.title }}
          </div>
          <div class="step-hint">
            {{ step.hint }}
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
const STEPS = [
  { title: '複製 Webhook 網址', hint: '在上方「收訊」線路上，按右側的複製鈕' },
  { title: '貼到 Webhook URL，按「Verify」', hint: 'Messaging API 分頁的 Webhook settings，確認可連線' },
  { title: '開啟「Use webhook」', hint: '開啟後 LINE 才會把客戶訊息送進來' }
] as const
</script>

<style scoped>
.guide {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.steps {
  display: flex;
  flex: 1;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: step;
}

.step {
  display: flex;
  flex: 1;
  gap: 14px;
  align-items: center;
  padding: 14px 22px;
  counter-increment: step;
}

.step + .step {
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.step-n {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--ui-accent-soft);
  font: 700 17px var(--ui-font-display);
  color: var(--ui-accent);
}

.step-n::before {
  content: counter(step);
}

.step-title {
  font: 600 15px / 1.35 var(--ui-font-ui);
}

.step-hint {
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-muted);
}
</style>
