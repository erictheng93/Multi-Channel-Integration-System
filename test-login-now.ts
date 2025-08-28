// Test admin login
async function testAdminLogin() {
  const credentials = {
    email: 'admin@dacit.net',
    password: '16011587DaC'
  };

  console.log('🔐 Testing admin login...');
  console.log('   Email:', credentials.email);
  console.log('   Password:', credentials.password);

  try {
    const response = await fetch('http://localhost:8787/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials)
    });

    const responseText = await response.text();
    console.log('\n📥 Response Status:', response.status);
    
    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('✅ Login successful!');
      console.log('\n📊 Response data:');
      console.log('   Success:', data.success);
      console.log('   Message:', data.message);
      
      if (data.data) {
        console.log('\n🎫 Token info:');
        console.log('   Token:', data.data.token ? data.data.token.substring(0, 50) + '...' : 'Not received');
        console.log('   Refresh Token:', data.data.refreshToken ? 'Received' : 'Not received');
        console.log('   Expires In:', data.data.expiresIn, 'seconds');
        
        if (data.data.agent) {
          console.log('\n👤 Agent info:');
          console.log('   ID:', data.data.agent.id);
          console.log('   Email:', data.data.agent.email);
          console.log('   Name:', data.data.agent.name || data.data.agent.displayName);
          console.log('   Role:', data.data.agent.role);
          console.log('   Active:', data.data.agent.isActive);
        }
        
        // Test token validation
        if (data.data.token) {
          console.log('\n🔍 Testing token validation...');
          const validateResponse = await fetch('http://localhost:8787/api/auth/validate', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${data.data.token}`
            }
          });
          
          const validateText = await validateResponse.text();
          if (validateResponse.ok) {
            const validateData = JSON.parse(validateText);
            console.log('✅ Token is valid!');
            console.log('   Valid:', validateData.data?.valid);
            if (validateData.data?.payload) {
              console.log('   User ID:', validateData.data.payload.userId);
              console.log('   Role:', validateData.data.payload.role);
            }
          } else {
            console.log('❌ Token validation failed:', validateResponse.status);
            console.log('   Error:', validateText);
          }
        }
      }
      
      return data;
    } else {
      console.log('❌ Login failed!');
      try {
        const errorData = JSON.parse(responseText);
        console.log('\n❌ Error details:');
        console.log('   Success:', errorData.success);
        console.log('   Error:', errorData.error);
        if (errorData.details) {
          console.log('   Details:', JSON.stringify(errorData.details, null, 2));
        }
      } catch (e) {
        console.log('   Raw error:', responseText);
      }
      return null;
    }
  } catch (error) {
    console.error('💥 Network or script error:', error);
    return null;
  }
}

// Run the test
testAdminLogin().then(result => {
  if (result) {
    console.log('\n✅ ✅ ✅ Admin login test PASSED! ✅ ✅ ✅');
    console.log('\nYou can now login with:');
    console.log('  Email: admin@dacit.net');
    console.log('  Password: 16011587DaC');
  } else {
    console.log('\n❌ ❌ ❌ Admin login test FAILED! ❌ ❌ ❌');
    console.log('\nPlease check:');
    console.log('  1. Is the backend server running? (npm run dev)');
    console.log('  2. Is the database properly initialized?');
    console.log('  3. Check the server logs for errors');
  }
}).catch(error => {
  console.error('Test execution failed:', error);
});