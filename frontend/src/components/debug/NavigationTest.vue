<template>
  <div class="navigation-test">
    <h3>導航測試組件</h3>
    <p>當前路由: {{ $route.path }}</p>
    <p>路由參數: {{ JSON.stringify($route.params) }}</p>
    <p>路由查詢: {{ JSON.stringify($route.query) }}</p>
    
    <div class="test-buttons">
      <button @click="testNavigation('/dashboard')">
        測試儀表板
      </button>
      <button @click="testNavigation('/conversations')">
        測試對話管理
      </button>
      <button @click="testNavigation('/team')">
        測試團隊管理
      </button>
      <button @click="testNavigation('/activities')">
        測試活動記錄
      </button>
      <button @click="testNavigation('/settings')">
        測試系統設定
      </button>
    </div>
    
    <div class="test-results">
      <h4>測試結果:</h4>
      <ul>
        <li
          v-for="result in testResults"
          :key="result.id"
        >
          {{ result.message }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const testResults = ref<Array<{ id: number, message: string }>>([])

let testId = 0

const testNavigation = async (path: string) => {
  const currentTestId = ++testId
  const startTime = Date.now()
  
  testResults.value.push({
    id: currentTestId,
    message: `開始測試導航到 ${path}...`
  })
  
  try {
    await router.push(path)
    const endTime = Date.now()
    
    testResults.value.push({
      id: currentTestId,
      message: ` 成功導航到 ${path} (耗時: ${endTime - startTime}ms)`
    })
  } catch (error) {
    testResults.value.push({
      id: currentTestId,
      message: ` 導航失敗: ${error}`
    })
  }
}
</script>

<style scoped>
.navigation-test {
  padding: 20px;
  border: 2px solid #007bff;
  border-radius: 8px;
  margin: 20px;
  background: #f8f9fa;
}

.test-buttons {
  margin: 15px 0;
}

.test-buttons button {
  margin: 5px;
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.test-buttons button:hover {
  background: #0056b3;
}

.test-results {
  margin-top: 20px;
  max-height: 200px;
  overflow-y: auto;
}

.test-results ul {
  list-style-type: none;
  padding: 0;
}

.test-results li {
  padding: 5px;
  margin: 2px 0;
  background: white;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}
</style>