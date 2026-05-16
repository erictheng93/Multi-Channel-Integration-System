// Integration testing handlers
// testIntegration + private LINE/Facebook integration test helpers

import { Context } from 'hono'
import type { Bindings } from '@/types'
import {
  isLineWebhookInfo,
  isLineBotInfo,
  isFacebookPageInfo,
} from '@/types'
import {
  successResponse,
  handleApiError
} from '@/utils/api-response'
import { getCredentialsFromKV } from './system-crypto-utils'
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('SystemIntegrations')

interface LineIntegrationTestConfig {
  channelId?: string;
  channelSecret?: string;
  accessToken?: string;
}

interface FacebookIntegrationTestConfig {
  appId?: string;
  appSecret?: string;
  pageId?: string;
  pageToken?: string;
  testUserId?: string;
}

type IntegrationTestConfig = LineIntegrationTestConfig & FacebookIntegrationTestConfig;

// Test platform integration
export const testIntegration = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const platform = c.req.param('platform')
    const config = await c.req.json() as IntegrationTestConfig

    let testResult = { status: 'error', message: '測試失敗' }

    if (platform === 'line') {
      testResult = await testLineIntegration(config, c.env)
    } else if (platform === 'facebook') {
      testResult = await testFacebookIntegration(config, c.env)
    } else {
      testResult = { status: 'error', message: '不支援的平台' }
    }

    return successResponse(c, testResult, 'Integration test completed')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// Test LINE integration
