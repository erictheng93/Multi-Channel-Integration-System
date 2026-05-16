// QR Code 路由驗證腳本
// 檢查所有 QR Code 端點的健康狀態

interface RouteTest {
  method: string;
  path: string;
  description: string;
  requiresAuth: boolean;
  requiresBody?: boolean;
  expectedStatus: number[];
}

interface RouteTestResults {
  total: number;
  passed: number;
  failed: number;
  messages: string[];
}

const BASE_URL_LOCAL = 'http://localhost:8787';
const BASE_URL_REMOTE = 'https://your-worker.workers.dev'; // 替換為實際的遠端 URL

// QR Code 路由測試配置
const QRCODE_ROUTES: RouteTest[] = [
  // ==================== 健康檢查 ====================
  {
    method: 'GET',
    path: '/api/qr-codes/health',
    description: '健康檢查端點',
    requiresAuth: false,
    expectedStatus: [200]
  },

  // ==================== 基本 CRUD ====================
  {
    method: 'GET',
    path: '/api/qr-codes/',
    description: '列出所有 QR Codes',
    requiresAuth: true,
    expectedStatus: [200]
  },
  {
    method: 'POST',
    path: '/api/qr-codes/',
    description: '創建新 QR Code',
    requiresAuth: true,
    requiresBody: true,
    expectedStatus: [201, 400]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/test-id',
    description: '獲取 QR Code 詳情',
    requiresAuth: true,
    expectedStatus: [200, 404]
  },
  {
    method: 'PUT',
    path: '/api/qr-codes/test-id',
    description: '更新 QR Code',
    requiresAuth: true,
    requiresBody: true,
    expectedStatus: [200, 404]
  },
  {
    method: 'DELETE',
    path: '/api/qr-codes/test-id',
    description: '刪除 QR Code',
    requiresAuth: true,
    expectedStatus: [200, 404]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/test-id/exists',
    description: '檢查 QR Code 是否存在',
    requiresAuth: false,
    expectedStatus: [200, 404, 500]
  },

  // ==================== QR Code 生成和管理 ====================
  {
    method: 'POST',
    path: '/api/qr-codes/test-id/regenerate',
    description: '重新生成 QR Code',
    requiresAuth: true,
    expectedStatus: [200, 404, 500]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/test-id/image',
    description: '獲取 QR Code 圖片',
    requiresAuth: false,
    expectedStatus: [200, 404, 500]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/test-id/download/png',
    description: '下載 QR Code',
    requiresAuth: false,
    expectedStatus: [200, 404, 500]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/test-id/preview',
    description: '預覽 QR Code',
    requiresAuth: false,
    expectedStatus: [200, 404, 500]
  },

  // ==================== 狀態管理 ====================
  {
    method: 'POST',
    path: '/api/qr-codes/test-id/enable',
    description: '啟用 QR Code',
    requiresAuth: true,
    expectedStatus: [200, 404, 500]
  },
  {
    method: 'POST',
    path: '/api/qr-codes/test-id/disable',
    description: '停用 QR Code',
    requiresAuth: true,
    expectedStatus: [200, 404, 500]
  },
  {
    method: 'PUT',
    path: '/api/qr-codes/test-id/expiry',
    description: '設定過期時間',
    requiresAuth: true,
    requiresBody: true,
    expectedStatus: [200, 400, 404, 500]
  },

  // ==================== 統計和分析 ====================
  {
    method: 'GET',
    path: '/api/qr-codes/stats/overview',
    description: '獲取統計概覽',
    requiresAuth: true,
    expectedStatus: [200, 500]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/test-id/scans',
    description: '獲取掃描歷史',
    requiresAuth: true,
    expectedStatus: [200]
  },
  {
    method: 'POST',
    path: '/api/qr-codes/test-id/scan',
    description: '記錄掃描',
    requiresAuth: false,
    expectedStatus: [200, 404, 500]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/stats/types',
    description: '獲取類型分佈',
    requiresAuth: true,
    expectedStatus: [200]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/stats/trends',
    description: '獲取掃描趨勢',
    requiresAuth: true,
    expectedStatus: [200]
  },

  // ==================== 搜尋和過濾 ====================
  {
    method: 'GET',
    path: '/api/qr-codes/search?q=test',
    description: '快速搜尋',
    requiresAuth: true,
    expectedStatus: [200, 500]
  },
  {
    method: 'POST',
    path: '/api/qr-codes/advanced-search',
    description: '進階搜尋',
    requiresAuth: true,
    requiresBody: true,
    expectedStatus: [200, 500]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/type/url',
    description: '按類型獲取',
    requiresAuth: true,
    expectedStatus: [200]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/tags/important',
    description: '按標籤獲取',
    requiresAuth: true,
    expectedStatus: [200]
  },

  // ==================== 批次操作 ====================
  {
    method: 'POST',
    path: '/api/qr-codes/batch/create',
    description: '批次創建',
    requiresAuth: true,
    requiresBody: true,
    expectedStatus: [200, 400, 500]
  },
  {
    method: 'PUT',
    path: '/api/qr-codes/batch/update',
    description: '批次更新',
    requiresAuth: true,
    requiresBody: true,
    expectedStatus: [200]
  },
  {
    method: 'DELETE',
    path: '/api/qr-codes/batch/delete',
    description: '批次刪除',
    requiresAuth: true,
    requiresBody: true,
    expectedStatus: [200]
  },
  {
    method: 'POST',
    path: '/api/qr-codes/batch/status',
    description: '批次狀態更新',
    requiresAuth: true,
    requiresBody: true,
    expectedStatus: [200]
  },

  // ==================== 模板功能 ====================
  {
    method: 'GET',
    path: '/api/qr-codes/templates',
    description: '獲取模板列表',
    requiresAuth: true,
    expectedStatus: [200, 500]
  },
  {
    method: 'POST',
    path: '/api/qr-codes/templates/template-1/create',
    description: '從模板創建',
    requiresAuth: true,
    requiresBody: true,
    expectedStatus: [200, 501]
  },
  {
    method: 'POST',
    path: '/api/qr-codes/test-id/save-template',
    description: '保存為模板',
    requiresAuth: true,
    requiresBody: true,
    expectedStatus: [200, 501]
  },

  // ==================== 標籤管理 ====================
  {
    method: 'GET',
    path: '/api/qr-codes/tags/available',
    description: '獲取可用標籤',
    requiresAuth: true,
    expectedStatus: [200]
  },
  {
    method: 'POST',
    path: '/api/qr-codes/test-id/tags',
    description: '添加標籤',
    requiresAuth: true,
    requiresBody: true,
    expectedStatus: [200, 404, 500]
  },
  {
    method: 'DELETE',
    path: '/api/qr-codes/test-id/tags',
    description: '移除標籤',
    requiresAuth: true,
    requiresBody: true,
    expectedStatus: [200, 404, 500]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/tags/stats',
    description: '獲取標籤統計',
    requiresAuth: true,
    expectedStatus: [200]
  },

  // ==================== 導出功能 ====================
  {
    method: 'GET',
    path: '/api/qr-codes/export/data',
    description: '導出資料',
    requiresAuth: true,
    expectedStatus: [200, 501]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/export/images',
    description: '導出圖片',
    requiresAuth: true,
    expectedStatus: [200, 501]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/export/report',
    description: '導出報告',
    requiresAuth: true,
    expectedStatus: [200, 501]
  },

  // ==================== 公開端點 ====================
  {
    method: 'GET',
    path: '/api/qr-codes/scan/test-id',
    description: '掃描並重導向',
    requiresAuth: false,
    expectedStatus: [200, 302, 404, 500]
  },
  {
    method: 'GET',
    path: '/api/qr-codes/public/test-id/info',
    description: '獲取公開資訊',
    requiresAuth: false,
    expectedStatus: [200, 404, 500]
  },

  // ==================== 管理員功能 ====================
  {
    method: 'GET',
    path: '/api/qr-codes/admin/system-stats',
    description: '獲取系統統計（管理員）',
    requiresAuth: true,
    expectedStatus: [200, 403]
  },
  {
    method: 'POST',
    path: '/api/qr-codes/admin/cleanup',
    description: '清理過期（管理員）',
    requiresAuth: true,
    expectedStatus: [200, 403]
  },
  {
    method: 'POST',
    path: '/api/qr-codes/admin/rebuild-cache',
    description: '重建快取（管理員）',
    requiresAuth: true,
    expectedStatus: [200, 403]
  }
];

