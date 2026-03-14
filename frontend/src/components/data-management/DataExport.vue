<!-- 匯出對話記錄 - 資料管理子頁面 -->
<!-- Launcher page that opens the existing ExportDialog modal -->

<template>
  <div class="data-export">
    <!-- 頁面標題 -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          <DownloadIcon :size="28" />
          匯出對話記錄
        </h1>
        <p class="page-subtitle">
          將對話記錄匯出為檔案，用於備份、分析或歸檔
        </p>
      </div>
      <div class="header-actions">
        <button
          class="btn btn-primary"
          @click="openExportDialog"
        >
          <DownloadIcon :size="16" />
          開始匯出
        </button>
      </div>
    </div>

    <!-- 格式說明卡片 -->
    <div class="format-cards">
      <div
        v-for="format in formats"
        :key="format.id"
        class="format-card"
        @click="openExportWithFormat(format.id)"
      >
        <div class="format-icon">
          {{ format.icon }}
        </div>
        <div class="format-info">
          <h3 class="format-name">
            {{ format.name }}
          </h3>
          <p class="format-description">
            {{ format.description }}
          </p>
        </div>
        <div class="format-usecases">
          <span class="usecase-label">適用場景：</span>
          <div class="usecase-tags">
            <span
              v-for="usecase in format.usecases"
              :key="usecase"
              class="usecase-tag"
            >
              {{ usecase }}
            </span>
          </div>
        </div>
        <div class="format-action">
          <span class="action-text">點擊匯出</span>
          <span class="action-arrow">&rarr;</span>
        </div>
      </div>
    </div>

    <!-- 功能說明區 -->
    <div class="features-section">
      <h2 class="section-title">
        匯出功能
      </h2>
      <div class="features-grid">
        <div class="feature-item">
          <div class="feature-icon">
            
          </div>
          <div class="feature-content">
            <h4>日期範圍篩選</h4>
            <p>指定起始和結束日期，只匯出特定時間段的對話記錄</p>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">
            
          </div>
          <div class="feature-content">
            <h4>用戶篩選</h4>
            <p>篩選特定 LINE 用戶的對話，快速找到需要的記錄</p>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">
            
          </div>
          <div class="feature-content">
            <h4>客服篩選</h4>
            <p>依照客服人員篩選，用於績效評估或品質審查</p>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">
            
          </div>
          <div class="feature-content">
            <h4>筆數控制</h4>
            <p>設定匯出筆數上限（100 / 500 / 1000），控制檔案大小</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ExportDialog Modal (reuse existing component) -->
    <ExportDialog
      :show="showExportDialog"
      :initial-format="selectedFormat"
      @close="showExportDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { DownloadIcon } from '@/components/icons'
import ExportDialog from '@/components/conversation/ExportDialog.vue'

const showExportDialog = ref(false)
const selectedFormat = ref<'json' | 'csv' | 'txt' | 'pdf'>('json')

const formats = [
  {
    id: 'json' as const,
    name: 'JSON - 結構化資料',
    icon: '{ }',
    description: '完整的結構化資料格式，包含所有欄位和中繼資訊，適合程式化處理和資料分析',
    usecases: ['API 整合', '資料分析', '系統備份', '自動化處理']
  },
  {
    id: 'csv' as const,
    name: 'CSV - 試算表格式',
    icon: '',
    description: '以逗號分隔的表格格式，可直接在 Excel 或 Google Sheets 中開啟和分析',
    usecases: ['Excel 報表', '資料視覺化', '統計分析', '團隊共享']
  },
  {
    id: 'txt' as const,
    name: 'TXT - 純文字聊天記錄',
    icon: '',
    description: '人類可讀的純文字格式，按對話分組，每則訊息包含時間和發送者',
    usecases: ['直接閱讀', '品質審查', '存檔歸檔', '列印備份']
  },
  {
    id: 'pdf' as const,
    name: 'PDF - 可攜式報告',
    icon: '',
    description: '專業排版的可攜式文件格式，完整支援中文，適合列印、存檔和對外分享',
    usecases: ['列印報告', '正式存檔', '對外分享', '品質審查']
  }
]

function openExportDialog() {
  selectedFormat.value = 'json'
  showExportDialog.value = true
}

function openExportWithFormat(format: 'json' | 'csv' | 'txt' | 'pdf') {
  selectedFormat.value = format
  showExportDialog.value = true
}
</script>

<style scoped>
.data-export {
  max-width: 1200px;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.header-content {
  flex: 1;
}

.page-title {
  font-size: 2rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.page-subtitle {
  color: #6b7280;
  font-size: 1.1rem;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

/* Format Cards */
.format-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.format-card {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.format-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}

.format-icon {
  font-size: 2rem;
  width: 3.5rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f4ff;
  border-radius: 12px;
  color: #3b82f6;
  font-weight: 700;
  font-family: 'Courier New', monospace;
}

.format-info {
  flex: 1;
}

.format-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.format-description {
  color: #6b7280;
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0;
}

.format-usecases {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.usecase-label {
  font-size: 0.8rem;
  color: #9ca3af;
  font-weight: 500;
}

.usecase-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.usecase-tag {
  padding: 0.2rem 0.5rem;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #4b5563;
  font-weight: 500;
}

.format-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.75rem;
  border-top: 1px solid #f3f4f6;
  color: #3b82f6;
  font-weight: 600;
  font-size: 0.9rem;
}

.action-arrow {
  transition: transform 0.2s;
}

.format-card:hover .action-arrow {
  transform: translateX(4px);
}

/* Features Section */
.section-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
}

.features-section {
  margin-bottom: 2.5rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 1.25rem;
}

.feature-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  border-radius: 8px;
}

.feature-content h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
}

.feature-content p {
  font-size: 0.85rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.4;
}

/* Buttons */
.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #2563eb, #1e40af);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

/* Responsive */
@media (max-width: 1024px) {
  .format-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .format-cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 1rem;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .btn {
    width: 100%;
    justify-content: center;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .page-title {
    font-size: 1.5rem;
  }
}
</style>
