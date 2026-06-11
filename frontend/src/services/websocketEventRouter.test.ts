import { describe, expect, test } from 'vitest'
import { WebSocketEventRouter } from './websocketEventRouter'

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
