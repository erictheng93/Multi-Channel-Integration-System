import { describe, expect, test, it } from 'vitest'
import { WebSocketEventRouter, unwrapEventEnvelope } from './websocketEventRouter'

describe('unwrapEventEnvelope', () => {
  it('解開 event 信封:回傳內層 event 作為頂層 message', () => {
    const frame = {
      type: 'event',
      conversationId: 'conv-1',
      timestamp: 1000,
      data: { id: 'evt-1', type: 'new_message', conversationId: 'conv-1', timestamp: 1000, data: { content: 'hi', senderType: 'customer', senderName: '王小明' } }
    }
    const out = unwrapEventEnvelope(frame as never)
    expect(out.type).toBe('new_message')
    expect(out.conversationId).toBe('conv-1')
    expect((out.data as Record<string, unknown>).senderName).toBe('王小明')
  })

  it('內層缺 conversationId 時用外層信封的 conversationId 兜底', () => {
    const frame = { type: 'event', conversationId: 'conv-outer', data: { type: 'new_message', data: { content: 'x' } } }
    const out = unwrapEventEnvelope(frame as never)
    expect(out.conversationId).toBe('conv-outer')
  })

  it('非 event 信封:原樣返回', () => {
    const msg = { type: 'new_message', conversationId: 'c1', data: { content: 'x' } }
    expect(unwrapEventEnvelope(msg as never)).toBe(msg as never)
  })

  it('type=event 但 data 無 string type:原樣返回(防護)', () => {
    const a = { type: 'event', data: { foo: 'bar' } }
    expect(unwrapEventEnvelope(a as never)).toBe(a as never)
    const b = { type: 'event', data: 'not-an-object' }
    expect(unwrapEventEnvelope(b as never)).toBe(b as never)
    const c = { type: 'event' }
    expect(unwrapEventEnvelope(c as never)).toBe(c as never)
  })

  it('event 信封的 new_message 解包後能路由到 conversations channel', () => {
    const frame = {
      type: 'event',
      conversationId: 'conv-1',
      data: { type: 'new_message', conversationId: 'conv-1', data: { content: 'hi', senderType: 'customer' } }
    }
    expect(WebSocketEventRouter.route(unwrapEventEnvelope(frame as never))).toContain('conversations')
  })
})

describe('WebSocketEventRouter analytics events', () => {
  test('routes analytics widget updates to analytics dashboard channels', () => {
    expect(WebSocketEventRouter.route({
      type: 'analytics_widget_updated',
      data: {
        dashboardId: 'dashboard-1',
        widgetId: 'metric-total-conversations'
      }
    })).toEqual([
      'analytics',
      'analytics:dashboard:dashboard-1',
      'analytics:widget:metric-total-conversations'
    ])
  })

  test('routes analytics dashboard updates to analytics dashboard channel', () => {
    expect(WebSocketEventRouter.route({
      type: 'analytics_dashboard_updated',
      data: {
        dashboardId: 'dashboard-1'
      }
    })).toEqual([
      'analytics',
      'analytics:dashboard:dashboard-1'
    ])
  })
})
