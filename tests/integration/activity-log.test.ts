// 活動記錄功能整合測試
interface LoginCredentials {
  email: string;
  password: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface LoginResponse {
  token: string;
  refreshToken: string;
  agent: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: number;
  };
  sessionId: string;
  expiresIn: number;
}

interface ActivityLog {
  id: number;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787';

// 測試用戶憑證 - 必須使用環境變數
const ADMIN_CREDENTIALS: LoginCredentials = {
  email: process.env.TEST_ADMIN_EMAIL || (() => {
    throw new Error('TEST_ADMIN_EMAIL environment variable is required for testing');
  })(),
  password: process.env.TEST_ADMIN_PASSWORD || (() => {
    throw new Error('TEST_ADMIN_PASSWORD environment variable is required for testing');
  })()
};

const AGENT_CREDENTIALS: LoginCredentials = {
  email: process.env.TEST_AGENT_EMAIL || (() => {
    throw new Error('TEST_AGENT_EMAIL environment variable is required for testing');
  })(),
  password: process.env.TEST_AGENT_PASSWORD || (() => {
    throw new Error('TEST_AGENT_PASSWORD environment variable is required for testing');
  })()
};

// 驗證不使用生產環境憑證
if (ADMIN_CREDENTIALS.email.includes('@dacit.net') || AGENT_CREDENTIALS.email.includes('@dacit.net')) {
  throw new Error('❌ 生產環境憑證不能用於測試，請使用測試專用憑證');
}

let adminToken = '';
let agentToken = '';

// 輔助函數
async function makeRequest<T = any>(
  url: string, 
  options: RequestInit = {}
): Promise<{ status: number; data?: T; error?: string }> {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json() as T;
    return { status: response.status, data };
  } catch (error) {
    console.error(`❌ 請求失敗: ${url}`, error instanceof Error ? error.message : error);
    return { status: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// 登入函數
async function login(credentials: LoginCredentials, userType: string): Promise<string | null> {
  console.log(`🔐 ${userType} 登入中...`);
  
  const result = await makeRequest<ApiResponse<LoginResponse>>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
  
  if (result.status === 200 && result.data?.success && result.data.data?.token) {
    console.log(`✅ ${userType} 登入成功`);
    return result.data.data.token;
  } else {
    console.log(`❌ ${userType} 登入失敗:`, result.data?.error || result.error);
    return null;
  }
}

// 測試活動記錄 API
async function testActivitiesAPI(token: string, userType: string): Promise<boolean> {
  console.log(`\n📋 測試 ${userType} 的活動記錄 API...`);
  
  // 測試獲取活動記錄列表
  const listResult = await makeRequest<ApiResponse<ActivityLog[]>>('/api/activities', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (listResult.status === 200 && listResult.data?.success) {
    console.log(`✅ ${userType} 可以獲取活動記錄列表`);
    return true;
  } else {
    console.log(`❌ ${userType} 無法獲取活動記錄列表`);
    return false;
  }
}

// 測試權限控制
async function testPermissions(): Promise<boolean> {
  console.log('\n🔒 測試權限控制...');
  
  let allTestsPassed = true;
  
  // 測試未授權存取
  const unauthorizedResult = await makeRequest('/api/activities');
  if (unauthorizedResult.status === 401) {
    console.log('✅ 未授權存取被正確阻止');
  } else {
    console.log('❌ 未授權存取沒有被阻止');
    allTestsPassed = false;
  }
  
  // 測試 Admin 專用端點
  if (adminToken) {
    const overviewResult = await makeRequest('/api/activities/overview', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    if (overviewResult.status === 200) {
      console.log('✅ Admin 可以訪問活動概覽');
    } else {
      console.log('❌ Admin 無法訪問活動概覽');
      allTestsPassed = false;
    }
  }
  
  // 測試 Agent 訪問 Admin 端點
  if (agentToken) {
    const agentOverviewResult = await makeRequest('/api/activities/overview', {
      headers: { 'Authorization': `Bearer ${agentToken}` }
    });
    
    if (agentOverviewResult.status === 403) {
      console.log('✅ Agent 無法訪問 Admin 專用端點（權限正確）');
    } else {
      console.log('❌ Agent 可以訪問 Admin 專用端點（權限錯誤）');
      allTestsPassed = false;
    }
  }
  
  return allTestsPassed;
}

// 主測試函數
export async function runActivityLogTests(): Promise<boolean> {
  console.log('🚀 開始活動記錄功能整合測試...\n');
  
  let allTestsPassed = true;
  
  // 登入測試用戶
  adminToken = await login(ADMIN_CREDENTIALS, 'Admin') || '';
  agentToken = await login(AGENT_CREDENTIALS, 'Agent') || '';
  
  if (!adminToken && !agentToken) {
    console.log('❌ 無法登入任何測試用戶，測試失敗');
    return false;
  }
  
  // 測試 API 功能
  if (adminToken) {
    const adminApiTest = await testActivitiesAPI(adminToken, 'Admin');
    allTestsPassed = allTestsPassed && adminApiTest;
  }
  
  if (agentToken) {
    const agentApiTest = await testActivitiesAPI(agentToken, 'Agent');
    allTestsPassed = allTestsPassed && agentApiTest;
  }
  
  // 測試權限控制
  const permissionTest = await testPermissions();
  allTestsPassed = allTestsPassed && permissionTest;
  
  console.log('\n🎉 活動記錄功能整合測試完成！');
  console.log(`\n📋 測試結果: ${allTestsPassed ? '✅ 全部通過' : '❌ 部分失敗'}`);
  
  return allTestsPassed;
}

// 如果直接執行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runActivityLogTests().then(success => {
    process.extest(success ? 0 : 1);
  }).catch(error => {
    console.error('測試執行失敗:', error);
    process.extest(1);
  });
}