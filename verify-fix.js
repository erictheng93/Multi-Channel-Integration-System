/**
 * API 端點驗證腳本
 * 在瀏覽器 Console 中運行此腳本以驗證修復
 *
 * 使用方法：
 * 1. 在瀏覽器中打開 http://localhost:3000/team
 * 2. 按 F12 打開開發者工具
 * 3. 切換到 Console 標籤
 * 4. 複製並貼上此腳本，按 Enter 執行
 */

(async function verifyAPIFix() {
  console.log('🔍 開始驗證 API 修復...\n');

  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // 從 localStorage 獲取 token
  const token = localStorage.getItem('token');

  if (!token) {
    console.error('❌ 找不到認證 token！請先登入。');
    return;
  }

  console.log('✅ 找到認證 token\n');

  // 測試 1: 健康檢查端點
  console.log('📋 測試 1: Teams 模組健康檢查');
  try {
    const healthResponse = await fetch('https://multi-channel.imfinethankyouandyou.com/api/teams/health');
    const healthData = await healthResponse.json();

    if (healthResponse.ok && healthData.status === 'healthy') {
      console.log('✅ 健康檢查通過:', healthData);
      results.passed.push('Health check');
    } else {
      console.error('❌ 健康檢查失敗:', healthData);
      results.failed.push('Health check');
    }
  } catch (error) {
    console.error('❌ 健康檢查錯誤:', error);
    results.failed.push('Health check');
  }

  console.log('\n📋 測試 2: Teams 模組資訊');
  try {
    const infoResponse = await fetch('https://multi-channel.imfinethankyouandyou.com/api/teams/info');
    const infoData = await infoResponse.json();

    if (infoResponse.ok && infoData.success) {
      console.log('✅ 模組資訊:', infoData.data);

      // 檢查是否包含新的 /members 端點
      const hasNewEndpoint = infoData.data.endpoints.some(ep => ep.includes('GET /members'));
      if (hasNewEndpoint) {
        console.log('✅ 新端點 GET /members 已註冊');
        results.passed.push('New endpoint registered');
      } else {
        console.warn('⚠️  新端點未在文檔中列出');
        results.warnings.push('New endpoint not in docs');
      }
    } else {
      console.error('❌ 模組資訊失敗:', infoData);
      results.failed.push('Module info');
    }
  } catch (error) {
    console.error('❌ 模組資訊錯誤:', error);
    results.failed.push('Module info');
  }

  console.log('\n📋 測試 3: GET /api/teams/members (關鍵測試)');
  try {
    const membersResponse = await fetch('https://multi-channel.imfinethankyouandyou.com/api/teams/members', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('   HTTP 狀態碼:', membersResponse.status, membersResponse.statusText);

    if (membersResponse.status === 200) {
      const membersData = await membersResponse.json();
      console.log('✅ API 請求成功！');
      console.log('   回應數據:', membersData);

      if (membersData.success && Array.isArray(membersData.data)) {
        console.log(`✅ 成功獲取 ${membersData.data.length} 位成員`);
        results.passed.push('GET /api/teams/members');

        // 檢查數據格式
        if (membersData.data.length > 0) {
          const firstMember = membersData.data[0];
          const requiredFields = ['id', 'name', 'email', 'role', 'status'];
          const missingFields = requiredFields.filter(field => !(field in firstMember));

          if (missingFields.length === 0) {
            console.log('✅ 成員數據格式正確');
            results.passed.push('Data format validation');
          } else {
            console.warn('⚠️  成員數據缺少字段:', missingFields);
            results.warnings.push(`Missing fields: ${missingFields.join(', ')}`);
          }

          console.log('   第一位成員範例:', firstMember);
        }
      } else {
        console.warn('⚠️  回應格式異常:', membersData);
        results.warnings.push('Unexpected response format');
      }
    } else if (membersResponse.status === 400) {
      console.error('❌ 400 Bad Request - 端點仍然有問題！');
      const errorData = await membersResponse.json().catch(() => ({}));
      console.error('   錯誤詳情:', errorData);
      results.failed.push('GET /api/teams/members - Still 400');
    } else if (membersResponse.status === 403) {
      console.error('❌ 403 Forbidden - 權限不足');
      console.log('   您的當前角色可能沒有權限查看成員列表');
      results.failed.push('GET /api/teams/members - Permission denied');
    } else if (membersResponse.status === 401) {
      console.error('❌ 401 Unauthorized - Token 無效或過期');
      results.failed.push('GET /api/teams/members - Auth failed');
    } else {
      console.error(`❌ 未預期的狀態碼: ${membersResponse.status}`);
      const errorData = await membersResponse.json().catch(() => ({}));
      console.error('   錯誤詳情:', errorData);
      results.failed.push(`GET /api/teams/members - ${membersResponse.status}`);
    }
  } catch (error) {
    console.error('❌ API 請求錯誤:', error);
    results.failed.push('GET /api/teams/members - Network error');
  }

  // 測試 4: 檢查前端 Store 狀態
  console.log('\n📋 測試 4: 前端 Store 狀態');
  try {
    // 嘗試訪問 Pinia store (如果可用)
    if (window.__PINIA__) {
      console.log('✅ Pinia store 可用');
      const stores = window.__PINIA__.state.value;

      if (stores.team) {
        console.log('✅ Team store 已載入');
        console.log('   成員數量:', stores.team.members?.length || 0);
        console.log('   載入狀態:', stores.team.loading);
        console.log('   錯誤狀態:', stores.team.error);
        results.passed.push('Frontend store check');
      } else {
        console.warn('⚠️  Team store 未找到');
        results.warnings.push('Team store not found');
      }
    } else {
      console.warn('⚠️  Pinia 未初始化');
      results.warnings.push('Pinia not initialized');
    }
  } catch (error) {
    console.warn('⚠️  無法檢查前端 store:', error);
    results.warnings.push('Cannot check frontend store');
  }

  // 總結報告
  console.log('\n' + '='.repeat(60));
  console.log('📊 驗證總結報告');
  console.log('='.repeat(60));

  console.log(`\n✅ 通過測試: ${results.passed.length}`);
  results.passed.forEach(test => console.log(`   • ${test}`));

  if (results.warnings.length > 0) {
    console.log(`\n⚠️  警告: ${results.warnings.length}`);
    results.warnings.forEach(warning => console.log(`   • ${warning}`));
  }

  if (results.failed.length > 0) {
    console.log(`\n❌ 失敗測試: ${results.failed.length}`);
    results.failed.forEach(test => console.log(`   • ${test}`));
  }

  console.log('\n' + '='.repeat(60));

  if (results.failed.length === 0) {
    console.log('🎉 所有關鍵測試通過！問題已完全解決。');
  } else {
    console.log('⚠️  仍有問題需要修復。請查看上述失敗的測試。');
  }

  return {
    summary: {
      passed: results.passed.length,
      warnings: results.warnings.length,
      failed: results.failed.length,
      total: results.passed.length + results.warnings.length + results.failed.length
    },
    details: results
  };
})();
