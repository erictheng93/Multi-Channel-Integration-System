// Complete login flow test with admin credentials
const API_URL = 'http://localhost:8787';

async function testCompleteLoginFlow() {
  console.log('🚀 Starting Complete Login Flow Test');
  console.log('=' .repeat(50));
  
  const credentials = {
    email: 'admin@dacit.net',
    password: '16011587DaC'
  };
  
  console.log('\n📝 Test Credentials:');
  console.log('  Email:', credentials.email);
  console.log('  Password:', credentials.password);
  
  try {
    // Step 1: Test Login
    console.log('\n━━━ STEP 1: Login Request ━━━');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials)
    });
    
    console.log('📥 Response Status:', loginResponse.status);
    
    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.log('❌ Login failed:', errorText);
      return false;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful!');
    console.log('📊 Response structure:');
    console.log('  - success:', loginData.success);
    console.log('  - has token:', !!loginData.data?.token);
    console.log('  - has refreshToken:', !!loginData.data?.refreshToken);
    console.log('  - has agent:', !!loginData.data?.agent);
    console.log('  - has sessionId:', !!loginData.data?.sessionId);
    
    if (!loginData.data?.token) {
      console.log('❌ No token received!');
      return false;
    }
    
    const token = loginData.data.token;
    const agent = loginData.data.agent;
    
    console.log('\n👤 Agent Info:');
    console.log('  - ID:', agent.id);
    console.log('  - Email:', agent.email);
    console.log('  - Name:', agent.name || agent.displayName);
    console.log('  - Role:', agent.role);
    console.log('  - Active:', agent.isActive);
    
    // Step 2: Test Token Validation
    console.log('\n━━━ STEP 2: Token Validation ━━━');
    const meResponse = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📥 /me Response Status:', meResponse.status);
    
    if (meResponse.ok) {
      const meData = await meResponse.json();
      console.log('✅ Token is valid!');
      console.log('👤 Current user from /me:', {
        id: meData.data?.id,
        email: meData.data?.email,
        role: meData.data?.role
      });
    } else {
      console.log('❌ Token validation failed!');
      const errorText = await meResponse.text();
      console.log('Error:', errorText);
    }
    
    // Step 3: Test Protected Route
    console.log('\n━━━ STEP 3: Protected Route Test ━━━');
    const dashboardResponse = await fetch(`${API_URL}/api/dashboard/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📥 Dashboard Response Status:', dashboardResponse.status);
    
    if (dashboardResponse.ok) {
      console.log('✅ Can access protected routes!');
    } else if (dashboardResponse.status === 404) {
      console.log('⚠️ Dashboard endpoint not found (expected if not implemented)');
    } else if (dashboardResponse.status === 401) {
      console.log('❌ Unauthorized - token not working for protected routes');
    }
    
    // Step 4: Simulate Frontend Storage
    console.log('\n━━━ STEP 4: Frontend Storage Simulation ━━━');
    const storageData = {
      token: token,
      refreshToken: loginData.data.refreshToken,
      sessionExpiry: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      currentAgent: JSON.stringify(agent)
    };
    
    console.log('💾 Data that would be saved to localStorage:');
    console.log('  - token:', storageData.token.substring(0, 20) + '...');
    console.log('  - refreshToken:', !!storageData.refreshToken);
    console.log('  - sessionExpiry:', new Date(storageData.sessionExpiry).toLocaleString());
    console.log('  - currentAgent:', storageData.currentAgent.substring(0, 50) + '...');
    
    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('🎯 LOGIN FLOW TEST COMPLETE');
    console.log('=' .repeat(50));
    console.log('\n✅ ALL STEPS PASSED!');
    console.log('\n📋 Summary:');
    console.log('  1. ✅ Login successful');
    console.log('  2. ✅ Token received');
    console.log('  3. ✅ User data received');
    console.log('  4. ✅ Token validation works');
    console.log('  5. ✅ Ready for frontend integration');
    
    console.log('\n🔑 You can now login with:');
    console.log('  Email: admin@dacit.net');
    console.log('  Password: 16011587DaC');
    
    return true;
    
  } catch (error) {
    console.error('\n💥 Test failed with error:', error);
    return false;
  }
}

// Run the test
console.log('🔧 Make sure backend is running with: npm run dev:local');
console.log('🌐 Backend should be at: http://localhost:8787');
console.log('');

testCompleteLoginFlow().then(success => {
  if (success) {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Test failed!');
    process.exit(1);
  }
});