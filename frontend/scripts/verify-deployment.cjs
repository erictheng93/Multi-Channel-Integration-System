#!/usr/bin/env node
/**
 * Deployment Verification Script
 * Verifies frontend and backend deployment status
 * Cross-platform compatible (Windows, Mac, Linux)
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  production: {
    frontend: 'https://mcis-ey7.pages.dev',
    backend: 'https://mcis-backend.daiwandist.com',
    healthEndpoint: '/api/system/health',
    wsHealthEndpoint: '/api/websocket/health'
  },
  development: {
    frontend: 'http://localhost:3000',
    backend: 'http://localhost:8787',
    healthEndpoint: '/api/system/health',
    wsHealthEndpoint: '/api/websocket/health'
  }
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log();
  log('═'.repeat(60), 'blue');
  log(`  ${title}`, 'cyan');
  log('═'.repeat(60), 'blue');
}

function logResult(label, status, details = '') {
  const icon = status ? '✅' : '❌';
  const statusColor = status ? 'green' : 'red';
  const detailStr = details ? ` (${details})` : '';
  log(`  ${icon} ${label}${detailStr}`, statusColor);
}

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Check frontend deployment
 */
async function checkFrontend(config) {
  logSection('Frontend Verification');

  try {
    const response = await makeRequest(config.frontend);
    const isHealthy = response.statusCode === 200;

    logResult('HTTP Status', isHealthy, `${response.statusCode}`);

    // Check security headers
    const securityHeaders = [
      'content-security-policy',
      'x-content-type-options',
      'x-frame-options',
      'referrer-policy'
    ];

    let headersOk = true;
    for (const header of securityHeaders) {
      const hasHeader = !!response.headers[header];
      if (!hasHeader) {
        headersOk = false;
      }
    }
    logResult('Security Headers', headersOk, `${securityHeaders.length} headers checked`);

    // Check if HTML contains Vue app mount point
    const hasVueApp = response.body.includes('id="app"') || response.body.includes('id=\\"app\\"');
    logResult('Vue App Mount Point', hasVueApp);

    return isHealthy && headersOk;
  } catch (error) {
    logResult('Frontend Access', false, error.message);
    return false;
  }
}

/**
 * Check backend API health
 */
async function checkBackend(config) {
  logSection('Backend API Verification');

  try {
    const healthUrl = config.backend + config.healthEndpoint;
    const response = await makeRequest(healthUrl);

    const isHealthy = response.statusCode === 200;
    logResult('HTTP Status', isHealthy, `${response.statusCode}`);

    if (isHealthy) {
      try {
        const healthData = JSON.parse(response.body);
        logResult('API Status', healthData.status === 'healthy', healthData.status);
        logResult('Database', healthData.database === 'connected', healthData.database);
        logResult('Version', !!healthData.version, healthData.version);

        return healthData.status === 'healthy';
      } catch (_e) {
        logResult('JSON Parse', false, 'Invalid JSON response');
        return false;
      }
    }

    return false;
  } catch (error) {
    logResult('Backend Access', false, error.message);
    return false;
  }
}

/**
 * Check WebSocket health (optional)
 */
async function checkWebSocket(config) {
  logSection('WebSocket Verification');

  try {
    const wsHealthUrl = config.backend + config.wsHealthEndpoint;
    const response = await makeRequest(wsHealthUrl);

    if (response.statusCode === 200) {
      try {
        const wsData = JSON.parse(response.body);
        logResult('WebSocket Status', wsData.status === 'healthy', wsData.status || 'unknown');
        return wsData.status === 'healthy';
      } catch (_e) {
        logResult('WebSocket Health', true, 'Endpoint available');
        return true;
      }
    } else if (response.statusCode === 401) {
      logResult('WebSocket Health', true, 'Requires authentication (expected)');
      return true;
    } else {
      logResult('WebSocket Health', false, `Status ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    logResult('WebSocket Access', false, error.message);
    return false;
  }
}

/**
 * Main verification function
 */
async function verifyDeployment(environment = 'production') {
  console.log();
  log('╔═══════════════════════════════════════════════════════════════╗', 'cyan');
  log('║       🔍 Deployment Verification Script                       ║', 'bright');
  log('╚═══════════════════════════════════════════════════════════════╝', 'cyan');

  const config = CONFIG[environment];
  if (!config) {
    log(`\n❌ Unknown environment: ${environment}`, 'red');
    log('   Available: production, development', 'yellow');
    process.exit(1);
  }

  log(`\n📍 Environment: ${environment}`, 'yellow');
  log(`   Frontend: ${config.frontend}`, 'blue');
  log(`   Backend: ${config.backend}`, 'blue');

  const results = {
    frontend: await checkFrontend(config),
    backend: await checkBackend(config),
    websocket: await checkWebSocket(config)
  };

  // Summary
  logSection('Verification Summary');

  const allPassed = Object.values(results).every(r => r);

  logResult('Frontend', results.frontend);
  logResult('Backend API', results.backend);
  logResult('WebSocket', results.websocket);

  console.log();
  if (allPassed) {
    log('╔═══════════════════════════════════════════════════════════════╗', 'green');
    log('║  🎉 All checks passed! Deployment is healthy.                 ║', 'green');
    log('╚═══════════════════════════════════════════════════════════════╝', 'green');
    process.exit(0);
  } else {
    log('╔═══════════════════════════════════════════════════════════════╗', 'red');
    log('║  ⚠️  Some checks failed. Please review the results above.     ║', 'red');
    log('╚═══════════════════════════════════════════════════════════════╝', 'red');
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let environment = 'production';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-Environment' || args[i] === '--env' || args[i] === '-e') {
    environment = args[i + 1] || 'production';
  } else if (!args[i].startsWith('-')) {
    environment = args[i];
  }
}

// Run verification
verifyDeployment(environment);
