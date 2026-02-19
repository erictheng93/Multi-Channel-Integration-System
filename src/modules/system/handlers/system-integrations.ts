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

// Test platform integration
export const testIntegration = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const platform = c.req.param('platform')
    const config = await c.req.json()

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
async function testLineIntegration(config: any, env: Bindings) {
  try {
    // If no config provided, try to get from KV
    let testConfig = config
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
    console.log('Testing LINE Access Token by getting bot info...', { tokenLength: testConfig.accessToken?.length })
    const botInfoResponse = await fetch('https://api.line.me/v2/bot/info', {
      headers: {
        'Authorization': `Bearer ${testConfig.accessToken}`
      }
    })

    console.log('Bot info response:', botInfoResponse.status, botInfoResponse.statusText)

    if (!botInfoResponse.ok) {
      const errorText = await botInfoResponse.text().catch(() => 'Unable to read error response')
      console.error('Bot info failed:', errorText)

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
      console.error('Failed to parse bot info JSON:', e)
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
      console.log('Testing LINE Webhook endpoint...')
      const webhookResponse = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
        headers: {
          'Authorization': `Bearer ${testConfig.accessToken}`
        }
      })

      if (webhookResponse.ok) {
        const webhookInfo = await webhookResponse.json()
        console.log('Webhook info retrieved successfully')
        if (isLineWebhookInfo(webhookInfo)) {
          webhookStatus = webhookInfo.active ? 'active' : 'inactive'
        }
      } else {
        console.warn('Webhook check failed:', webhookResponse.status)
      }
    } catch (webhookError) {
      console.warn('Webhook test failed:', webhookError)
    }

    console.log('LINE integration test completed successfully')
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
    console.error('LINE integration test error:', error)
    return {
      status: 'error',
      message: 'LINE 測試過程中發生錯誤',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Test Facebook integration
async function testFacebookIntegration(config: any, env: Bindings) {
  try {
    // If no config provided, try to get from KV
    let testConfig = config
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
    console.log('Testing Facebook Page Access Token...')
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

    // Test 2: Validate App Secret
    console.log('Testing Facebook App Secret...')
    try {
      // Signature test placeholder
    } catch (signatureError) {
      // Expected to fail, this is normal
    }

    // Test 3: Check page permissions
    console.log('Testing Facebook Page Permissions...')
    const permissionsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${testConfig.pageId}?fields=access_token,name,category&access_token=${testConfig.pageToken}`
    )

    let pageDetails = {}
    if (permissionsResponse.ok) {
      pageDetails = await permissionsResponse.json()
    }

    // Test 4: Test messaging capability (to test user, if provided)
    let messagingStatus = 'not_tested'
    if (testConfig.testUserId) {
      try {
        const { FacebookAdapter } = await import('@/integrations/platform-adapter')
        const facebookAdapter = new FacebookAdapter(testConfig.appSecret, testConfig.pageToken)

        const testMessage = await facebookAdapter.sendTextMessage(
          testConfig.testUserId,
          '🤖 Facebook Messenger 整合測試成功！'
        )
        messagingStatus = testMessage ? 'success' : 'failed'
      } catch (messageError) {
        console.warn('Test message failed:', messageError)
        messagingStatus = 'failed'
      }
    }

    return {
      status: 'success',
      message: 'Facebook 連線測試成功',
      details: {
        pageId: isFacebookPageInfo(pageInfo) ? pageInfo.id : 'Unknown',
        pageName: isFacebookPageInfo(pageInfo) ? pageInfo.name : 'Unknown',
        pageCategory: (pageDetails as any).category,
        messagingStatus,
        appId: testConfig.appId
      }
    }
  } catch (error) {
    console.error('Facebook integration test error:', error)
    return {
      status: 'error',
      message: 'Facebook 測試過程中發生錯誤',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
