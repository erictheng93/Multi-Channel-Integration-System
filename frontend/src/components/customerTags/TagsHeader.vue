<template>
  <section class="ui-page-head">
    <div>
      <div class="ui-eyebrow">
        客戶經營
      </div>
      <h1 class="ui-page-title">
        客戶標籤
      </h1>
      <p
        v-if="subtitle"
        class="ui-page-sub"
      >
        {{ subtitle }}
      </p>
    </div>
    <div class="ui-page-actions">
      <button
        class="btn btn-primary"
        @click="$emit('create-tag')"
      >
        <PlusIcon class="head-ico" />
        <span>新增標籤</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PlusIcon } from '@/components/icons'

const props = defineProps<{
  totalTags?: number
  totalConversations?: number
  unusedTagNames?: string[]
}>()

defineEmits<{
  'create-tag': []
}>()

// Built only from loaded tag data; hidden until tags exist.
const subtitle = computed(() => {
  const total = props.totalTags ?? 0
  if (total === 0) { return '' }
  const parts = [`${total} 個標籤、共標記 ${props.totalConversations ?? 0} 個對話。`]
  const unused = props.unusedTagNames ?? []
  if (unused.length === 1) {
    parts.push(`「${unused[0]}」尚未套用到任何對話。`)
  } else if (unused.length > 1) {
    parts.push(`${unused.length} 個標籤尚未套用到任何對話。`)
  }
  return parts.join('')
})
</script>

<style scoped>
.head-ico {
  width: 16px;
  height: 16px;
}
</style>
