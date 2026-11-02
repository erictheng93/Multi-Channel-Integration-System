<!--
  GeneralSettingsPage.vue
  The settings home: a live overview strip (each tile links to its section), then the identity form
  beside a context column (measured service latency, then the read-only parameters in force).
-->

<template>
  <div class="general">
    <GeneralSettingsOverview>
      <template #aside>
        <h2 class="ui-group-label">
          服務延遲
          <span class="label-note">最近一次健康檢查的實測值</span>
        </h2>
        <div class="ui-group">
          <ul
            v-if="controller.healthCheckResults.value.length > 0"
            class="ui-list lat-list"
          >
            <li
              v-for="row in controller.healthCheckResults.value"
              :key="row.key"
              class="ui-row is-flush lat-row"
            >
              <span
                class="lat-dot"
                :class="row.status"
                aria-hidden="true"
              />
              <span class="ui-row-main">
                <span class="ui-row-title">{{ row.name }}</span>
              </span>
              <span class="lat-ms">{{ row.responseTime ?? '—' }}<small v-if="row.responseTime !== undefined"> ms</small></span>
            </li>
          </ul>
          <p
            v-else
            class="lat-empty"
          >
            {{ controller.processing.value ? '正在檢查服務...' : '尚無檢查結果' }}
          </p>
        </div>
      </template>
    </GeneralSettingsOverview>

    <GeneralSettingsForm
      :settings="controller.settings.general"
      :saving="controller.saving.value"
      @save="controller.saveGeneralSettings"
      @update:settings="(data) => Object.assign(controller.settings.general, data)"
    />

    <SettingsGroup
      class="adv-group"
      title="目前生效的進階參數（唯讀）"
    >
      <dl class="adv-grid">
        <div
          v-for="item in advancedRows"
          :key="item.label"
          class="adv-item"
        >
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
      <template #note>
        <router-link
          class="ui-link"
          to="/settings/advanced"
        >
          前往進階設定調整
        </router-link>
      </template>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { GeneralSettingsForm } from '@/components/system-settings'
import GeneralSettingsOverview from '@/components/system-settings/GeneralSettingsOverview.vue'
import SettingsGroup from '@/components/system-settings/SettingsGroup.vue'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}

/** Same unit conversions the advanced form uses (ms, seconds -> seconds, minutes, hours) */
const advancedRows = computed(() => {
  const a = controller.settings.advanced
  return [
    { label: '訊息可撤回時間', value: a.recallWindowSeconds > 0 ? `${a.recallWindowSeconds} 秒` : '關閉' },
    { label: '訊息處理逾時', value: `${Math.round(a.messageTimeout / 1000)} 秒` },
    { label: '登入有效期限', value: `${Math.round(a.sessionExpiry / 3600)} 小時` },
    { label: '速率限制', value: a.enableRateLimit ? '已開啟' : '已關閉' },
  ]
})
</script>

<style scoped>
.general {
  display: grid;
  gap: 20px;
  min-width: 0;
}

/* read-only values: label over value, no row chrome, so nothing here looks like a field */
.adv-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 16px;
  margin: 0;
  padding: 16px 22px;
}

.adv-item dt {
  font-size: 13px;
  color: var(--ui-muted);
}

.adv-item dd {
  margin: 4px 0 0;
  font: 600 17px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}



.lat-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* rows share the group's height, so it ends level with the link list beside it */
.lat-row {
  flex: 1;
  min-height: 44px;
}

.lat-dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ui-muted);
}

.lat-dot.healthy {
  background: var(--ui-green);
}

.lat-dot.warning {
  background: var(--ui-orange);
}

.lat-dot.critical {
  background: var(--ui-red);
}

.lat-ms {
  font: 600 14px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.lat-ms small {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.lat-empty {
  margin: 0;
  padding: 4px 22px 18px;
  font-size: 13px;
  color: var(--ui-muted);
}

@media (max-width: 768px) {
  .adv-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
