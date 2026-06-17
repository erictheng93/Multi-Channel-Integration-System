// Data Backup API (admin-only)
// 資料備份 API — 手動備份、列表、下載（R2 mcis-backups）

import { authenticatedFetch } from './authenticatedFetch'
import type { ApiResponse } from '@/types'

export interface BackupItem {
  key: string
  size: number
  uploaded: string
  tier: string
}

export interface BackupList {
  items: BackupItem[]
  lastAuto: BackupItem | null
  count: number
}

async function apiBase(): Promise<string> {
  return import.meta.env.DEV ? '/api' : `${(await import('@/config/runtime')).getBackendUrl()}/api`
}

/** 取得備份列表 + 最近一次自動備份 */
export async function listBackups(): Promise<ApiResponse<BackupList>> {
  try {
    const res = await authenticatedFetch(`${await apiBase()}/data/backup`)
    if (!res.ok) {
      return { success: false, error: res.status === 403 ? '權限不足' : '無法載入備份列表' }
    }
    const json = await res.json()
    if (!json.success || !json.data) {
      return { success: false, error: json.error || '無法載入備份列表' }
    }
    return { success: true, data: json.data as BackupList }
  } catch {
    return { success: false, error: '載入備份列表失敗，請檢查網路連線' }
  }
}

/** 立即建立一次手動備份（上傳到 R2 manual/） */
export async function runBackup(): Promise<ApiResponse<{ key: string; size: number }>> {
  try {
    const res = await authenticatedFetch(`${await apiBase()}/data/backup/run`, { method: 'POST' })
    if (!res.ok) {
      return { success: false, error: res.status === 403 ? '權限不足' : '備份失敗' }
    }
    const json = await res.json()
    if (!json.success || !json.data) {
      return { success: false, error: json.error || '備份失敗' }
    }
    return { success: true, data: json.data as { key: string; size: number } }
  } catch {
    return { success: false, error: '備份請求失敗，請檢查網路連線' }
  }
}

/** 下載指定備份檔（回傳 Blob） */
export async function downloadBackup(key: string): Promise<ApiResponse<Blob>> {
  try {
    const res = await authenticatedFetch(`${await apiBase()}/data/backup/download?key=${encodeURIComponent(key)}`)
    if (!res.ok) {
      return { success: false, error: res.status === 403 ? '權限不足' : '下載失敗' }
    }
    const blob = await res.blob()
    return { success: true, data: blob }
  } catch {
    return { success: false, error: '下載請求失敗，請檢查網路連線' }
  }
}
