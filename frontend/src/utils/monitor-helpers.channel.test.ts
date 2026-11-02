import { describe, expect, it } from 'vitest'
import { translateChannelDetail, translateInfraName, translateChannelName } from './monitor-helpers'

describe('translateChannelDetail', () => {
  it('translates the strings the status endpoint returns', () => {
    expect(translateChannelDetail('LINE Bot connected: Daiwan', 'connected')).toBe('LINE Bot 已連線：Daiwan')
    expect(translateChannelDetail('Facebook API error: 190', 'error')).toBe('Facebook API 回應錯誤（HTTP 190）')
    expect(translateChannelDetail('LINE API error: 401 (Invalid or expired access token)', 'error')).toContain('存取權杖無效或已過期')
    expect(translateChannelDetail('Some webhook channels unavailable', 'connected')).toBe('部分頻道的 Webhook 無法使用')
  })

  it('falls back to the status for unknown English text, never inventing a state', () => {
    expect(translateChannelDetail('Something odd', 'error')).toBe('檢查失敗')
    expect(translateChannelDetail('Something odd', 'disconnected')).toBe('尚未連線')
    expect(translateChannelDetail('Something odd', 'connected')).toBe('連線正常')
  })

  it('keeps text that is already Chinese', () => {
    expect(translateChannelDetail('已連線', 'connected')).toBe('已連線')
  })
})

describe('name translation', () => {
  it('maps known ids and keeps unknown names', () => {
    expect(translateInfraName('d1', 'D1 Database')).toBe('D1 資料庫')
    expect(translateInfraName('x', 'Other')).toBe('Other')
    expect(translateChannelName('webhook-delivery', 'Webhook Delivery')).toBe('Webhook 傳遞')
  })
})