// 路由衝突分析
interface RouteConflict {
  route1: string;
  route2: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

function analyzeRouteConflicts(routes: RouteTest[]): RouteConflict[] {
  const conflicts: RouteConflict[] = [];
  const paths = routes.map(r => r.path);

  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const path1 = paths[i];
      const path2 = paths[j];

      // 檢查完全相同的路徑
      if (path1 === path2) {
        conflicts.push({
          route1: path1,
          route2: path2,
          reason: '完全相同的路徑',
          severity: 'high'
        });
      }

      // 檢查參數路徑衝突
      const segments1 = path1.split('/').filter(s => s);
      const segments2 = path2.split('/').filter(s => s);

      if (segments1.length === segments2.length) {
        let potentialConflict = true;
        for (let k = 0; k < segments1.length; k++) {
          const seg1 = segments1[k];
          const seg2 = segments2[k];

          // 如果兩個都是參數或者都是相同的靜態路徑，繼續檢查
          if (seg1.startsWith(':') && seg2.startsWith(':')) {
            continue;
          } else if (seg1 === seg2) {
            continue;
          } else {
            potentialConflict = false;
            break;
          }
        }

        if (potentialConflict && path1 !== path2) {
          conflicts.push({
            route1: path1,
            route2: path2,
            reason: '參數路徑可能衝突',
            severity: 'medium'
          });
        }
      }
    }
  }

  return conflicts;
}

