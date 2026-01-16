// 🔍 Auth Store 診斷腳本
// 用於分析無限刷新問題的根本原因

console.log('=== Auth Store 診斷開始 ===\n');

// 1. 檢查 localStorage 中的數據
console.log('📦 1. localStorage 數據檢查:');
const token = localStorage.getItem('token');
const sessionExpiry = localStorage.getItem('sessionExpiry');
const currentAgent = localStorage.getItem('currentAgent');
const refreshToken = localStorage.getItem('refreshToken');

console.log('  - Token 存在:', !!token);
console.log('  - Token 長度:', token ? token.length : 0);
console.log('  - Session Expiry:', sessionExpiry);
console.log('  - Current Agent:', currentAgent ? 'exists' : 'null');
console.log('  - Refresh Token:', refreshToken ? 'exists' : 'null');

// 2. 檢查 sessionExpiry 是否過期
if (sessionExpiry) {
  const expiryTime = parseInt(sessionExpiry, 10);
  const now = Date.now();
  const isExpired = now > expiryTime;
  const timeLeft = expiryTime - now;
  const daysLeft = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
  const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  console.log('\n⏰ 2. Session Expiry 檢查:');
  console.log('  - 過期時間:', new Date(expiryTime).toLocaleString('zh-TW'));
  console.log('  - 當前時間:', new Date(now).toLocaleString('zh-TW'));
  console.log('  - 是否過期:', isExpired);
  if (!isExpired) {
    console.log('  - 剩餘時間:', `${daysLeft} 天 ${hoursLeft} 小時`);
  }
}

// 3. 檢查 JWT Token 的有效性
if (token) {
  console.log('\n🔐 3. JWT Token 有效性檢查:');
  try {
    const parts = token.split('.');
    console.log('  - Token 格式:', parts.length === 3 ? 'valid (3 parts)' : `invalid (${parts.length} parts)`);

    if (parts.length === 3 && parts[1]) {
      const payload = JSON.parse(atob(parts[1]));
      console.log('  - Payload:', JSON.stringify(payload, null, 2));

      if (payload.exp) {
        const tokenExpiry = payload.exp * 1000; // 轉換為毫秒
        const now = Date.now();
        const isTokenExpired = now >= tokenExpiry;
        const tokenTimeLeft = tokenExpiry - now;
        const tokenHoursLeft = Math.floor(tokenTimeLeft / (60 * 60 * 1000));

        console.log('  - Token 過期時間:', new Date(tokenExpiry).toLocaleString('zh-TW'));
        console.log('  - Token 是否過期:', isTokenExpired);
        if (!isTokenExpired) {
          console.log('  - Token 剩餘時間:', `${tokenHoursLeft} 小時`);
        } else {
          console.log('  - ⚠️  Token 已過期!');
        }
      } else {
        console.log('  - ⚠️  Token 沒有 exp 字段');
      }

      console.log('  - User ID:', payload.userId);
      console.log('  - Role:', payload.role);
      console.log('  - Team ID:', payload.teamId);
    }
  } catch (error) {
    console.log('  - ❌ Token 解析失敗:', error.message);
  }
}

// 4. 模擬 isAuthenticated 計算
console.log('\n🎯 4. isAuthenticated 模擬計算:');
const hasToken = !!token;
const hasAgent = !!currentAgent;

let isSessionValid = false;
if (sessionExpiry) {
  isSessionValid = Date.now() < parseInt(sessionExpiry, 10);
}

let isTokenValid = false;
if (token) {
  try {
    const parts = token.split('.');
    if (parts.length === 3 && parts[1]) {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.userId && payload.role) {
        if (payload.exp) {
          isTokenValid = Math.floor(Date.now() / 1000) < payload.exp;
        } else {
          isTokenValid = true; // 沒有 exp 字段，假設有效
        }
      }
    }
  } catch (_e) {
    isTokenValid = false;
  }
}

console.log('  - hasToken:', hasToken);
console.log('  - hasAgent:', hasAgent);
console.log('  - isSessionValid:', isSessionValid);
console.log('  - isTokenValid:', isTokenValid);
console.log('  - 最終 isAuthenticated:', hasToken && hasAgent && isSessionValid && isTokenValid);

// 5. 分析問題
console.log('\n🔍 5. 問題分析:');
if (hasToken && !isTokenValid) {
  console.log('  ❌ 問題發現: Token 存在但已過期!');
  console.log('  💡 這會導致:');
  console.log('     - localStorage 中有 token (hasToken = true)');
  console.log('     - 但 isAuthenticated = false (因為 token 無效)');
  console.log('     - 路由守衛檢查 hasToken 會認為已登入');
  console.log('     - 但實際上 authStore.isAuthenticated = false');
  console.log('     - 結果: 無限重定向循環!');
} else if (hasToken && isTokenValid && !hasAgent) {
  console.log('  ⚠️  問題發現: Token 有效但 currentAgent 不存在!');
  console.log('  💡 這可能需要重新獲取用戶信息');
} else if (hasToken && isTokenValid && hasAgent && isSessionValid) {
  console.log('  ✅ 認證狀態正常');
} else if (!hasToken) {
  console.log('  ✅ 未登入狀態正常 (無 token)');
} else {
  console.log('  ⚠️  其他情況，需要進一步檢查');
}

console.log('\n=== Auth Store 診斷結束 ===');
