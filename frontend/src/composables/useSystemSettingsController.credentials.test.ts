import { describe, it, expect, vi, beforeEach } from 'vitest'

const storeCredential = vi.fn()
const getAllCredentials = vi.fn()
const updateSettings = vi.fn()
const testIntegration = vi.fn()

vi.mock('@/api/system', () => ({
  systemApi: {
    getSettings: vi.fn().mockResolvedValue({ success: true, data: {} }),
    updateSettings: (...a: unknown[]) => updateSettings(...a),
    testIntegration: (...a: unknown[]) => testIntegration(...a)
  },
  credentialsApi: {
    storeCredential: (...a: unknown[]) => storeCredential(...a),
    getAllCredentials: () => getAllCredentials(),
    clearPlatformCredentials: vi.fn()
  }
}))
vi.mock('@/composables/useI18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('@/composables/useConfirmDialog', () => ({ useConfirmDialog: () => ({ showDanger: vi.fn() }) }))

import { useSystemSettingsController } from './useSystemSettingsController'

const masked = (configured: boolean, last4: string | null = null) => ({ configured, last4 })
const allConfigured = {
  line: { channelId: masked(true, '1234'), channelSecret: masked(true, 'abcd'), accessToken: masked(true, 'wxyz') },
  facebook: { appId: masked(false), appSecret: masked(false), pageId: masked(false), pageToken: masked(false) }
}

describe('integration credentials are never posted back unless replaced', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAllCredentials.mockResolvedValue({ success: true, data: allConfigured })
    storeCredential.mockResolvedValue({ success: true })
    updateSettings.mockResolvedValue({ success: true })
    testIntegration.mockResolvedValue({ success: true, data: { status: 'success' } })
  })

  it('loading never puts secrets in the form fields', async () => {
    const c = useSystemSettingsController()
    await c.loadSettings()
    expect(c.settings.integrations.line.channelSecret).toBe('')
    expect(c.settings.integrations.line.accessToken).toBe('')
    expect(c.credentialStatus.value?.line.accessToken.configured).toBe(true)
  })

  it('saving with nothing replaced posts no credential', async () => {
    const c = useSystemSettingsController()
    await c.loadSettings()
    await c.saveLineSettings()
    expect(storeCredential).not.toHaveBeenCalled()
  })

  it('saving posts only the fields the user replaced', async () => {
    const c = useSystemSettingsController()
    await c.loadSettings()
    c.settings.integrations.line.accessToken = ' new-token-value '
    await c.saveLineSettings()
    expect(storeCredential).toHaveBeenCalledTimes(1)
    expect(storeCredential).toHaveBeenCalledWith('line', 'accessToken', 'new-token-value')
    expect(c.settings.integrations.line.accessToken).toBe('')
  })

  it('masked placeholders are never posted', async () => {
    const c = useSystemSettingsController()
    await c.loadSettings()
    c.settings.integrations.line.channelSecret = '••••abcd'
    await c.saveLineSettings()
    expect(storeCredential).not.toHaveBeenCalled()
  })

  it('an unconfigured platform still requires every field', async () => {
    const c = useSystemSettingsController()
    await c.loadSettings()
    c.settings.integrations.facebook.appId = '123'
    await c.saveFacebookSettings()
    expect(storeCredential).not.toHaveBeenCalled()
  })

  it('testing sends only replaced fields (server falls back to stored values)', async () => {
    const c = useSystemSettingsController()
    await c.loadSettings()
    await c.testLineIntegration()
    expect(testIntegration).toHaveBeenCalledWith('line', {})
  })
})
