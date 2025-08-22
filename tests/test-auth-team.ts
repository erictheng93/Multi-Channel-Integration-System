/**
 * 認證和團隊管理功能測試腳本
 * 
 * 測試內容：
 * 1. 用戶登入認證
 * 2. JWT Token 驗證
 * 3. 團隊管理 CRUD
 * 4. 權限控制
 * 5. QR Code 生成
 */

const BASE_URL: string = 'http://localhost:8787';

// 測試用戶憑證
interface Credentials {
  username: string;
  password: string;
}

const ADMIN_CREDENTIALS: Credentials = {
  username: 'admin',
  password: 'admin123'
};

const AGENT_CREDENTIALS: Credentials = {
  username: 'agent1',
  password: 'agent123'
};

let adminToken: string = '';
let agentToken: string = '';

interface ApiResponse {
  status?: number;
  success?: boolean;
  data?: any;
  error?: string;
  message?: string;
  database?: string;
  name?: string;
  version?: string;
  endpoints?: Record<string, any>;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * 發送 HTTP 請求的輔助函數
 */
async function makeRequest(endpoint: string, options: RequestOptions = {}): Promise<{ status: number; data: ApiResponse }> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data: ApiResponse = await response.json();
  return { status: response.status, data };
}

/**
 * 測試用戶登入
 */
async function testLogin(): Promise<void> {
  console.log('\n🔐 測試用戶登入...');
  
  try {
    // 測試 admin 登入
    console.log('📝 測試 admin 登入...');
    const adminLogin = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(ADMIN_CREDENTIALS)
    });
    
    if (adminLogin.status === 200 && adminLogin.data.success) {
      adminToken = adminLogin.data.data.token;
      console.log('✅ Admin 登入成功');
      console.log(`   Token: ${adminToken.substring(0, 20)}...`);
      console.log(`   用戶: ${adminLogin.data.data.user.displayName} (${adminLogin.data.data.user.role})`);
    } else {
      console.log('❌ Admin 登入失敗:', adminLogin.data.error);
    }
    
    // 測試 agent 登入
    console.log('📝 測試 agent 登入...');
    const agentLogin = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(AGENT_CREDENTIALS)
    });
    
    if (agentLogin.status === 200 && agentLogin.data.success) {
      agentToken = agentLogin.data.data.token;
      console.log('✅ Agent 登入成功');
      console.log(`   Token: ${agentToken.substring(0, 20)}...`);
      console.log(`   用戶: ${agentLogin.data.data.user.displayName} (${agentLogin.data.data.user.role})`);
    } else {
      console.log('❌ Agent 登入失敗:', agentLogin.data.error);
    }
    
    // 測試錯誤憑證
    console.log('📝 測試錯誤憑證...');
    const wrongLogin = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'wrong', password: 'wrong' })
    });
    
    if (wrongLogin.status === 401) {
      console.log('✅ 錯誤憑證正確被拒絕');
    } else {
      console.log('❌ 錯誤憑證應該被拒絕');
    }
    
  } catch (error: any) {
    console.error('❌ 登入測試失敗:', error.message);
  }
}

/**
 * 測試用戶資料獲取
 */
async function testProfile(): Promise<void> {
  console.log('\n👤 測試用戶資料獲取...');
  
  try {
    // 測試 admin 資料
    const adminProfile = await makeRequest('/api/auth/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    if (adminProfile.status === 200 && adminProfile.data.success) {
      console.log('✅ Admin 資料獲取成功');
      console.log(`   用戶: ${adminProfile.data.data.user.displayName}`);
      console.log(`   角色: ${adminProfile.data.data.user.role}`);
      console.log(`   團隊: ${adminProfile.data.data.user.teamName || '無'}`);
    } else {
      console.log('❌ Admin 資料獲取失敗:', adminProfile.data.error);
    }
    
    // 測試無效 token
    const invalidProfile = await makeRequest('/api/auth/profile', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    });
    
    if (invalidProfile.status === 401) {
      console.log('✅ 無效 token 正確被拒絕');
    } else {
      console.log('❌ 無效 token 應該被拒絕');
    }
    
  } catch (error: any) {
    console.error('❌ 資料獲取測試失敗:', error.message);
  }
}

