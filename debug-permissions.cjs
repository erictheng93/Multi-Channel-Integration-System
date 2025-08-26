// 調試權限問題

const API_BASE = 'http://127.0.0.1:8787';

async function debugPermissions() {
  console.log('🔍 調試權限問題...');

  // 登入
  const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'test@dacit.net',
      password: '16011587'
    }),
  });

  const loginResult = await loginResponse.json();
  const token = loginResult.data.token;
  const user = loginResult.data.agent;
  
  console.log('👤 登入用戶:', {
    id: user.id,
    role: user.role,
    name: user.name
  });

  // 嘗試調用對話 API 並檢查回應
  const conversationsResponse = await fetch(`${API_BASE}/api/conversations`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const conversationsText = await conversationsResponse.text();
  console.log('📋 對話 API 回應:', conversationsText);

  // 直接檢查資料庫
  console.log('\n🗄️  資料庫直接查詢測試:');
  
  const directQueryResponse = await fetch(`${API_BASE}/api/conversations/debug`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (directQueryResponse.ok) {
    const debugResult = await directQueryResponse.text();
    console.log('🔧 Debug API 回應:', debugResult);
  } else {
    console.log('🔧 Debug API 不存在 (正常)');
  }
}

debugPermissions().catch(console.error);