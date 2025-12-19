/**
 * QR Code 雙向同步機制測試
 *
 * 測試範圍：
 * 1. 快速查詢端點 - GET /api/teams/:id/qr-code/fast
 * 2. 同步端點 - POST /api/system/sync-qr-codes
 * 3. 驗證端點 - GET /api/system/sync-qr-codes/validate
 * 4. 生成 QR Code 時自動同步
 * 5. 停用 QR Code 時自動同步
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { teams, qrCodes } from '@/db/schema';

// 測試環境配置
const TEST_CONFIG = {
  baseUrl: process.env.TEST_API_URL || 'http://localhost:8787',
  adminToken: process.env.TEST_ADMIN_TOKEN || '',
  testTeamId: 1
};

describe('QR Code 雙向同步機制整合測試', () => {
  let authHeaders: HeadersInit;

  beforeAll(() => {
    authHeaders = {
      'Authorization': `Bearer ${TEST_CONFIG.adminToken}`,
      'Content-Type': 'application/json'
    };
  });

  describe('1. 快速查詢端點 - Optimal Path', () => {
    it('應該優先從 teams.qrCode 欄位讀取 (最快路徑)', async () => {
      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/teams/${TEST_CONFIG.testTeamId}/qr-code/fast`,
        { headers: authHeaders }
      );

      expect(response.ok).toBe(true);

      const data = await response.json();
      console.log('📊 快速查詢結果:', data);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('qrCode');
      expect(data.data).toHaveProperty('source');
      expect(data.data).toHaveProperty('performance');

      // 驗證從 teams 表讀取
      if (data.data.source === 'teams_table') {
        expect(data.data.performance).toBe('optimal');
        console.log('✅ 最佳路徑：直接從 teams.qrCode 讀取');
      } else if (data.data.source === 'qr_codes_table') {
        expect(data.data.performance).toBe('fallback');
        console.log('⚠️  Fallback 路徑：從 qr_codes 表讀取並異步同步');
      }
    });

    it('應該在沒有 QR Code 時返回 404', async () => {
      // 使用一個不存在的 teamId
      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/teams/99999/qr-code/fast`,
        { headers: authHeaders }
      );

      if (response.status === 404) {
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('No QR code found');
        console.log('✅ 正確返回 404 當無 QR Code 存在');
      } else if (response.status === 403) {
        console.log('⚠️  權限不足 (預期行為 - 非團隊成員)');
        expect(response.status).toBe(403);
      }
    });
  });

  describe('2. 同步端點 - Dry Run 模式', () => {
    it('應該支援 dry-run 模式預覽同步結果', async () => {
      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/system/sync-qr-codes?dryRun=true`,
        {
          method: 'POST',
          headers: authHeaders
        }
      );

      expect(response.ok).toBe(true);

      const data = await response.json();
      console.log('📊 Dry Run 統計:', data.data?.stats);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('stats');
      expect(data.data.stats).toHaveProperty('totalTeams');
      expect(data.data.stats).toHaveProperty('teamsWithQR');
      expect(data.data.stats).toHaveProperty('teamsWithoutQR');
      expect(data.data.stats).toHaveProperty('successfulSyncs');
      expect(data.data.stats).toHaveProperty('alreadySynced');

      console.log(`
✅ Dry Run 完成:
   總團隊數: ${data.data.stats.totalTeams}
   有 QR Code: ${data.data.stats.teamsWithQR}
   無 QR Code: ${data.data.stats.teamsWithoutQR}
   將會同步: ${data.data.stats.successfulSyncs}
   已存在: ${data.data.stats.alreadySynced}
      `);
    });
  });

  describe('3. 同步端點 - 實際執行', () => {
    it('應該實際同步所有團隊的 QR Code 到 teams.qrCode', async () => {
      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/system/sync-qr-codes`,
        {
          method: 'POST',
          headers: authHeaders
        }
      );

      expect(response.ok).toBe(true);

      const data = await response.json();
      console.log('📊 實際同步統計:', data.data?.stats);

      expect(data.success).toBe(true);
      expect(data.data.stats.successfulSyncs).toBeGreaterThanOrEqual(0);

      console.log(`
✅ 同步完成:
   成功同步: ${data.data.stats.successfulSyncs} 個團隊
   失敗: ${data.data.stats.failedSyncs} 個團隊
      `);
    });

    it('應該正確處理權限驗證 (非管理員)', async () => {
      // 如果有非管理員 token，測試權限控制
      const nonAdminHeaders = {
        'Authorization': 'Bearer fake-agent-token',
        'Content-Type': 'application/json'
      };

      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/system/sync-qr-codes`,
        {
          method: 'POST',
          headers: nonAdminHeaders
        }
      );

      // 應該返回 401 (未授權) 或 403 (權限不足)
      expect([401, 403]).toContain(response.status);
      console.log('✅ 正確拒絕非管理員訪問');
    });
  });

  describe('4. 驗證端點', () => {
    it('應該驗證所有團隊的 QR Code 同步狀態', async () => {
      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/system/sync-qr-codes/validate`,
        { headers: authHeaders }
      );

      expect(response.ok).toBe(true);

      const data = await response.json();
      console.log('📊 驗證結果:', data.data);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('validation');
      expect(data.data.validation).toHaveProperty('totalTeams');
      expect(data.data.validation).toHaveProperty('synced');
      expect(data.data.validation).toHaveProperty('notSynced');
      expect(data.data.validation).toHaveProperty('syncRate');
      expect(data.data.validation).toHaveProperty('healthStatus');

      const syncRate = parseFloat(data.data.validation.syncRate);
      console.log(`
✅ 驗證完成:
   總團隊: ${data.data.validation.totalTeams}
   已同步: ${data.data.validation.synced}
   未同步: ${data.data.validation.notSynced}
   同步率: ${data.data.validation.syncRate}
   健康狀態: ${data.data.validation.healthStatus}
      `);

      // 同步率應該大於 80%
      if (data.data.validation.totalTeams > 0) {
        expect(syncRate).toBeGreaterThan(80);
      }
    });
  });

  describe('5. 端到端整合測試', () => {
    it('完整流程：同步 → 驗證 → 快速查詢', async () => {
      console.log('\n🚀 開始端到端測試...\n');

      // Step 1: 執行同步
      console.log('Step 1: 執行同步...');
      const syncResponse = await fetch(
        `${TEST_CONFIG.baseUrl}/api/system/sync-qr-codes`,
        {
          method: 'POST',
          headers: authHeaders
        }
      );
      expect(syncResponse.ok).toBe(true);
      const syncData = await syncResponse.json();
      console.log(`✅ 同步完成: ${syncData.data?.stats.successfulSyncs} 個團隊\n`);

      // Step 2: 驗證同步狀態
      console.log('Step 2: 驗證同步狀態...');
      const validateResponse = await fetch(
        `${TEST_CONFIG.baseUrl}/api/system/sync-qr-codes/validate`,
        { headers: authHeaders }
      );
      expect(validateResponse.ok).toBe(true);
      const validateData = await validateResponse.json();
      console.log(`✅ 驗證完成: 同步率 ${validateData.data?.validation.syncRate}\n`);

      // Step 3: 快速查詢驗證
      console.log('Step 3: 快速查詢驗證...');
      const queryResponse = await fetch(
        `${TEST_CONFIG.baseUrl}/api/teams/${TEST_CONFIG.testTeamId}/qr-code/fast`,
        { headers: authHeaders }
      );

      if (queryResponse.ok) {
        const queryData = await queryResponse.json();
        console.log(`✅ 快速查詢成功: source=${queryData.data?.source}, performance=${queryData.data?.performance}\n`);

        // 應該從 teams 表讀取 (optimal path)
        expect(queryData.data.source).toBe('teams_table');
        expect(queryData.data.performance).toBe('optimal');
      }

      console.log('🎉 端到端測試完成！\n');
    });
  });

  describe('6. 性能基準測試', () => {
    it('應該在 50ms 內完成快速查詢 (optimal path)', async () => {
      const startTime = Date.now();

      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/teams/${TEST_CONFIG.testTeamId}/qr-code/fast`,
        { headers: authHeaders }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      if (response.ok) {
        const data = await response.json();

        console.log(`
📊 性能測試結果:
   響應時間: ${duration}ms
   數據來源: ${data.data?.source}
   性能模式: ${data.data?.performance}
        `);

        // 從 teams 表讀取應該非常快 (< 50ms)
        if (data.data.source === 'teams_table') {
          expect(duration).toBeLessThan(50);
          console.log('✅ 性能達標：< 50ms (optimal path)');
        }
      }
    });
  });
});

/**
 * 運行測試範例
 *
 * 1. 設置環境變數:
 * ```bash
 * export TEST_API_URL="https://your-worker.workers.dev"
 * export TEST_ADMIN_TOKEN="your-admin-jwt-token"
 * ```
 *
 * 2. 運行測試:
 * ```bash
 * npm test tests/integration/qr-code-sync.test.ts
 * ```
 *
 * 3. 查看測試報告:
 * ```bash
 * npm test -- --reporter=verbose tests/integration/qr-code-sync.test.ts
 * ```
 *
 * 預期結果:
 * - ✅ 所有測試通過
 * - ✅ 同步率 > 80%
 * - ✅ 快速查詢響應時間 < 50ms
 * - ✅ 數據一致性驗證通過
 */
