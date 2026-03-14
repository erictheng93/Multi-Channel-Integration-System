/**
 * Week 1 Implementation Validation Script
 * 验证 File Management 和 Analytics Platform Filter 功能
 */

interface ValidationResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: ValidationResult[] = [];

// API Base URL (根据环境调整)
const API_URL = process.env.API_URL || 'http://localhost:8787';

// 测试用的 JWT Token（需要实际的 token）
const TEST_TOKEN = process.env.TEST_TOKEN || '';

/**
 * 测试 1: File Management Health Check
 */
async function testFileManagementHealth(): Promise<ValidationResult> {
  try {
    const response = await fetch(`${API_URL}/api/files/health`);
    const data = await response.json();

    const passed = response.ok &&
                   data.data?.status === 'healthy' &&
                   data.data?.module === 'file-management';

    return {
      test: 'File Management Health Check',
      passed,
      message: passed ? ' 健康检查通过' : ' 健康检查失败',
      details: data
    };
  } catch (error) {
    return {
      test: 'File Management Health Check',
      passed: false,
      message: ` 请求失败: ${error}`,
      details: error
    };
  }
}

/**
 * 测试 2: File Management Info Endpoint
 */
async function testFileManagementInfo(): Promise<ValidationResult> {
  if (!TEST_TOKEN) {
    return {
      test: 'File Management Info',
      passed: false,
      message: '  跳过：需要 TEST_TOKEN 环境变量'
    };
  }

  try {
    const response = await fetch(`${API_URL}/api/files/info`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    });
    const data = await response.json();

    const passed = response.ok &&
                   data.data?.features?.length > 0;

    return {
      test: 'File Management Info',
      passed,
      message: passed ? ' Info 端点正常' : ' Info 端点异常',
      details: data
    };
  } catch (error) {
    return {
      test: 'File Management Info',
      passed: false,
      message: ` 请求失败: ${error}`,
      details: error
    };
  }
}

/**
 * 测试 3: Analytics Health Check
 */
async function testAnalyticsHealth(): Promise<ValidationResult> {
  try {
    const response = await fetch(`${API_URL}/api/analytics/health`);
    const data = await response.json();

    const passed = response.ok && data.data?.status === 'healthy';

    return {
      test: 'Analytics Health Check',
      passed,
      message: passed ? ' Analytics 健康检查通过' : ' Analytics 健康检查失败',
      details: data
    };
  } catch (error) {
    return {
      test: 'Analytics Health Check',
      passed: false,
      message: ` 请求失败: ${error}`,
      details: error
    };
  }
}

/**
 * 测试 4: 路由注册验证
 */
async function testRouteRegistration(): Promise<ValidationResult> {
  const endpoints = [
    '/api/files/health',
    '/api/analytics/health',
    '/api/reports/health'
  ];

  const results = await Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        const response = await fetch(`${API_URL}${endpoint}`);
        return { endpoint, ok: response.ok, status: response.status };
      } catch (error) {
        return { endpoint, ok: false, error: String(error) };
      }
    })
  );

  const allPassed = results.every(r => r.ok);

  return {
    test: 'Route Registration',
    passed: allPassed,
    message: allPassed ? ' 所有路由注册成功' : ' 部分路由注册失败',
    details: results
  };
}

/**
 * 测试 5: TypeScript 编译验证
 */
async function testTypeScriptCompilation(): Promise<ValidationResult> {
  try {
    const { execSync } = require('child_process');
    execSync('npm run build', { encoding: 'utf-8', stdio: 'pipe' });

    return {
      test: 'TypeScript Compilation',
      passed: true,
      message: ' TypeScript 编译成功'
    };
  } catch (error: any) {
    return {
      test: 'TypeScript Compilation',
      passed: false,
      message: ' TypeScript 编译失败',
      details: error.stdout || error.message
    };
  }
}

/**
 * 测试 6: 数据库索引验证
 */
async function testDatabaseIndexes(): Promise<ValidationResult> {
  try {
    const { execSync } = require('child_process');
    const output = execSync(
      'wrangler d1 execute mcis-db --command "SELECT name FROM sqlite_master WHERE type=\'index\' AND name LIKE \'idx_customers_%\';"',
      { encoding: 'utf-8' }
    );

    const hasRequiredIndexes =
      output.includes('idx_customers_platform_id') &&
      output.includes('idx_customers_id');

    return {
      test: 'Database Indexes',
      passed: hasRequiredIndexes,
      message: hasRequiredIndexes ? ' 所需索引已创建' : ' 缺少必需索引',
      details: output
    };
  } catch (error: any) {
    return {
      test: 'Database Indexes',
      passed: false,
      message: ' 索引检查失败',
      details: error.message
    };
  }
}

/**
 * 运行所有验证测试
 */
async function runAllValidations() {
  console.log(' 开始 Week 1 实施验证...\n');

  // 运行所有测试
  const tests = [
    testTypeScriptCompilation(),
    testDatabaseIndexes(),
    testRouteRegistration(),
    testFileManagementHealth(),
    testFileManagementInfo(),
    testAnalyticsHealth()
  ];

  const results = await Promise.all(tests);

  // 打印结果
  console.log(' 验证结果:\n');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.test}: ${result.message}`);
    if (result.details && !result.passed) {
      console.log(` 详情: ${JSON.stringify(result.details, null, 2)}`);
    }
  });

  // 统计
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);

  console.log('\n' + '='.repeat(60));
  console.log(` 通过: ${passed}/${total} (${percentage}%)`);
  console.log('='.repeat(60));

  // 生成报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed: total - passed,
      percentage
    },
    results
  };

  // 保存报告到文件
  const fs = require('fs');
  const reportPath = './test-results/week1-validation-report.json';
  fs.mkdirSync('./test-results', { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n 详细报告已保存到: ${reportPath}`);

  // 如果所有测试都通过，返回 0，否则返回 1
  process.exit(passed === total ? 0 : 1);
}

// 运行验证
runAllValidations().catch((error) => {
  console.error(' 验证过程出错:', error);
  process.exit(1);
});
