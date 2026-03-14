<!-- 模板搜尋和篩選控制 -->
<!-- Template search and filter controls -->

<template>
  <div class="filters-section">
    <div class="filter-controls">
      <div class="search-box">
        <i class="search-icon"></i>
        <input
          :value="searchQuery"
          type="text"
          placeholder="搜尋模板..."
          class="search-input"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        >
      </div>

      <div class="category-filter">
        <label>類別：</label>
        <select
          :value="selectedCategory"
          class="category-select"
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

      <div class="time-filter">
        <label>預估時間：</label>
        <select
          :value="selectedTimeRange"
          class="time-select"
          @change="$emit('update:selectedTimeRange', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            不限
          </option>
          <option value="fast">
            快速 (&lt; 30秒)
          </option>
          <option value="medium">
            中等 (30秒-2分鐘)
          </option>
          <option value="slow">
            較慢 (> 2分鐘)
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  searchQuery: string;
  selectedCategory: string;
  selectedTimeRange: string;
}>();

defineEmits<{
  'update:searchQuery': [value: string];
  'update:selectedCategory': [value: string];
  'update:selectedTimeRange': [value: string];
}>();
</script>

<style scoped>
.filters-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-controls {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 300px;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #007bff;
}

.category-filter,
.time-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.category-filter label,
.time-filter label {
  font-weight: 500;
  color: #333;
  white-space: nowrap;
}

.category-select,
.time-select {
  padding: 0.5rem;
  border: 2px solid #e1e5e9;
  border-radius: 6px;
  background: white;
  font-size: 0.9rem;
  min-width: 120px;
}

@media (max-width: 768px) {
  .filter-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    min-width: auto;
  }
}
</style>
