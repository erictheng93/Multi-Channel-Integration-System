/**
 * QR Code 資料同步腳本
 * 用途：將現有的 qr_codes 資料同步到 teams.qrCode 欄位
 *
 * 功能：
 * 1. 掃描所有團隊
 * 2. 為每個團隊找到最新的活躍 QR Code
 * 3. 更新 teams.qrCode 欄位
 * 4. 產生詳細的同步報告
 *
 * 執行方式：
 * npx tsx scripts/sync-qr-codes.ts
 *
 * 安全性：
 * - 只讀取和更新，不刪除資料
 * - 支援 dry-run 模式預覽變更
 * - 詳細的錯誤處理和日誌記錄
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { teams, qrCodes } from '../src/db/schema';

// 統計資訊介面
interface SyncStats {
  totalTeams: number;
  teamsWithQR: number;
  teamsWithoutQR: number;
  successfulSyncs: number;
  failedSyncs: number;
  alreadySynced: number;
  errors: Array<{ teamId: number; teamName: string; error: string }>;
}

/**
 * 主要同步函數
 */
async function syncQRCodes(dryRun: boolean = false) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 QR Code 資料同步腳本');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`模式: ${dryRun ? '🔍 預覽模式 (Dry Run)' : '✍️  執行模式'}`);
  console.log(`開始時間: ${new Date().toLocaleString('zh-TW')}\n`);

  // 初始化資料庫連接
  // 注意：這裡需要根據您的實際環境配置來調整
  // 以下是示例代碼，實際使用時需要提供正確的 D1 Database 實例

  // Stub: Replace with D1 binding when running in Worker context
  // const db = drizzle(env.DB);

  console.log('❌ 錯誤：此腳本需要在 Cloudflare Workers 環境中執行');
  console.log('📋 使用方式：');
  console.log('   1. 將此腳本整合到 Worker 中作為管理端點');
  console.log('   2. 或使用 wrangler dev 本地開發環境執行');
  console.log('\n建議實作方式：');
  console.log('   在 src/handlers/admin-main.ts 中添加管理端點：');
  console.log('   POST /api/admin/sync-qr-codes');

  return;

  // ========== 以下是同步邏輯 (需要在 Worker 環境中執行) ==========

  /*
  const stats: SyncStats = {
    totalTeams: 0,
    teamsWithQR: 0,
    teamsWithoutQR: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    alreadySynced: 0,
    errors: []
  };

  try {
    // 1. 取得所有團隊
    console.log('📋 正在載入所有團隊...');
    const allTeams = await db.select().from(teams);
    stats.totalTeams = allTeams.length;
    console.log(`✅ 找到 ${stats.totalTeams} 個團隊\n`);

    // 2. 為每個團隊同步 QR Code
    for (const team of allTeams) {
      try {
        console.log(`\n🔍 處理團隊 [${team.id}] ${team.name}...`);

        // 2.1 檢查是否已有 QR Code
        if (team.qrCode && !dryRun) {
          console.log(`   ℹ️  teams.qrCode 已存在: ${team.qrCode.substring(0, 50)}...`);
          stats.alreadySynced++;

          // 驗證該 QR Code 是否仍然有效
          const existingQR = await db
            .select()
            .from(qrCodes)
            .where(
              and(
                eq(qrCodes.teamId, team.id),
                eq(qrCodes.qrCodeImageUrl, team.qrCode),
                eq(qrCodes.isActive, true)
              )
            )
            .limit(1);

          if (existingQR.length > 0) {
            console.log(`   ✅ QR Code 有效，跳過同步`);
            continue;
          } else {
            console.log(`   ⚠️  QR Code 已失效，將重新同步`);
          }
        }

        // 2.2 查詢該團隊最新的活躍 QR Code
        const latestQR = await db
          .select()
          .from(qrCodes)
          .where(
            and(
              eq(qrCodes.teamId, team.id),
              eq(qrCodes.isActive, true)
            )
          )
          .orderBy(desc(qrCodes.createdAt))
          .limit(1);

        if (latestQR.length > 0) {
          const qr = latestQR[0];
          console.log(`   📍 找到 QR Code:`);
          console.log(`      ID: ${qr.id}`);
          console.log(`      URL: ${qr.qrCodeImageUrl?.substring(0, 50)}...`);
          console.log(`      建立時間: ${qr.createdAt}`);

          // 2.3 更新 teams.qrCode
          if (!dryRun) {
            await db
              .update(teams)
              .set({
                qrCode: qr.qrCodeImageUrl,
                updatedAt: new Date().toISOString()
              })
              .where(eq(teams.id, team.id));

            console.log(`   ✅ 已同步到 teams.qrCode`);
            stats.successfulSyncs++;
          } else {
            console.log(`   🔍 [Dry Run] 將會更新 teams.qrCode`);
            stats.successfulSyncs++;
          }

          stats.teamsWithQR++;
        } else {
          console.log(`   📭 未找到活躍的 QR Code`);
          stats.teamsWithoutQR++;
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知錯誤';
        console.error(`   ❌ 處理失敗: ${errorMessage}`);
        stats.failedSyncs++;
        stats.errors.push({
          teamId: team.id,
          teamName: team.name,
          error: errorMessage
        });
      }
    }

    // 3. 輸出統計報告
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 同步完成統計報告');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`總團隊數:         ${stats.totalTeams}`);
    console.log(`有 QR Code:       ${stats.teamsWithQR}`);
    console.log(`無 QR Code:       ${stats.teamsWithoutQR}`);
    console.log(`成功同步:         ${stats.successfulSyncs}`);
    console.log(`已存在跳過:       ${stats.alreadySynced}`);
    console.log(`失敗:             ${stats.failedSyncs}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ 錯誤詳情:');
      stats.errors.forEach((err, index) => {
        console.log(`   ${index + 1}. [${err.teamId}] ${err.teamName}: ${err.error}`);
      });
    }

    console.log(`\n完成時間: ${new Date().toLocaleString('zh-TW')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 4. 返回統計資訊
    return stats;

  } catch (error) {
    console.error('\n❌ 同步過程發生嚴重錯誤:', error);
    throw error;
  }
  */
}

/**
 * 驗證同步結果
 */
async function validateSync() {
  console.log('\n🔍 驗證同步結果...\n');

  // Stub: Add QR code validation (URL format + team existence check)
  console.log('驗證邏輯需要在 Worker 環境中實作');
}

// 執行腳本
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');

  syncQRCodes(dryRun)
    .then(() => {
      if (!dryRun) {
        return validateSync();
      }
    })
    .catch((error) => {
      console.error('腳本執行失敗:', error);
      process.exit(1);
    });
}

export { syncQRCodes };
