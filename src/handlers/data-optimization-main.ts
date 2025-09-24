// Data Optimization Management API Handler
// Phase 2: 數據存儲和查詢性能優化管理

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { jwtAuth } from '../middleware/auth';
import { createDataOptimizationService } from '../services/data-optimization-service';
import type { DataOptimizationConfig } from '../services/data-optimization-service';

const dataOptimizationHandler = new Hono<{ Bindings: Bindings }>();

// =================== 配置管理 API ===================

// 獲取數據優化配置
dataOptimizationHandler.get('/config', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (!['admin', 'team'].includes(user.role)) {
      return c.json({
        error: 'Insufficient permissions',
        message: 'Only administrators and team members can view optimization config'
      }, 403);
    }

    const optimizationService = createDataOptimizationService(c.env);
    const config = await optimizationService.getConfig();

    return c.json({
      success: true,
      config,
      retrievedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Data Optimization] Config retrieval failed:', error);
    return c.json({
      error: 'Failed to retrieve configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 更新數據優化配置
dataOptimizationHandler.put('/config', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({
        error: 'Admin access required',
        message: 'Only administrators can modify optimization configuration'
      }, 403);
    }

    const configUpdate = await c.req.json() as Partial<DataOptimizationConfig>;

    // 驗證配置參數
    const validationError = validateOptimizationConfig(configUpdate);
    if (validationError) {
      return c.json({
        error: 'Invalid configuration',
        message: validationError
      }, 400);
    }

    const optimizationService = createDataOptimizationService(c.env);
    await optimizationService.updateConfig(configUpdate);

    return c.json({
      success: true,
      message: 'Configuration updated successfully',
      updatedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Data Optimization] Config update failed:', error);
    return c.json({
      error: 'Failed to update configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// =================== 性能統計 API ===================

// 獲取查詢性能統計
dataOptimizationHandler.get('/stats', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (!['admin', 'team'].includes(user.role)) {
      return c.json({
        error: 'Insufficient permissions'
      }, 403);
    }

    const optimizationService = createDataOptimizationService(c.env);
    const stats = await optimizationService.getQueryStats();

    // 計算額外的統計信息
    const cacheHitRate = stats.totalQueries > 0 ?
      Math.round((stats.cacheHits / stats.totalQueries) * 100) : 0;

    const batchEfficiency = stats.totalQueries > 0 ?
      Math.round((stats.batchedOperations / stats.totalQueries) * 100) : 0;

    const enhancedStats = {
      ...stats,
      cacheHitRate: `${cacheHitRate}%`,
      batchEfficiency: `${batchEfficiency}%`,
      performanceGrade: getPerformanceGrade(stats.optimizationScore),
      recommendations: generateOptimizationRecommendations(stats)
    };

    return c.json({
      success: true,
      stats: enhancedStats,
      retrievedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Data Optimization] Stats retrieval failed:', error);
    return c.json({
      error: 'Failed to retrieve statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// =================== 緩存管理 API ===================

// 測試優化緩存性能
dataOptimizationHandler.post('/test-cache', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (!['admin', 'team'].includes(user.role)) {
      return c.json({
        error: 'Insufficient permissions'
      }, 403);
    }

    const { testSize = 100, testData } = await c.req.json();

    if (testSize < 10 || testSize > 1000) {
      return c.json({
        error: 'Invalid test size',
        message: 'Test size must be between 10 and 1000'
      }, 400);
    }

    const optimizationService = createDataOptimizationService(c.env);
    const testResults = await performCacheTest(optimizationService, testSize, testData);

    return c.json({
      success: true,
      testResults,
      testSize,
      testedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Data Optimization] Cache test failed:', error);
    return c.json({
      error: 'Cache test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 清理緩存
dataOptimizationHandler.post('/cleanup', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({
        error: 'Admin access required',
        message: 'Only administrators can perform cleanup operations'
      }, 403);
    }

    const { force = false } = await c.req.json();

    const optimizationService = createDataOptimizationService(c.env);
    const config = await optimizationService.getConfig();

    if (!config.cleanup.enabled && !force) {
      return c.json({
        error: 'Cleanup disabled',
        message: 'Automatic cleanup is disabled. Use force=true to override.'
      }, 400);
    }

    const cleanupResults = await optimizationService.performCleanup();

    return c.json({
      success: true,
      results: cleanupResults,
      forced: force,
      cleanedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Data Optimization] Cleanup failed:', error);
    return c.json({
      error: 'Cleanup operation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// =================== 批量操作測試 API ===================

// 測試批量操作性能
dataOptimizationHandler.post('/test-batch', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (!['admin', 'team'].includes(user.role)) {
      return c.json({
        error: 'Insufficient permissions'
      }, 403);
    }

    const { operationCount = 50, operationType = 'mixed' } = await c.req.json();

    if (operationCount < 10 || operationCount > 500) {
      return c.json({
        error: 'Invalid operation count',
        message: 'Operation count must be between 10 and 500'
      }, 400);
    }

    const optimizationService = createDataOptimizationService(c.env);
    const batchTestResults = await performBatchTest(
      optimizationService,
      operationCount,
      operationType
    );

    return c.json({
      success: true,
      testResults: batchTestResults,
      operationCount,
      operationType,
      testedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Data Optimization] Batch test failed:', error);
    return c.json({
      error: 'Batch test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// =================== 索引管理 API ===================

// 創建數據索引
dataOptimizationHandler.post('/indexes', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({
        error: 'Admin access required',
        message: 'Only administrators can create indexes'
      }, 403);
    }

    const { indexName, field, sampleData } = await c.req.json();

    if (!indexName || !field) {
      return c.json({
        error: 'Missing required fields',
        message: 'indexName and field are required'
      }, 400);
    }

    if (!Array.isArray(sampleData) || sampleData.length === 0) {
      return c.json({
        error: 'Invalid sample data',
        message: 'sampleData must be a non-empty array'
      }, 400);
    }

    const optimizationService = createDataOptimizationService(c.env);
    await optimizationService.createIndex(indexName, field, sampleData);

    return c.json({
      success: true,
      message: 'Index created successfully',
      indexName,
      field,
      recordCount: sampleData.length,
      createdBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Data Optimization] Index creation failed:', error);
    return c.json({
      error: 'Index creation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 查詢索引數據
dataOptimizationHandler.get('/indexes/:indexName/:field', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (!['admin', 'team'].includes(user.role)) {
      return c.json({
        error: 'Insufficient permissions'
      }, 403);
    }

    const indexName = c.req.param('indexName');
    const field = c.req.param('field');
    const value = c.req.query('value');

    if (!value) {
      return c.json({
        error: 'Missing value parameter',
        message: 'value query parameter is required'
      }, 400);
    }

    const optimizationService = createDataOptimizationService(c.env);
    const results = await optimizationService.queryByIndex(indexName, field, value);

    return c.json({
      success: true,
      results,
      indexName,
      field,
      value,
      resultCount: results.length,
      queriedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Data Optimization] Index query failed:', error);
    return c.json({
      error: 'Index query failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// =================== 系統健康檢查 ===================

// 數據優化系統健康檢查
dataOptimizationHandler.get('/health', async (c) => {
  try {
    const optimizationService = createDataOptimizationService(c.env);
    const config = await optimizationService.getConfig();
    const stats = await optimizationService.getQueryStats();

    const healthChecks = {
      cachingEnabled: config.caching.enabled,
      batchingEnabled: config.batching.enabled,
      indexingEnabled: config.indexing.enabled,
      cleanupEnabled: config.cleanup.enabled,
      optimizationScore: stats.optimizationScore,
      systemResponsive: true
    };

    const healthScore = Object.values(healthChecks).filter(check =>
      typeof check === 'boolean' ? check : check > 70
    ).length / Object.keys(healthChecks).length;

    const overallHealth = healthScore >= 0.8 ? 'healthy' :
                         healthScore >= 0.6 ? 'degraded' : 'unhealthy';

    return c.json({
      status: overallHealth,
      score: Math.round(healthScore * 100),
      components: healthChecks,
      recommendations: healthScore < 0.8 ?
        ['Enable all optimization features', 'Check system performance', 'Review configuration'] :
        ['System operating optimally'],
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Data Optimization] Health check failed:', error);
    return c.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, 500);
  }
});

// =================== 輔助函數 ===================

function validateOptimizationConfig(config: Partial<DataOptimizationConfig>): string | null {
  if (config.caching) {
    if (config.caching.defaultTTL && (config.caching.defaultTTL < 60 || config.caching.defaultTTL > 86400)) {
      return 'Cache TTL must be between 60 seconds and 24 hours';
    }
    if (config.caching.maxEntries && (config.caching.maxEntries < 100 || config.caching.maxEntries > 100000)) {
      return 'Max cache entries must be between 100 and 100,000';
    }
  }

  if (config.batching) {
    if (config.batching.batchSize && (config.batching.batchSize < 10 || config.batching.batchSize > 1000)) {
      return 'Batch size must be between 10 and 1000';
    }
    if (config.batching.flushInterval && (config.batching.flushInterval < 1000 || config.batching.flushInterval > 60000)) {
      return 'Flush interval must be between 1 second and 60 seconds';
    }
  }

  if (config.cleanup) {
    if (config.cleanup.retentionDays && (config.cleanup.retentionDays < 1 || config.cleanup.retentionDays > 365)) {
      return 'Retention days must be between 1 and 365';
    }
  }

  return null;
}

function getPerformanceGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function generateOptimizationRecommendations(stats: any): string[] {
  const recommendations: string[] = [];

  if (stats.totalQueries > 0) {
    const hitRate = stats.cacheHits / stats.totalQueries;

    if (hitRate < 0.5) {
      recommendations.push('Consider increasing cache TTL or reviewing cache strategy');
    }

    if (stats.averageLatency > 1000) {
      recommendations.push('High query latency detected - enable batching and indexing');
    }

    if (stats.batchedOperations / stats.totalQueries < 0.3) {
      recommendations.push('Low batch operation usage - consider enabling batch processing');
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Performance is optimal - continue monitoring');
  }

  return recommendations;
}

async function performCacheTest(service: any, testSize: number, testData?: any[]): Promise<any> {
  const startTime = Date.now();
  const testKeys: string[] = [];

  try {
    // 生成測試數據
    const data = testData || Array.from({ length: testSize }, (_, i) => ({
      id: `test_${i}`,
      data: `Test data entry ${i}`,
      timestamp: Date.now() + i
    }));

    // 測試寫入性能
    for (let i = 0; i < testSize; i++) {
      const key = `cache_test_${i}`;
      testKeys.push(key);
      await service.optimizedSet(key, JSON.stringify(data[i]), 300); // 5 minutes TTL
    }

    const writeTime = Date.now() - startTime;

    // 測試讀取性能
    const readStartTime = Date.now();
    let hits = 0;

    for (const key of testKeys) {
      const value = await service.optimizedGet(key);
      if (value) hits++;
    }

    const readTime = Date.now() - readStartTime;

    return {
      testSize,
      writeTime,
      readTime,
      totalTime: Date.now() - startTime,
      cacheHits: hits,
      hitRate: `${Math.round((hits / testSize) * 100)}%`,
      averageWriteTime: Math.round(writeTime / testSize),
      averageReadTime: Math.round(readTime / testSize)
    };

  } catch (error) {
    throw new Error(`Cache test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function performBatchTest(service: any, operationCount: number, operationType: string): Promise<any> {
  const startTime = Date.now();

  try {
    const operations = [];

    // 生成測試操作
    for (let i = 0; i < operationCount; i++) {
      if (operationType === 'mixed') {
        const type = i % 3 === 0 ? 'set' : (i % 3 === 1 ? 'get' : 'delete');
        operations.push({
          type,
          key: `batch_test_${i}`,
          value: type === 'set' ? `Test value ${i}` : undefined
        });
      } else {
        operations.push({
          type: operationType,
          key: `batch_test_${i}`,
          value: operationType === 'set' ? `Test value ${i}` : undefined
        });
      }
    }

    // 執行批量操作
    const results = await service.batchOperation(operations);
    const totalTime = Date.now() - startTime;

    return {
      operationCount,
      operationType,
      totalTime,
      averageTimePerOperation: Math.round(totalTime / operationCount),
      successCount: results.filter((r: unknown) => r !== null).length,
      successRate: `${Math.round((results.filter((r: unknown) => r !== null).length / operationCount) * 100)}%`
    };

  } catch (error) {
    throw new Error(`Batch test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default dataOptimizationHandler;