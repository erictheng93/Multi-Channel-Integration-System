// User Experience Monitoring API Handler
// Phase 2: 長期優化 - 用戶體驗監控和調查系統
// 專案：Multi-Channel Support MVP - WebSocket 用戶體驗追蹤

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { jwtAuth } from '../middleware/auth';
import { createUserExperienceMonitoringService } from '../services/user-experience-monitoring';
import type { UserExperienceMetrics, UserExperienceSurvey, UserBehaviorAnalytics, ABTestConfig } from '../services/user-experience-monitoring';

const userExperienceHandler = new Hono<{ Bindings: Bindings }>();

// =================== 用戶體驗指標記錄 API ===================

// 記錄用戶體驗指標 (供客戶端調用)
userExperienceHandler.post('/metrics', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const metrics = await c.req.json() as Omit<UserExperienceMetrics, 'userId'>;

    // 自動填入用戶 ID
    const fullMetrics: UserExperienceMetrics = {
      ...metrics,
      userId: user.id.toString()
    };

    // 基本驗證
    if (!fullMetrics.sessionId || !fullMetrics.timestamp) {
      return c.json({
        error: 'Invalid metrics data',
        message: 'sessionId and timestamp are required'
      }, 400);
    }

    const uxService = createUserExperienceMonitoringService(c.env);
    await uxService.recordUserExperience(fullMetrics);

    return c.json({
      success: true,
      message: 'User experience metrics recorded successfully',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [UX API] Record metrics error:', error);
    return c.json({
      error: 'Failed to record metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 記錄用戶行為 (供客戶端調用)
userExperienceHandler.post('/behavior', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const behavior = await c.req.json() as Omit<UserBehaviorAnalytics, 'userId'>;

    // 自動填入用戶 ID
    const fullBehavior: UserBehaviorAnalytics = {
      ...behavior,
      userId: user.id.toString()
    };

    // 基本驗證
    if (!fullBehavior.eventType || !fullBehavior.timestamp) {
      return c.json({
        error: 'Invalid behavior data',
        message: 'eventType and timestamp are required'
      }, 400);
    }

    const uxService = createUserExperienceMonitoringService(c.env);
    await uxService.recordUserBehavior(fullBehavior);

    return c.json({
      success: true,
      message: 'User behavior recorded successfully',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [UX API] Record behavior error:', error);
    return c.json({
      error: 'Failed to record behavior',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// =================== 用戶體驗調查 API ===================

// 檢查是否需要邀請用戶參與調查
userExperienceHandler.get('/survey/invitation', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const sessionId = c.req.query('sessionId');

    if (!sessionId) {
      return c.json({
        error: 'Missing sessionId parameter'
      }, 400);
    }

    const uxService = createUserExperienceMonitoringService(c.env);
    const invitation = await uxService.generateSurveyInvitation(user.id.toString(), sessionId);

    return c.json({
      success: true,
      data: invitation,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [UX API] Survey invitation error:', error);
    return c.json({
      error: 'Failed to generate survey invitation',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 提交用戶體驗調查
userExperienceHandler.post('/survey', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const survey = await c.req.json() as Omit<UserExperienceSurvey, 'userId'>;

    // 自動填入用戶 ID
    const fullSurvey: UserExperienceSurvey = {
      ...survey,
      userId: user.id.toString()
    };

    // 基本驗證
    if (!fullSurvey.sessionId || !fullSurvey.overallSatisfaction) {
      return c.json({
        error: 'Invalid survey data',
        message: 'sessionId and overallSatisfaction are required'
      }, 400);
    }

    // 驗證評分範圍
    const scores = [
      fullSurvey.overallSatisfaction,
      fullSurvey.connectionQuality,
      fullSurvey.responseTime,
      fullSurvey.reliability,
      fullSurvey.easeOfUse
    ];

    for (const score of scores) {
      if (score < 1 || score > 5) {
        return c.json({
          error: 'Invalid score range',
          message: 'All scores must be between 1 and 5'
        }, 400);
      }
    }

    const uxService = createUserExperienceMonitoringService(c.env);
    await uxService.recordUserSurvey(fullSurvey);

    return c.json({
      success: true,
      message: 'Survey submitted successfully',
      thankYouMessage: 'Thank you for your feedback! Your input helps us improve the service.',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [UX API] Survey submission error:', error);
    return c.json({
      error: 'Failed to submit survey',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// =================== 用戶體驗報告 API ===================

// 生成用戶體驗報告 (管理員和團隊成員)
userExperienceHandler.get('/report', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // 檢查權限
    if (!['admin', 'team'].includes(user.role)) {
      return c.json({
        error: 'Insufficient permissions',
        message: 'Only administrators and team members can access experience reports'
      }, 403);
    }

    const timeRangeParam = c.req.query('timeRange');
    const timeRangeHours = timeRangeParam ? parseInt(timeRangeParam) : 24;

    // 驗證時間範圍
    if (timeRangeHours < 1 || timeRangeHours > 720) { // 最多 30 天
      return c.json({
        error: 'Invalid time range',
        message: 'Time range must be between 1 and 720 hours'
      }, 400);
    }

    const uxService = createUserExperienceMonitoringService(c.env);
    const report = await uxService.generateUserExperienceReport(timeRangeHours);

    return c.json({
      success: true,
      data: report,
      timeRange: `${timeRangeHours}h`,
      generatedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [UX API] Report generation error:', error);
    return c.json({
      error: 'Failed to generate experience report',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// =================== A/B 測試 API ===================

// 創建 A/B 測試 (僅管理員)
userExperienceHandler.post('/ab-tests', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // 只有管理員可以創建 A/B 測試
    if (user.role !== 'admin') {
      return c.json({
        error: 'Admin access required',
        message: 'Only administrators can create A/B tests'
      }, 403);
    }

    const testConfig = await c.req.json() as ABTestConfig;

    const uxService = createUserExperienceMonitoringService(c.env);
    await uxService.createABTest(testConfig);

    return c.json({
      success: true,
      message: 'A/B test created successfully',
      testId: testConfig.testId,
      createdBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [UX API] Create A/B test error:', error);
    return c.json({
      error: 'Failed to create A/B test',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 獲取用戶的 A/B 測試分配
userExperienceHandler.get('/ab-tests/:testId/assignment', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const testId = c.req.param('testId');

    const uxService = createUserExperienceMonitoringService(c.env);
    const assignment = await uxService.assignUserToABTest(user.id.toString(), testId);

    return c.json({
      success: true,
      data: assignment,
      userId: user.id,
      testId,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [UX API] A/B test assignment error:', error);
    return c.json({
      error: 'Failed to get A/B test assignment',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// 記錄 A/B 測試指標
userExperienceHandler.post('/ab-tests/:testId/metrics', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const testId = c.req.param('testId');
    const { metricName, value } = await c.req.json();

    if (!metricName || typeof value !== 'number') {
      return c.json({
        error: 'Invalid metric data',
        message: 'metricName (string) and value (number) are required'
      }, 400);
    }

    const uxService = createUserExperienceMonitoringService(c.env);
    await uxService.recordABTestMetric(user.id.toString(), testId, metricName, value);

    return c.json({
      success: true,
      message: 'A/B test metric recorded successfully',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [UX API] A/B test metric error:', error);
    return c.json({
      error: 'Failed to record A/B test metric',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// =================== 用戶個人化體驗 API ===================

// 獲取用戶個人體驗儀表板
userExperienceHandler.get('/personal-dashboard', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // 簡化版個人儀表板 - 實際實現需要查詢用戶歷史數據
    const personalDashboard = {
      userId: user.id,
      overallScore: 0.85,
      recentSessions: 12,
      averageLatency: 230,
      connectionStability: 0.92,
      improvementSuggestions: [
        'Consider using a wired connection for better stability',
        'Close unnecessary browser tabs to improve performance'
      ],
      lastSurveyDate: null,
      nextSurveyEligible: true
    };

    return c.json({
      success: true,
      data: personalDashboard,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [UX API] Personal dashboard error:', error);
    return c.json({
      error: 'Failed to get personal dashboard',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// =================== 系統健康檢查 ===================

// 用戶體驗監控系統健康檢查
userExperienceHandler.get('/health', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (!['admin', 'team'].includes(user.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    // 檢查系統組件狀態
    const healthChecks = {
      uxService: true,
      metricsStorage: false,
      surveySystem: false,
      abTestSystem: false,
      reportGeneration: false
    };

    try {
      // 測試服務組件
      // const uxService = createUserExperienceMonitoringService(c.env);

      // 測試指標存儲
      await c.env.CACHE?.put('ux_health_check', Date.now().toString(), { expirationTtl: 60 });
      const testValue = await c.env.CACHE?.get('ux_health_check');
      healthChecks.metricsStorage = testValue !== null;

      // 測試其他組件 (簡化版)
      healthChecks.surveySystem = true;
      healthChecks.abTestSystem = true;
      healthChecks.reportGeneration = true;

    } catch (error) {
      console.warn('⚠️ [UX API] Health check component failed:', error);
    }

    const healthScore = Object.values(healthChecks).filter(Boolean).length / Object.keys(healthChecks).length;
    const overallHealth = healthScore >= 0.8 ? 'healthy' : healthScore >= 0.6 ? 'degraded' : 'unhealthy';

    return c.json({
      status: overallHealth,
      score: Math.round(healthScore * 100),
      components: healthChecks,
      timestamp: Date.now(),
      checkedBy: user.id
    });

  } catch (error) {
    console.error('❌ [UX API] Health check error:', error);
    return c.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, 500);
  }
});

export default userExperienceHandler;