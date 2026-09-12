/**
 * Login helper for obtaining a JWT token and smoke-testing authenticated message APIs.
 *
 * Usage:
 *   TEST_ADMIN_EMAIL=admin@example.com TEST_ADMIN_PASSWORD=... bunx tsx scripts/admin/login-and-test.ts
 */

const REMOTE_URL = process.env.TEST_API_URL || 'https://your-api-domain.example.com';

const credentials = {
  email: process.env.TEST_ADMIN_EMAIL,
  password: process.env.TEST_ADMIN_PASSWORD
};

type LoginResponse = {
  token?: string;
  user?: {
    id?: string | number;
    email?: string;
    role?: string;
    teamId?: string | number | null;
  };
  error?: string;
  message?: string;
};

async function login(): Promise<string | null> {
  console.log('Logging in...');
  console.log(`Email: ${credentials.email}`);

  if (!credentials.email || !credentials.password) {
    console.error('Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD before running this script.');
    return null;
  }

  try {
    const response = await fetch(`${REMOTE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    const data = await response.json() as LoginResponse;

    if (!response.ok || !data.token) {
      console.error(`Login failed: ${data.error || data.message || response.statusText}`);
      return null;
    }

    console.log('Login succeeded.');
    console.log('JWT token:');
    console.log(data.token);

    if (data.user) {
      console.log('User:');
      console.log(`  ID: ${data.user.id ?? 'N/A'}`);
      console.log(`  Email: ${data.user.email ?? 'N/A'}`);
      console.log(`  Role: ${data.user.role ?? 'N/A'}`);
      console.log(`  Team ID: ${data.user.teamId ?? 'N/A'}`);
    }

    console.log('PowerShell:');
    console.log(`  $env:TEST_JWT_TOKEN="${data.token}"`);

    return data.token;
  } catch (error) {
    console.error('Login request failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function testToken(token: string): Promise<void> {
  console.log('Testing token against message endpoints...');

  const testEndpoints = [
    { name: 'Stats', url: '/api/messages/stats', method: 'GET' },
    { name: 'Search', url: '/api/messages/search?q=test', method: 'GET' },
    { name: 'Tags', url: '/api/messages/tags', method: 'GET' }
  ];

  for (const endpoint of testEndpoints) {
    try {
      const response = await fetch(`${REMOTE_URL}${endpoint.url}`, {
        method: endpoint.method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json().catch(() => ({}));
      const status = response.ok ? 'PASS' : 'FAIL';

      console.log(`${status} ${endpoint.name}: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const message = data?.error || data?.message || JSON.stringify(data);
        console.log(`  Error: ${message}`);
      }
    } catch (error) {
      console.log(`FAIL ${endpoint.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function main(): Promise<void> {
  const token = await login();

  if (!token) {
    console.log('No token returned. Check credentials and API URL.');
    process.exit(1);
  }

  await testToken(token);
  console.log('Token is ready for authenticated smoke tests.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
