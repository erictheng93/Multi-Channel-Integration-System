/**
 * Shared utilities for the API monitoring dashboard.
 */

/**
 * Format a timestamp as relative time in Traditional Chinese (e.g. "5 秒前", "3 分鐘前", "2 小時前").
 */
export function formatRelativeTime(timestamp: string | number | Date): string {
  const now = Date.now()
  const then = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime()
  const diffSec = Math.max(0, Math.round((now - then) / 1000))

  if (diffSec < 60) {return `${diffSec} 秒前`}
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) {return `${diffMin} 分鐘前`}
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) {return `${diffHr} 小時前`}
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay} 天前`
}

/**
 * The status endpoint returns English detail strings for channels. Known strings are
 * translated; anything else falls back to a plain statement of the status (the original
 * text stays available as a tooltip), so no state is ever invented.
 */
export function translateChannelDetail(details: string, status: 'connected' | 'disconnected' | 'error'): string {
  const text = details.trim()
  let m: RegExpMatchArray | null
  if (text === 'LINE Access Token not configured') { return 'LINE 尚未設定 Access Token' }
  if (text === 'Facebook Page Token not configured') { return 'Facebook 尚未設定粉絲專頁權杖' }
  if (text === 'LINE check failed') { return 'LINE 檢查失敗' }
  if (text === 'Facebook check failed') { return 'Facebook 檢查失敗' }
  if (text === 'Channel check failed') { return '頻道檢查失敗' }
  if (text === 'All webhook channels operational') { return 'LINE 與 Facebook 的 Webhook 皆可使用' }
  if (text === 'Some webhook channels unavailable') { return '部分頻道的 Webhook 無法使用' }
  if ((m = text.match(/^LINE Bot connected: (.+)$/))) { return `LINE Bot 已連線：${m[1]}` }
  if ((m = text.match(/^Facebook Page connected: (.+)$/))) { return `Facebook 粉絲專頁已連線：${m[1]}` }
  if ((m = text.match(/^Facebook API error: (\d+)$/))) { return `Facebook API 回應錯誤（HTTP ${m[1]}）` }
  if ((m = text.match(/^LINE API error: (\d+)(?: \((.+)\))?$/))) {
    const reason = m[2] === 'Invalid or expired access token'
      ? '，存取權杖無效或已過期'
      : m[2] === 'Insufficient permissions' ? '，權限不足' : ''
    return `LINE API 回應錯誤（HTTP ${m[1]}${reason}）`
  }
  if (/[\u4e00-\u9fff]/.test(text)) { return text }
  return status === 'connected' ? '連線正常' : status === 'error' ? '檢查失敗' : '尚未連線'
}

const INFRA_NAMES: Record<string, string> = {
  d1: 'D1 資料庫',
  kv: 'KV 快取',
  r2: 'R2 儲存',
}

export function translateInfraName(id: string, name: string): string {
  return INFRA_NAMES[id] ?? name
}

const CHANNEL_NAMES: Record<string, string> = {
  'webhook-delivery': 'Webhook 傳遞',
}

export function translateChannelName(id: string, name: string): string {
  return CHANNEL_NAMES[id] ?? name
}