/**
 * 測試團隊管理
 */
async function testTeamManagement(): Promise<void> {
  console.log('\n🏢 測試團隊管理...');
  
  let testTeamId: string | null = null;
  
  try {
    // 1. 創建團隊（僅 admin 可以）
    console.log('📝 測試創建團隊 (admin)...');
    const createTeam = await makeRequest('/api/teams', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: '測試團隊',
        description: '這是一個測試團隊'
      })
    });
    
    if (createTeam.status === 200 && createTeam.data.success) {
      testTeamId = createTeam.data.data.id;
      console.log('✅ 團隊創建成功');
      console.log(`   團隊 ID: ${testTeamId}`);
      console.log(`   團隊名稱: ${createTeam.data.data.name}`);
    } else {
      console.log('❌ 團隊創建失敗:', createTeam.data.error);
    }
    
    // 2. 測試 agent 創建團隊（應該失敗）
    console.log('📝 測試 agent 創建團隊（應該失敗）...');
    const agentCreateTeam = await makeRequest('/api/teams', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${agentToken}`
      },
      body: JSON.stringify({
        name: 'Agent 團隊',
        description: 'Agent 不應該能創建團隊'
      })
    });
    
    if (agentCreateTeam.status === 403) {
      console.log('✅ Agent 創建團隊正確被拒絕');
    } else {
      console.log('❌ Agent 不應該能創建團隊');
    }
    
    // 3. 獲取所有團隊
    console.log('📝 測試獲取團隊列表...');
    const getTeams = await makeRequest('/api/teams', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    if (getTeams.status === 200 && getTeams.data.success) {
      console.log('✅ 團隊列表獲取成功');
      console.log(`   團隊數量: ${getTeams.data.data.length}`);
      getTeams.data.data.forEach((team: any, index: number) => {
        console.log(`   - ${team.name} (ID: ${team.id})`);
      });
    } else {
      console.log('❌ 團隊列表獲取失敗:', getTeams.data.error);
    }
    
    // 4. 獲取特定團隊詳情
    if (testTeamId) {
      console.log('📝 測試獲取團隊詳情...');
      const getTeam = await makeRequest(`/api/teams/${testTeamId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (getTeam.status === 200 && getTeam.data.success) {
        console.log('✅ 團隊詳情獲取成功');
        console.log(`   團隊: ${getTeam.data.data.name}`);
        console.log(`   描述: ${getTeam.data.data.description}`);
        console.log(`   狀態: ${getTeam.data.data.isActive ? '活躍' : '停用'}`);
      } else {
        console.log('❌ 團隊詳情獲取失敗:', getTeam.data.error);
      }
    }
    
    // 5. 更新團隊
    if (testTeamId) {
      console.log('📝 測試更新團隊...');
      const updateTeam = await makeRequest(`/api/teams/${testTeamId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: '更新後的測試團隊',
          description: '這是更新後的描述'
        })
      });
      
      if (updateTeam.status === 200 && updateTeam.data.success) {
        console.log('✅ 團隊更新成功');
        console.log(`   新名稱: ${updateTeam.data.data.name}`);
        console.log(`   新描述: ${updateTeam.data.data.description}`);
      } else {
        console.log('❌ 團隊更新失敗:', updateTeam.data.error);
      }
    }
    
    // 6. 生成 QR Code
    if (testTeamId) {
      console.log('📝 測試生成 QR Code...');
      const generateQR = await makeRequest(`/api/teams/${testTeamId}/qr-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (generateQR.status === 200 && generateQR.data.success) {
        console.log('✅ QR Code 生成成功');
        console.log(`   QR Code URL: ${generateQR.data.data.qrCodeUrl}`);
      } else {
        console.log('❌ QR Code 生成失敗:', generateQR.data.error);
      }
    }
    
    // 7. 獲取團隊成員
    if (testTeamId) {
      console.log('📝 測試獲取團隊成員...');
      const getMembers = await makeRequest(`/api/teams/${testTeamId}/members`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (getMembers.status === 200 && getMembers.data.success) {
        console.log('✅ 團隊成員獲取成功');
        console.log(`   成員數量: ${getMembers.data.data.length}`);
      } else {
        console.log('❌ 團隊成員獲取失敗:', getMembers.data.error);
      }
    }
    
    // 8. 獲取團隊統計
    if (testTeamId) {
      console.log('📝 測試獲取團隊統計...');
      const getStats = await makeRequest(`/api/teams/${testTeamId}/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (getStats.status === 200 && getStats.data.success) {
        console.log('✅ 團隊統計獲取成功');
        console.log(`   成員數量: ${getStats.data.data.memberCount}`);
        console.log(`   活躍對話: ${getStats.data.data.activeConversations}`);
        console.log(`   總訊息數: ${getStats.data.data.totalMessages}`);
      } else {
        console.log('❌ 團隊統計獲取失敗:', getStats.data.error);
      }
    }
    
  } catch (error: any) {
    console.error('❌ 團隊管理測試失敗:', error.message);
  }
}

/**
 * 測試權限控制
 */
async function testPermissions(): Promise<void> {
  console.log('\n🔒 測試權限控制...');
  
  try {
    // 測試無認證訪問
    console.log('📝 測試無認證訪問...');
    const noAuth = await makeRequest('/api/teams', {
      method: 'GET'
    });
    
    if (noAuth.status === 401) {
      console.log('✅ 無認證訪問正確被拒絕');
    } else {
      console.log('❌ 無認證訪問應該被拒絕');
    }
    
    // 測試 agent 訪問 admin 功能
    console.log('📝 測試 agent 訪問 admin 功能...');
    const agentAdmin = await makeRequest('/api/auth/register', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${agentToken}`
      },
      body: JSON.stringify({
        username: 'test',
        email: 'test@test.com',
        password: 'test123',
        displayName: 'Test User',
        role: 'agent'
      })
    });
    
    if (agentAdmin.status === 403) {
      console.log('✅ Agent 訪問 admin 功能正確被拒絕');
    } else {
      console.log('❌ Agent 不應該能訪問 admin 功能');
    }
    
  } catch (error: any) {
    console.error('❌ 權限控制測試失敗:', error.message);
  }
}

