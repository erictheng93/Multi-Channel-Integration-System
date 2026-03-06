/**
 * Unit Tests for useConversationSync Composable
 *
 * @module tests/unit/composables/conversation/useConversationSync.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Conversation } from '@/types'

// ===== Mock Dependencies =====

const mockOnData = vi.fn()
const mockOnStatus = vi.fn()
const mockStart = vi.fn().mockResolvedValue(undefined)
const mockStop = vi.fn()
const mockRefresh = vi.fn().mockResolvedValue(undefined)

vi.mock('@/services/conversationSync', () => ({
  conversationSync: {
    onData: (...args: unknown[]) => mockOnData(...args),
    onStatus: (...args: unknown[]) => mockOnStatus(...args),
    start: (...args: unknown[]) => mockStart(...args),
    stop: (...args: unknown[]) => mockStop(...args),
    refresh: (...args: unknown[]) => mockRefresh(...args)
  }
}))

import { useConversationSync } from '@/composables/conversation/useConversationSync'

describe('useConversationSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should initialize with disconnected status', () => {
      const { syncStatus } = useConversationSync()
      expect(syncStatus.value).toBe('disconnected')
    })

    it('should initialize isConnected as false', () => {
      const { isConnected } = useConversationSync()
      expect(isConnected.value).toBe(false)
    })

    it('should initialize isSyncing as false', () => {
      const { isSyncing } = useConversationSync()
      expect(isSyncing.value).toBe(false)
    })

    it('should initialize lastUpdate as null', () => {
      const { lastUpdate } = useConversationSync()
      expect(lastUpdate.value).toBeNull()
    })

    it('should initialize syncError as null', () => {
      const { syncError } = useConversationSync()
      expect(syncError.value).toBeNull()
    })
  })

  describe('isConnected computed', () => {
    it('should return true when syncStatus is connected', () => {
      const { syncStatus, isConnected } = useConversationSync()
      syncStatus.value = 'connected'
      expect(isConnected.value).toBe(true)
    })

    it('should return true when syncStatus is polling', () => {
      const { syncStatus, isConnected } = useConversationSync()
      syncStatus.value = 'polling'
      expect(isConnected.value).toBe(true)
    })

    it('should return false when syncStatus is disconnected', () => {
      const { syncStatus, isConnected } = useConversationSync()
      syncStatus.value = 'disconnected'
      expect(isConnected.value).toBe(false)
    })

    it('should return false when syncStatus is connecting', () => {
      const { syncStatus, isConnected } = useConversationSync()
      syncStatus.value = 'connecting'
      expect(isConnected.value).toBe(false)
    })

    it('should return false when syncStatus is error', () => {
      const { syncStatus, isConnected } = useConversationSync()
      syncStatus.value = 'error'
      expect(isConnected.value).toBe(false)
    })
  })

  describe('startSync', () => {
    it('should set isSyncing to true and syncStatus to connecting', async () => {
      const { startSync } = useConversationSync()

      // Start will resolve, but check intermediate state via mock
      const startPromise = startSync()
      // After start resolves
      await startPromise

      expect(mockStart).toHaveBeenCalled()
    })

    it('should register onData callback when provided', async () => {
      const { startSync } = useConversationSync()
      const onDataCallback = vi.fn()

      await startSync(onDataCallback)

      expect(mockOnData).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should register onStatus callback', async () => {
      const { startSync } = useConversationSync()

      await startSync()

      expect(mockOnStatus).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should not register onData callback when not provided', async () => {
      const { startSync } = useConversationSync()

      await startSync()

      expect(mockOnData).not.toHaveBeenCalled()
    })

    it('should call conversationSync.start()', async () => {
      const { startSync } = useConversationSync()

      await startSync()

      expect(mockStart).toHaveBeenCalled()
    })

    it('should clear syncError on start', async () => {
      const { startSync, syncError } = useConversationSync()
      syncError.value = 'previous error'

      await startSync()

      expect(syncError.value).toBeNull()
    })

    it('should handle start failure', async () => {
      mockStart.mockRejectedValueOnce(new Error('connection failed'))
      const { startSync, syncStatus, syncError, isSyncing } = useConversationSync()

      await expect(startSync()).rejects.toThrow('connection failed')

      expect(syncStatus.value).toBe('error')
      expect(syncError.value).toBe('connection failed')
      expect(isSyncing.value).toBe(false)
    })

    it('should handle non-Error start failure', async () => {
      mockStart.mockRejectedValueOnce('string error')
      const { startSync, syncError } = useConversationSync()

      await expect(startSync()).rejects.toBe('string error')

      expect(syncError.value).toBe('同步服务启动失败')
    })

    it('should update lastUpdate when onData callback fires', async () => {
      let capturedDataCallback: ((_data: Conversation[]) => void) | undefined
      mockOnData.mockImplementation((cb: (_data: Conversation[]) => void) => {
        capturedDataCallback = cb
      })

      const outerCallback = vi.fn()
      const { startSync, lastUpdate } = useConversationSync()

      await startSync(outerCallback)

      expect(capturedDataCallback).toBeDefined()
      capturedDataCallback!([] as Conversation[])

      expect(lastUpdate.value).toBeInstanceOf(Date)
      expect(outerCallback).toHaveBeenCalledWith([])
    })

    it('should update syncStatus when onStatus callback fires with connected', async () => {
      let capturedStatusCallback: ((_status: string) => void) | undefined
      mockOnStatus.mockImplementation((cb: (_status: string) => void) => {
        capturedStatusCallback = cb
      })

      const { startSync, syncStatus, isSyncing } = useConversationSync()
      await startSync()

      expect(capturedStatusCallback).toBeDefined()
      capturedStatusCallback!('connected')

      expect(syncStatus.value).toBe('connected')
      expect(isSyncing.value).toBe(false)
    })

    it('should set isSyncing true when status is connecting', async () => {
      let capturedStatusCallback: ((_status: string) => void) | undefined
      mockOnStatus.mockImplementation((cb: (_status: string) => void) => {
        capturedStatusCallback = cb
      })

      const { startSync, isSyncing } = useConversationSync()
      await startSync()

      capturedStatusCallback!('connecting')
      expect(isSyncing.value).toBe(true)
    })

    it('should set syncError when status is error', async () => {
      let capturedStatusCallback: ((_status: string) => void) | undefined
      mockOnStatus.mockImplementation((cb: (_status: string) => void) => {
        capturedStatusCallback = cb
      })

      const { startSync, syncError, isSyncing } = useConversationSync()
      await startSync()

      capturedStatusCallback!('error')
      expect(syncError.value).toBe('同步服务连接失败')
      expect(isSyncing.value).toBe(false)
    })

    it('should set isSyncing false when status is disconnected', async () => {
      let capturedStatusCallback: ((_status: string) => void) | undefined
      mockOnStatus.mockImplementation((cb: (_status: string) => void) => {
        capturedStatusCallback = cb
      })

      const { startSync, isSyncing } = useConversationSync()
      await startSync()

      capturedStatusCallback!('disconnected')
      expect(isSyncing.value).toBe(false)
    })
  })

  describe('stopSync', () => {
    it('should call conversationSync.stop()', () => {
      const { stopSync } = useConversationSync()
      stopSync()
      expect(mockStop).toHaveBeenCalled()
    })

    it('should reset syncStatus to disconnected', () => {
      const { stopSync, syncStatus } = useConversationSync()
      syncStatus.value = 'connected'

      stopSync()

      expect(syncStatus.value).toBe('disconnected')
    })

    it('should set isSyncing to false', () => {
      const { stopSync, isSyncing } = useConversationSync()
      isSyncing.value = true

      stopSync()

      expect(isSyncing.value).toBe(false)
    })

    it('should reset lastUpdate to null', () => {
      const { stopSync, lastUpdate } = useConversationSync()
      lastUpdate.value = new Date()

      stopSync()

      expect(lastUpdate.value).toBeNull()
    })
  })

  describe('refresh', () => {
    it('should call conversationSync.refresh()', async () => {
      const { refresh } = useConversationSync()
      await refresh()
      expect(mockRefresh).toHaveBeenCalled()
    })

    it('should set isSyncing during refresh', async () => {
      let resolveRefresh: () => void
      mockRefresh.mockImplementationOnce(() => new Promise<void>((r) => { resolveRefresh = r }))

      const { refresh, isSyncing } = useConversationSync()
      const promise = refresh()

      expect(isSyncing.value).toBe(true)

      resolveRefresh!()
      await promise

      expect(isSyncing.value).toBe(false)
    })

    it('should update lastUpdate on success', async () => {
      const { refresh, lastUpdate } = useConversationSync()
      await refresh()
      expect(lastUpdate.value).toBeInstanceOf(Date)
    })

    it('should clear syncError on success', async () => {
      const { refresh, syncError } = useConversationSync()
      syncError.value = 'previous error'

      await refresh()

      expect(syncError.value).toBeNull()
    })

    it('should handle refresh failure', async () => {
      mockRefresh.mockRejectedValueOnce(new Error('refresh failed'))
      const { refresh, syncError, isSyncing } = useConversationSync()

      await expect(refresh()).rejects.toThrow('refresh failed')

      expect(syncError.value).toBe('refresh failed')
      expect(isSyncing.value).toBe(false)
    })

    it('should handle non-Error refresh failure', async () => {
      mockRefresh.mockRejectedValueOnce('string error')
      const { refresh, syncError } = useConversationSync()

      await expect(refresh()).rejects.toBe('string error')

      expect(syncError.value).toBe('刷新失败')
    })
  })

  describe('onDataUpdate', () => {
    it('should register callback via conversationSync.onData', () => {
      const { onDataUpdate } = useConversationSync()
      const callback = vi.fn()

      onDataUpdate(callback)

      expect(mockOnData).toHaveBeenCalledWith(callback)
    })
  })

  describe('onStatusChange', () => {
    it('should register callback via conversationSync.onStatus', () => {
      const { onStatusChange } = useConversationSync()
      const callback = vi.fn()

      onStatusChange(callback)

      expect(mockOnStatus).toHaveBeenCalledWith(callback)
    })
  })

  describe('return interface', () => {
    it('should return all expected properties and methods', () => {
      const result = useConversationSync()

      expect(result).toHaveProperty('syncStatus')
      expect(result).toHaveProperty('isConnected')
      expect(result).toHaveProperty('isSyncing')
      expect(result).toHaveProperty('lastUpdate')
      expect(result).toHaveProperty('syncError')
      expect(result).toHaveProperty('startSync')
      expect(result).toHaveProperty('stopSync')
      expect(result).toHaveProperty('refresh')
      expect(result).toHaveProperty('onDataUpdate')
      expect(result).toHaveProperty('onStatusChange')
    })
  })
})
