<template>
  <section class="ui-card filters-section">
    <div class="ui-card-head">
      <h3 class="ui-card-title">
        篩選
      </h3>
      <div class="ui-card-end">
        <button
          v-if="searchQuery || selectedCategory"
          type="button"
          class="ui-link"
          @click="reset"
        >
          重設
        </button>
      </div>
    </div>
    <div class="filter-controls">
      <div class="ui-field">
        <label for="tpl-q">搜尋</label>
        <input
          id="tpl-q"
          :value="searchQuery"
          type="text"
          placeholder="模板名稱或說明"
          class="ui-input search-input"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        >
      </div>
      <div class="ui-field">
        <label for="tpl-cat">類別</label>
        <select
          id="tpl-cat"
          :value="selectedCategory"
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
      </div>
    </div>
  </section>
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
.filter-controls {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 14px;
  padding: 4px 22px 20px;
}

@media (max-width: 768px) {
  .filter-controls {
    grid-template-columns: 1fr;
    padding: 4px 16px 16px;
  }
}
</style>
