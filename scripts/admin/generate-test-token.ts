// 生成測試 token 的腳本
import { signJWT } from './src/utils/auth';

async function generateTestToken() {
  const JWT_SECRET = process.env.JWT_SECRET;
  const TEST_USERNAME = process.env.TEST_USERNAME;

  if (!JWT_SECRET || !TEST_USERNAME) {
    throw new Error('JWT_SECRET and TEST_USERNAME environment variables are required');
  }

  const payload = {
    userId: 1,
    username: TEST_USERNAME,
    displayName: 'Test Administrator',
    role: 'admin',
    teamId: 1,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小時
  };

  try {
    const token = await signJWT(payload, JWT_SECRET);

    console.log(' 測試 Token 生成成功\n');
    console.log('Token 資訊:');
    console.log(`  User ID: ${payload.userId}`);
    console.log(`  Username: ${payload.username}`);
    console.log(`  Role: ${payload.role}`);
    console.log(`  Team ID: ${payload.teamId}`);
    console.log(`  有效期: 24小時`);
    console.log(`  過期時間: ${new Date(payload.exp * 1000).toISOString()}\n`);
    console.log('Token:');
    console.log(token);
    console.log('\n使用方法:');
    console.log('  export LOCAL_TEST_TOKEN="' + token + '"');
    console.log('  或在 .env 文件中設置: LOCAL_TEST_TOKEN=' + token);

    return token;
  } catch (error) {
    console.error(' Token 生成失敗:', error);
    process.exit(1);
  }
}

generateTestToken();
