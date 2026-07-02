// Recall Window Configuration Service
// 撤回窗口設定讀取：KV 快取 → D1 system_settings → 預設 0（關閉）
// 任何讀取失敗一律 fallback 0，確保訊息發送永不因設定讀取失敗而被阻塞。

import { eq } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { systemSettings } from '@/db/schema';
import type { Bindings } from '@/types';
import { KV_TTL, KV_KEY_PATTERNS } from '@/config/kv-config';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('RecallWindowConfig');

/** 撤回窗口合法值（秒）；0 = 關閉（立即發送，與既有行為一致） */
export const RECALL_WINDOW_ALLOWED_VALUES = [0, 30, 60, 120, 300] as const;

/** system_settings 中的扁平化 key（沿用 updateSettings 的 dot-notation flatten 規則） */
export const RECALL_WINDOW_SETTING_KEY = 'advanced.recallWindowSeconds';

export function isValidRecallWindow(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    (RECALL_WINDOW_ALLOWED_VALUES as readonly number[]).includes(value)
  );
}

/**
 * 讀取目前的撤回窗口秒數。
 * 讀取順序：KV 快取（TTL 60s）→ D1 → 預設 0。
 */
export async function getRecallWindowSeconds(env: Bindings): Promise<number> {
  // 1. KV 快取
  try {
    const cached = await env.CACHE.get(KV_KEY_PATTERNS.cache.settingsRecallWindow);
    if (cached !== null) {
      const parsed = Number(cached);
      if (isValidRecallWindow(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    log.warn('KV cache read failed, falling back to D1', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 2. D1 system_settings
  try {
    const db = createDbClient(env.DB);
    const row = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, RECALL_WINDOW_SETTING_KEY))
      .get();

    // updateSettings 以 JSON.stringify 儲存非字串值，數字存為 "60" 形式
    const parsed = row ? Number(row.value) : 0;
    const value = isValidRecallWindow(parsed) ? parsed : 0;

    try {
      await env.CACHE.put(
        KV_KEY_PATTERNS.cache.settingsRecallWindow,
        String(value),
        { expirationTtl: KV_TTL.CACHE_SETTINGS }
      );
    } catch {
      // 快取寫入失敗不影響回傳值
    }

    return value;
  } catch (error) {
    log.error('D1 read failed, defaulting recall window to 0', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/** 設定更新後清除 KV 快取，讓新值於下一次發送立即生效 */
export async function invalidateRecallWindowCache(env: Bindings): Promise<void> {
  try {
    await env.CACHE.delete(KV_KEY_PATTERNS.cache.settingsRecallWindow);
  } catch (error) {
    log.warn('Failed to invalidate recall window cache (will expire via TTL)', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