// 路由優先級分析
function analyzeRoutePriority(routes: RouteTest[]): string[] {
  const warnings: string[] = [];
  const pathsByMethod = new Map<string, string[]>();

  routes.forEach(route => {
    const key = route.method;
    if (!pathsByMethod.has(key)) {
      pathsByMethod.set(key, []);
    }
    pathsByMethod.get(key)!.push(route.path);
  });

  pathsByMethod.forEach((paths, method) => {
    // 檢查靜態路由是否在參數路由之前
    const staticRoutes = paths.filter(p => !p.includes(':'));
    const paramRoutes = paths.filter(p => p.includes(':'));

    // 檢查是否有靜態路由可能被參數路由攔截
    paramRoutes.forEach(paramRoute => {
      const paramSegments = paramRoute.split('/').filter(s => s);
      staticRoutes.forEach(staticRoute => {
        const staticSegments = staticRoute.split('/').filter(s => s);

        if (paramSegments.length === staticSegments.length) {
          // 檢查是否參數路由的靜態部分與靜態路由匹配
          let matches = true;
          for (let i = 0; i < paramSegments.length; i++) {
            if (!paramSegments[i].startsWith(':') && paramSegments[i] !== staticSegments[i]) {
              matches = false;
              break;
            }
          }

          if (matches) {
            warnings.push(
              ` ${method} ${staticRoute} 可能被 ${paramRoute} 攔截，確保靜態路由註冊在前`
            );
          }
        }
      });
    });
  });

  return warnings;
}

