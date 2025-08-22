// 測試登入
const bcrypt = require('bcryptjs');

async function testPassword() {
  const password = '16011587DaC';
  const hash = await bcrypt.hash(password, 12);
  console.log('New hash:', hash);
  
  const isValid = await bcrypt.compare(password, hash);
  console.log('Verification:', isValid);
}

testPassword();