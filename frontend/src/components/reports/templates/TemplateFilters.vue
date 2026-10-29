<template>
  <div
    class="tpl-toolbar"
    role="search"
  >
    <input
      id="tpl-q"
      :value="searchQuery"
      type="search"
      placeholder="搜尋模板名稱或說明"
      aria-label="搜尋模板"
      class="ui-input search-input"
      @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
    >
    <select
      id="tpl-cat"
      :value="selectedCategory"
      aria-label="類別"
      class="ui-select category-select"
      @change="$emit('update:selectedCategory', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">
        全部類別
      </option>
      <option value="basic">
        基礎報表
      </option>
      <option value="enterprise">
        企業級
      </option>
      <option value="business_intelligence">
        商業智能
      </option>
      <option value="advanced_analytics">
        高級分析
      </option>
    </select>
    <button
      v-if="searchQuery || selectedCategory"
      type="button"
      class="btn btn-ghost btn-sm"
      @click="reset"
    >
      重設
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  searchQuery: string;
  selectedCategory: string;
}>();

const emit = defineEmits<{
  'update:searchQuery': [value: string];
  'update:selectedCategory': [value: string];
}>();

function reset() {
  emit('update:searchQuery', '');
  emit('update:selectedCategory', '');
}
</script>

<style scoped>
.tpl-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.search-input {
  flex: 1 1 260px;
  max-width: 420px;
}

.category-select {
  flex: 0 0 auto;
  width: auto;
  min-width: 160px;
}

@media (max-width: 768px) {
  .search-input {
    flex-basis: 100%;
    max-width: none;
  }

  .category-select {
    flex: 1 1 0;
  }
}
</style>
