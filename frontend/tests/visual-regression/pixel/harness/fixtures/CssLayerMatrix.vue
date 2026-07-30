<template>
  <!-- ---------------------------------------------------------------- cards -->
  <div
    v-if="mode === 'cards'"
    class="vrt-col"
    style="width: 100%"
  >
    <div
      class="card"
      style="width: 100%"
    >
      <div class="card-header">
        <h3 class="heading-3">
          團隊概況
        </h3>
        <button
          class="btn btn-ghost btn-sm"
          type="button"
        >
          檢視全部
        </button>
      </div>
      <div class="card-body">
        <p class="body-normal">
          這張卡片只使用 style.css 的 <code>.card</code> 系列類別，用來鎖定 @apply 展開結果。
        </p>
      </div>
      <div class="card-footer">
        <span class="caption">最後更新 2026-01-15 09:30</span>
      </div>
    </div>
  </div>

  <!-- --------------------------------------------------------------- badges -->
  <div
    v-else-if="mode === 'badges'"
    class="vrt-col"
  >
    <div class="vrt-row">
      <span class="badge badge-primary">Primary</span>
      <span class="badge badge-success">Success</span>
      <span class="badge badge-warning">Warning</span>
      <span class="badge badge-danger">Danger</span>
      <span class="badge badge-gray">Gray</span>
    </div>
    <div class="vrt-row">
      <span class="badge badge-line">LINE</span>
      <span class="badge badge-facebook">Facebook</span>
      <span class="badge badge-instagram">Instagram</span>
      <span class="badge badge-whatsapp">WhatsApp</span>
    </div>
    <div class="vrt-row">
      <span class="status-indicator"><span class="status-dot online" />在線</span>
      <span class="status-indicator"><span class="status-dot busy" />忙碌</span>
      <span class="status-indicator"><span class="status-dot offline" />離線</span>
    </div>
  </div>

  <!-- --------------------------------------------------------------- alerts -->
  <div
    v-else-if="mode === 'alerts'"
    class="vrt-col"
    style="width: 100%"
  >
    <div
      class="alert alert-success"
      style="width: 100%"
    >
      已成功指派 3 筆對話。
    </div>
    <div
      class="alert alert-warning"
      style="width: 100%"
    >
      LINE Webhook 於 12 分鐘前回報逾時。
    </div>
    <div
      class="alert alert-danger"
      style="width: 100%"
    >
      Facebook 粉絲頁權杖已失效，請重新授權。
    </div>
  </div>

  <!-- ---------------------------------------------------------------- forms -->
  <div
    v-else-if="mode === 'forms'"
    style="width: 100%"
  >
    <div class="form-group">
      <label
        class="form-label"
        for="vrt-input"
      >團隊名稱</label>
      <input
        id="vrt-input"
        class="form-input"
        type="text"
        value="客服一組"
      >
    </div>
    <div class="form-group">
      <label
        class="form-label"
        for="vrt-textarea"
      >說明</label>
      <textarea
        id="vrt-textarea"
        class="form-textarea"
      >負責 LINE 官方帳號的第一線回覆</textarea>
    </div>
    <div class="form-group">
      <label
        class="form-label"
        for="vrt-select"
      >平台</label>
      <select
        id="vrt-select"
        class="form-select"
      >
        <option>LINE</option>
      </select>
    </div>
    <div class="form-group">
      <label
        class="form-label"
        for="vrt-disabled"
      >已鎖定欄位</label>
      <input
        id="vrt-disabled"
        class="form-input"
        type="text"
        value="不可編輯"
        disabled
      >
    </div>
  </div>

  <!-- ----------------------------------------------------------- typography -->
  <div
    v-else
    class="vrt-col"
  >
    <h1 class="heading-1">
      Heading 1 標題
    </h1>
    <h2 class="heading-2">
      Heading 2 標題
    </h2>
    <h3 class="heading-3">
      Heading 3 標題
    </h3>
    <h4 class="heading-4">
      Heading 4 標題
    </h4>
    <p class="body-large">
      Body large — 大型內文，用於摘要區塊。
    </p>
    <p class="body-normal">
      Body normal — 一般內文，行高 relaxed。
    </p>
    <p class="body-small">
      Body small — 次要說明文字。
    </p>
    <p class="caption">
      Caption — 註解文字，灰階 500。
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Screenshot fixture for the `@layer components` / `@layer utilities` blocks in
 * `frontend/src/style.css`.
 *
 * These classes are built almost entirely out of `@apply`, which is exactly the
 * machinery a Tailwind major upgrade rewrites. They have no owning component, so
 * like ButtonMatrix this fixture is the only way to gate them. No `<style>`
 * block: everything rendered here must come from the real global stylesheet.
 */

interface Props {
  mode: 'cards' | 'badges' | 'alerts' | 'forms' | 'typography'
}

defineProps<Props>()
</script>