/**
 * 測試 API 資訊端點
 */
async function testAPIInfo(): Promise<void> {
  console.log('\n📋 測試 API 資訊端點...');
  
  try {
    const apiInfo = await makeRequest('/api', {
      method: 'GET'
    });
    
    if (apiInfo.status === 200) {
      console.log('✅ API 資訊獲取成功');
      console.log(`   API 名稱: ${apiInfo.data.name}`);
      console.log(`   版本: ${apiInfo.data.version}`);
      console.log(`   端點數量: ${Object.keys(apiInfo.data.endpoints || {}).length}`);
    } else {
      console.log('❌ API 資訊獲取失敗');
    }
    
  } catch (error: any) {
    console.error('❌ API 資訊測試失敗:', error.message);
  }
}

/**
 * 主測試函數
 */
async function runTests(): Promise<void> {
  console.log('🚀 開始認證和團隊管理功能測試');
  console.log(`📡 測試目標: ${BASE_URL}`);
  
  try {
    // 檢查服務是否運行
    console.log('\n🔍 檢查服務狀態...');
    const health = await makeRequest('/health');
    
    if (health.status === 200) {
      console.log('✅ 服務運行正常');
      console.log(`   資料庫狀態: ${health.data.database}`);
    } else {
      console.log('❌ 服務未正常運行');
      return;
    }
    
    // 執行各項測試
    await testAPIInfo();
    await testLogin();
    await testProfile();
    await testTeamManagement();
    await testPermissions();
    
    console.log('\n🎉 所有測試完成！');
    
  } catch (error: any) {
    console.error('❌ 測試執行失敗:', error.message);
  }
}

// 執行測試
runTests().catch(console.error);