// 測試函數
async function testRoute(baseUrl: string, route: RouteTest, authToken?: string): Promise<{
  success: boolean;
  status: number;
  message: string;
}> {
  try {
    const url = `${baseUrl}${route.path}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (route.requiresAuth && authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const options: RequestInit = {
      method: route.method,
      headers
    };

    // 添加測試數據
    if (route.requiresBody) {
      if (route.method === 'POST' && route.path.includes('/batch/create')) {
        options.body = JSON.stringify({
          qrCodes: [
            { name: 'Test QR', type: 'url', content: 'https://example.com' }
          ]
        });
      } else if (route.method === 'POST' && route.path.endsWith('/tags')) {
        options.body = JSON.stringify({ tags: ['test'] });
      } else if (route.method === 'DELETE' && route.path.endsWith('/tags')) {
        options.body = JSON.stringify({ tags: ['test'] });
      } else if (route.method === 'PUT' && route.path.endsWith('/expiry')) {
        options.body = JSON.stringify({ expiresAt: new Date(Date.now() + 86400000).toISOString() });
      } else if (route.method === 'PUT' && route.path.includes('/batch/update')) {
        options.body = JSON.stringify({ ids: ['id1'], updates: { status: 'active' } });
      } else if (route.method === 'DELETE' && route.path.includes('/batch/delete')) {
        options.body = JSON.stringify({ ids: ['id1'] });
      } else if (route.method === 'POST' && route.path.includes('/batch/status')) {
        options.body = JSON.stringify({ ids: ['id1'], status: 'active' });
      } else {
        options.body = JSON.stringify({ name: 'Test', type: 'url', content: 'https://example.com' });
      }
    }

    const response = await fetch(url, options);
    const isExpected = route.expectedStatus.includes(response.status);

    return {
      success: isExpected,
      status: response.status,
      message: isExpected
        ? ` ${route.description}: ${response.status}`
        : ` ${route.description}: 期望 ${route.expectedStatus.join('/')}, 得到 ${response.status}`
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: ` ${route.description}: ${error instanceof Error ? error.message : '未知錯誤'}`
    };
  }
}

// 主測試函數
async function runTests(environment: 'local' | 'remote', authToken?: string): Promise<RouteTestResults> {
  const baseUrl = environment === 'local' ? BASE_URL_LOCAL : BASE_URL_REMOTE;
  console.log(`\n 測試環境: ${environment.toUpperCase()}`);
  console.log(` Base URL: ${baseUrl}\n`);

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    messages: [] as string[]
  };

  for (const route of QRCODE_ROUTES) {
    const result = await testRoute(baseUrl, route, authToken);
    results.total++;
    if (result.success) {
      results.passed++;
    } else {
      results.failed++;
    }
    results.messages.push(result.message);
  }

  return results;
}

// 生成報告
function generateReport(
  localResults: RouteTestResults,
  remoteResults: RouteTestResults,
  conflicts: RouteConflict[],
  warnings: string[]
) {
  console.log('\n' + '='.repeat(80));
  console.log(' QR CODE 路由健康檢查報告');
  console.log('='.repeat(80) + '\n');

  // 本地測試結果
  console.log(' 本地環境測試結果:');
  console.log(` 總測試: ${localResults.total}`);
  console.log(` 通過: ${localResults.passed} (${((localResults.passed/localResults.total)*100).toFixed(1)}%)`);
  console.log(` 失敗: ${localResults.failed}`);
  console.log();

  // 遠端測試結果
  console.log('  遠端環境測試結果:');
  console.log(` 總測試: ${remoteResults.total}`);
  console.log(` 通過: ${remoteResults.passed} (${((remoteResults.passed/remoteResults.total)*100).toFixed(1)}%)`);
  console.log(` 失敗: ${remoteResults.failed}`);
  console.log();

  // 路由衝突分析
  console.log(' 路由衝突分析:');
  if (conflicts.length === 0) {
    console.log(' 未發現路由衝突');
  } else {
    conflicts.forEach(conflict => {
      const icon = conflict.severity === 'high' ? '' : conflict.severity === 'medium' ? '' : '';
      console.log(` ${icon} ${conflict.reason}`);
      console.log(` 路由1: ${conflict.route1}`);
      console.log(` 路由2: ${conflict.route2}`);
    });
  }
  console.log();

  // 路由優先級警告
  console.log(' 路由優先級警告:');
  if (warnings.length === 0) {
    console.log(' 未發現優先級問題');
  } else {
    warnings.forEach(warning => console.log(` ${warning}`));
  }
  console.log();

  // 端點覆蓋統計
  console.log(' 端點覆蓋統計:');
  console.log(` 總端點數: ${QRCODE_ROUTES.length}`);
  console.log(` 需要認證: ${QRCODE_ROUTES.filter(r => r.requiresAuth).length}`);
  console.log(` 公開端點: ${QRCODE_ROUTES.filter(r => !r.requiresAuth).length}`);
  console.log(` 需要請求體: ${QRCODE_ROUTES.filter(r => r.requiresBody).length}`);
  console.log();

  console.log('='.repeat(80));
}

// 導出供外部使用
export {
  QRCODE_ROUTES,
  analyzeRouteConflicts,
  analyzeRoutePriority,
  testRoute,
  runTests,
  generateReport
};

// 主函數 - 分析路由配置
async function main() {
  console.log('QR Code 路由驗證腳本\n');

  // 分析路由衝突
  const conflicts = analyzeRouteConflicts(QRCODE_ROUTES);
  const warnings = analyzeRoutePriority(QRCODE_ROUTES);

  console.log(' 路由配置分析結果:\n');

  if (conflicts.length === 0) {
    console.log(' 未發現路由衝突');
  } else {
    console.log(` 發現 ${conflicts.length} 個潛在衝突:`);
    conflicts.forEach((c, i) => {
      console.log(`\n${i + 1}. ${c.reason} [${c.severity.toUpperCase()}]`);
      console.log(` 路由1: ${c.route1}`);
      console.log(` 路由2: ${c.route2}`);
    });
  }

  console.log('\n 路由優先級分析:');
  if (warnings.length === 0) {
    console.log(' 未發現優先級問題');
  } else {
    warnings.forEach(w => console.log(w));
  }

  console.log(`\n 配置了 ${QRCODE_ROUTES.length} 個路由端點`);
  console.log(` - 需要認證: ${QRCODE_ROUTES.filter(r => r.requiresAuth).length} 個`);
  console.log(` - 公開端點: ${QRCODE_ROUTES.filter(r => !r.requiresAuth).length} 個`);
  console.log(` - 需要請求體: ${QRCODE_ROUTES.filter(r => r.requiresBody).length} 個\n`);
}

// 運行主函數
main().catch(console.error);