async function testLineIntegration(config: LineIntegrationTestConfig, env: Bindings) {
  try {
    // If no config provided, try to get from KV
    let testConfig: LineIntegrationTestConfig = config
    if (!config.channelId || !config.channelSecret || !config.accessToken) {
      const kvCredentials = await getCredentialsFromKV(env, 'line')
      if (kvCredentials) {
        testConfig = {
          channelId: config.channelId || kvCredentials.channelId,
          channelSecret: config.channelSecret || kvCredentials.channelSecret,
          accessToken: config.accessToken || kvCredentials.accessToken
        }
      }
    }

    if (!testConfig.channelId || !testConfig.channelSecret || !testConfig.accessToken) {
      return { status: 'error', message: '請填寫完整的 LINE 設定' }
    }

    // Test 1: Get Bot info to validate Token
    log.info('Testing LINE Access Token by getting bot info', { tokenLength: testConfig.accessToken?.length })
    const botInfoResponse = await fetch('https://api.line.me/v2/bot/info', {
      headers: {
        'Authorization': `Bearer ${testConfig.accessToken}`
      }
    })

    log.info('Bot info response', { status: botInfoResponse.status, statusText: botInfoResponse.statusText })

    if (!botInfoResponse.ok) {
      const errorText = await botInfoResponse.text().catch(() => 'Unable to read error response')
      log.error('Bot info failed', { errorText, status: botInfoResponse.status })

      let errorMessage = 'LINE Access Token 無效或已過期'
      if (botInfoResponse.status === 401) {
        errorMessage = 'LINE Access Token 無效或已過期'
      } else if (botInfoResponse.status === 403) {
        errorMessage = 'LINE Access Token 權限不足'
      } else if (botInfoResponse.status === 429) {
        errorMessage = 'LINE API 請求頻率過高，請稍後再試'
      } else if (botInfoResponse.status >= 500) {
        errorMessage = 'LINE API 服務暫時不可用'
      }

      return {
        status: 'error',
        message: errorMessage,
        details: `HTTP ${botInfoResponse.status}: ${errorText}`
      }
    }

    const botInfo = await botInfoResponse.json().catch((e: Error): null => {
      log.error('Failed to parse bot info JSON', {}, e)
      return null
    })

    if (!botInfo) {
      return {
        status: 'error',
        message: 'LINE API 回應格式錯誤',
        details: 'Unable to parse bot information response'
      }
    }

    // Test 2: Check Webhook settings (optional)
    let webhookStatus = 'not_tested'
    try {
      log.info('Testing LINE Webhook endpoint')
      const webhookResponse = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
        headers: {
          'Authorization': `Bearer ${testConfig.accessToken}`
        }
      })

      if (webhookResponse.ok) {
        const webhookInfo = await webhookResponse.json()
        log.info('Webhook info retrieved successfully')
        if (isLineWebhookInfo(webhookInfo)) {
          webhookStatus = webhookInfo.active ? 'active' : 'inactive'
        }
      } else {
        log.warn('Webhook check failed', { status: webhookResponse.status })
      }
    } catch (webhookError) {
      log.warn('Webhook test failed', { error: webhookError instanceof Error ? webhookError.message : String(webhookError) })
    }

    log.info('LINE integration test completed successfully')
    return {
      status: 'success',
      message: 'LINE 連線測試成功',
      details: {
        botName: isLineBotInfo(botInfo) ? botInfo.displayName : 'Unknown',
        botId: isLineBotInfo(botInfo) ? botInfo.userId : 'Unknown',
        channelId: testConfig.channelId,
        webhookStatus,
        testTime: nowISO()
      }
    }
  } catch (error) {
    log.error('LINE integration test error', {}, error instanceof Error ? error : String(error))
    return {
      status: 'error',
      message: 'LINE 測試過程中發生錯誤',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Test Facebook integration
async function testFacebookIntegration(config: FacebookIntegrationTestConfig, env: Bindings) {
  try {
    // If no config provided, try to get from KV
    let testConfig: FacebookIntegrationTestConfig = config
    if (!config.appId || !config.appSecret || !config.pageId || !config.pageToken) {
      const kvCredentials = await getCredentialsFromKV(env, 'facebook')
      if (kvCredentials) {
        testConfig = {
          appId: config.appId || kvCredentials.appId,
          appSecret: config.appSecret || kvCredentials.appSecret,
          pageId: config.pageId || kvCredentials.pageId,
          pageToken: config.pageToken || kvCredentials.pageToken
        }
      }
    }

    if (!testConfig.appId || !testConfig.appSecret || !testConfig.pageId || !testConfig.pageToken) {
      return { status: 'error', message: '請填寫完整的 Facebook 設定' }
    }

    // Test 1: Validate Page Access Token
    log.info('Testing Facebook Page Access Token')
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${testConfig.pageToken}`
    )

    if (!tokenResponse.ok) {
      return {
        status: 'error',
        message: 'Facebook Page Access Token 無效',
        details: `Token validation failed: ${tokenResponse.status}`
      }
    }

    const pageInfo = await tokenResponse.json()

    // Test 2: Validate App Secret by checking the Page token against the app.
    log.info('Testing Facebook App Secret')
    const debugParams = new URLSearchParams({
      input_token: testConfig.pageToken,
      access_token: `${testConfig.appId}|${testConfig.appSecret}`
    })
    const debugTokenResponse = await fetch(`https://graph.facebook.com/v18.0/debug_token?${debugParams.toString()}`)

    if (!debugTokenResponse.ok) {
      return {
        status: 'error',
        message: 'Facebook App Secret 或 Page Access Token 無效',
        details: `Token debug failed: ${debugTokenResponse.status}`
      }
    }

    const debugToken = await debugTokenResponse.json() as {
      data?: {
        app_id?: string;
        is_valid?: boolean;
      };
    }

    if (!debugToken.data || debugToken.data.is_valid === false || (debugToken.data.app_id && debugToken.data.app_id !== testConfig.appId)) {
      return {
        status: 'error',
        message: 'Facebook App Secret 與 Page Access Token 不匹配',
        details: `Expected app ${testConfig.appId}, got ${debugToken.data?.app_id || 'unknown'}`
      }
    }

    // Test 3: Check page permissions
    log.info('Testing Facebook Page Permissions')
    const permissionsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${testConfig.pageId}?fields=access_token,name,category&access_token=${testConfig.pageToken}`
    )

    let pageDetails: Partial<{ category: string }> = {}
    if (permissionsResponse.ok) {
      pageDetails = await permissionsResponse.json() as Partial<{ category: string }>
    }

    // Test 4: Test messaging capability (to test user, if provided)
    let messagingStatus = 'not_tested'
    if (testConfig.testUserId) {
      try {
        const { FacebookAdapter } = await import('@/integrations/platform-adapter')
        const facebookAdapter = new FacebookAdapter(testConfig.appSecret, testConfig.pageToken)

        const testMessage = await facebookAdapter.sendTextMessage(
          testConfig.testUserId,
          ' Facebook Messenger 整合測試成功！'
        )
        messagingStatus = testMessage ? 'success' : 'failed'
      } catch (messageError) {
        log.warn('Test message failed', { error: messageError instanceof Error ? messageError.message : String(messageError) })
        messagingStatus = 'failed'
      }
    }

    return {
      status: 'success',
      message: 'Facebook 連線測試成功',
      details: {
        pageId: isFacebookPageInfo(pageInfo) ? pageInfo.id : 'Unknown',
        pageName: isFacebookPageInfo(pageInfo) ? pageInfo.name : 'Unknown',
        pageCategory: pageDetails.category,
        messagingStatus,
        appId: testConfig.appId
      }
    }
  } catch (error) {
    log.error('Facebook integration test error', {}, error instanceof Error ? error : String(error))
    return {
      status: 'error',
      message: 'Facebook 測試過程中發生錯誤',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
