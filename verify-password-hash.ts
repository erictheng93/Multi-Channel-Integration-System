import bcrypt from 'bcryptjs';

async function verifyPasswordHash() {
  const password = '16011587DaC';
  const storedHash = '$2a$12$UIsYL7dO1fVE.ydLNXe.GuxSW7loLKNtzJgY8cZM5mPHKYywE7m0y';
  
  console.log('🔐 Verifying Password Hash');
  console.log('=' .repeat(50));
  console.log('Password:', password);
  console.log('Stored Hash:', storedHash);
  console.log('');
  
  // Test 1: Verify the stored hash
  const isValid = await bcrypt.compare(password, storedHash);
  console.log('✅ Hash Verification:', isValid ? 'VALID' : 'INVALID');
  
  // Test 2: Generate a new hash for comparison
  const newHash = await bcrypt.hash(password, 12);
  console.log('🔑 New Hash Generated:', newHash);
  
  // Test 3: Verify the new hash
  const newHashValid = await bcrypt.compare(password, newHash);
  console.log('✅ New Hash Verification:', newHashValid ? 'VALID' : 'INVALID');
  
  // Test 4: Test API Login
  console.log('\n' + '=' .repeat(50));
  console.log('🌐 Testing API Login');
  console.log('=' .repeat(50));
  
  try {
    const response = await fetch('http://localhost:8787/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@dacit.net',
        password: '16011587DaC'
      })
    });
    
    console.log('📥 Response Status:', response.status);
    const responseText = await response.text();
    
    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('✅ Login Successful!');
      console.log('Token:', data.data?.token ? 'Received' : 'Not received');
      console.log('Agent:', data.data?.agent?.email);
    } else {
      console.log('❌ Login Failed!');
      console.log('Response:', responseText);
      
      // Try to parse error
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error Message:', errorData.error);
        if (errorData.details) {
          console.log('Error Details:', errorData.details);
        }
      } catch {
        console.log('Raw Response:', responseText);
      }
    }
  } catch (error) {
    console.error('💥 Network Error:', error);
    console.log('Make sure backend is running with: npm run dev:local');
  }
  
  return isValid;
}

verifyPasswordHash().then(valid => {
  console.log('\n' + '=' .repeat(50));
  if (valid) {
    console.log('✅ Password hash is correct!');
    console.log('The issue might be with the backend authentication logic.');
  } else {
    console.log('❌ Password hash is incorrect!');
    console.log('Need to update the password hash in the database.');
  }
});