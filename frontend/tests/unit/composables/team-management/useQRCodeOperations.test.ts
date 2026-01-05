/**
 * Unit Tests for useQRCodeOperations Composable
 *
 * @module tests/unit/composables/team-management/useQRCodeOperations.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useQRCodeOperations } from '@/composables/team-management/useQRCodeOperations'
import type { Team } from '@/composables/team-management/useQRCodeOperations'

// Mock dependencies - Note: QR code store uses computed getters that return functions
// Create singleton mock instance to ensure same instance is used across all calls
const mockGetQRCodeFn = vi.fn()
const mockIsCacheValidFn = vi.fn()
const mockIsLoadingFn = vi.fn()
const mockIsGeneratingFn = vi.fn()
const mockLoadQRCode = vi.fn()
const mockPrefetchQRCode = vi.fn()

const mockStoreInstance = {
  // Computed getters (refs with function values)
  getQRCode: { value: mockGetQRCodeFn },
  isCacheValid: { value: mockIsCacheValidFn },
  isLoading: { value: mockIsLoadingFn },
  isGenerating: { value: mockIsGeneratingFn },

  // Actions (regular functions)
  loadQRCode: mockLoadQRCode,
  prefetchQRCode: mockPrefetchQRCode,
  generateQRCode: vi.fn(),
  getQRStats: vi.fn(),
  invalidateCache: vi.fn(),
  clearAllCache: vi.fn(),
  clearError: vi.fn(),
  $reset: vi.fn(),

  // Internal mock functions for test access
  _mockGetQRCode: mockGetQRCodeFn,
  _mockIsCacheValid: mockIsCacheValidFn,
  _mockIsLoading: mockIsLoadingFn,
  _mockIsGenerating: mockIsGeneratingFn
}

vi.mock('@/stores/qrcode', () => ({
  useQRCodeStore: vi.fn(() => mockStoreInstance)
}))

vi.mock('@/config/features', () => ({
  isFeatureEnabled: vi.fn(() => true),
  checkNetworkConditions: vi.fn(() => true),
  getFeatureConfig: vi.fn(() => ({ idleTimeout: 100 }))
}))

vi.mock('@/services/qrPreloadService', () => ({
  qrPreloadService: {
    start: vi.fn(),
    stop: vi.fn()
  }
}))

describe('useQRCodeOperations', () => {
  let operations: ReturnType<typeof useQRCodeOperations>
  let mockQRCodeStore: any
  let mockFeatures: any
  let mockQRPreloadService: any

  // Mock team data
  const mockTeam: Team = {
    id: 1,
    name: 'Test Team',
    description: 'Test Description',
    qrCode: 'data:image/png;base64,test-qr-code',
    lineUrl: 'https://line.me/test',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    memberCount: 5
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get mock references - Use the singleton instance
    mockQRCodeStore = mockStoreInstance

    const featuresModule = await import('@/config/features')
    mockFeatures = featuresModule as any

    const serviceModule = await import('@/services/qrPreloadService')
    mockQRPreloadService = serviceModule.qrPreloadService as any

    // Set default mock behaviors for computed getters
    mockGetQRCodeFn.mockReturnValue(null)
    mockIsCacheValidFn.mockReturnValue(false)
    mockIsLoadingFn.mockReturnValue(false)
    mockIsGeneratingFn.mockReturnValue(false)

    operations = useQRCodeOperations()
  })

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      expect(operations.qrModal.value).toBe(false)
      expect(operations.currentTeam.value).toBeNull()
      expect(operations.currentQRCode.value).toBe('')
      expect(operations.qrImageLoading.value).toBe(true)
      expect(operations.qrGenerating.value).toBe(false)
    })

    it('should expose all required state properties', () => {
      expect(operations.qrModal).toBeDefined()
      expect(operations.currentTeam).toBeDefined()
      expect(operations.currentQRCode).toBeDefined()
      expect(operations.qrImageLoading).toBeDefined()
      expect(operations.qrGenerating).toBeDefined()
    })

    it('should expose all required operations', () => {
      expect(typeof operations.viewQR).toBe('function')
      expect(typeof operations.downloadQR).toBe('function')
      expect(typeof operations.closeQRModal).toBe('function')
      expect(typeof operations.onQRImageLoad).toBe('function')
      expect(typeof operations.onQRImageError).toBe('function')
      expect(typeof operations.startBackgroundPreload).toBe('function')
      expect(typeof operations.stopBackgroundPreload).toBe('function')
      expect(typeof operations.prefetchOnHover).toBe('function')
    })
  })

  // ============================================================================
  // QR Modal State Tests
  // ============================================================================

  describe('QR Modal State', () => {
    it('should open modal when viewQR is called', async () => {
      await operations.viewQR(mockTeam)

      expect(operations.qrModal.value).toBe(true)
      expect(operations.currentTeam.value).toEqual(mockTeam)
    })

    it('should close modal when closeQRModal is called', () => {
      // First open modal
      operations.qrModal.value = true
      operations.currentTeam.value = mockTeam
      operations.currentQRCode.value = 'test-qr'

      // Then close
      operations.closeQRModal()

      expect(operations.qrModal.value).toBe(false)
      expect(operations.currentTeam.value).toBeNull()
      expect(operations.currentQRCode.value).toBe('')
      expect(operations.qrImageLoading.value).toBe(true)
      expect(operations.qrGenerating.value).toBe(false)
    })
  })

  // ============================================================================
  // viewQR Tests
  // ============================================================================

  describe('viewQR', () => {
    it('should open modal and set current team', async () => {
      await operations.viewQR(mockTeam)

      expect(operations.qrModal.value).toBe(true)
      expect(operations.currentTeam.value).toEqual(mockTeam)
    })

    it('should use QR code from team object if available', async () => {
      await operations.viewQR(mockTeam)

      expect(operations.currentQRCode.value).toBeTruthy()
    })

    it('should handle errors gracefully', async () => {
      mockLoadQRCode.mockRejectedValue(new Error('Load failed'))

      const teamWithoutQR: Team = { ...mockTeam, qrCode: undefined }

      await operations.viewQR(teamWithoutQR)

      expect(operations.currentQRCode.value).toBe('')
      expect(operations.qrImageLoading.value).toBe(false)
      expect(operations.qrGenerating.value).toBe(false)
    })

    it('should set qrImageLoading to false when no QR code exists', async () => {
      const teamWithoutQR: Team = { ...mockTeam, qrCode: undefined }
      mockGetQRCodeFn.mockReturnValue(null) // No cached QR
      mockLoadQRCode.mockResolvedValue(null) // API returns null

      await operations.viewQR(teamWithoutQR)

      expect(operations.qrImageLoading.value).toBe(false)
      expect(operations.qrGenerating.value).toBe(false)
    })
  })

  // ============================================================================
  // Image Load Event Tests
  // ============================================================================

  describe('Image Load Events', () => {
    it('should set qrImageLoading to false on image load', () => {
      operations.qrImageLoading.value = true

      operations.onQRImageLoad()

      expect(operations.qrImageLoading.value).toBe(false)
    })

    it('should set qrImageLoading to false on image error', () => {
      operations.qrImageLoading.value = true

      operations.onQRImageError()

      expect(operations.qrImageLoading.value).toBe(false)
    })
  })

  // ============================================================================
  // Download QR Tests
  // ============================================================================

  describe('downloadQR', () => {
    beforeEach(() => {
      // Mock document methods
      global.document.createElement = vi.fn().mockReturnValue({
        href: '',
        download: '',
        click: vi.fn()
      })
      global.document.body.appendChild = vi.fn()
      global.document.body.removeChild = vi.fn()
    })

    it('should not download when no QR code', () => {
      operations.currentQRCode.value = ''
      operations.currentTeam.value = mockTeam

      operations.downloadQR()

      expect(document.createElement).not.toHaveBeenCalled()
    })

    it('should not download when no current team', () => {
      operations.currentQRCode.value = 'test-qr'
      operations.currentTeam.value = null

      operations.downloadQR()

      expect(document.createElement).not.toHaveBeenCalled()
    })

    it('should download when both QR code and team exist', () => {
      operations.currentQRCode.value = 'test-qr'
      operations.currentTeam.value = mockTeam

      operations.downloadQR()

      expect(document.createElement).toHaveBeenCalledWith('a')
      expect(document.body.appendChild).toHaveBeenCalled()
      expect(document.body.removeChild).toHaveBeenCalled()
    })

    it('should handle download errors gracefully', () => {
      operations.currentQRCode.value = 'test-qr'
      operations.currentTeam.value = mockTeam
      global.document.createElement = vi.fn().mockImplementation(() => {
        throw new Error('Create element failed')
      })

      expect(() => operations.downloadQR()).not.toThrow()
    })
  })

  // ============================================================================
  // Background Preload Tests
  // ============================================================================

  describe('Background Preload', () => {
    it('should not start preload when feature is disabled', () => {
      mockFeatures.isFeatureEnabled = vi.fn().mockReturnValue(false)

      operations.startBackgroundPreload([mockTeam])

      expect(mockFeatures.isFeatureEnabled).toHaveBeenCalledWith('QR_BACKGROUND_PRELOAD')
    })

    it('should not start preload when network conditions are poor', () => {
      mockFeatures.isFeatureEnabled = vi.fn().mockReturnValue(true)
      mockFeatures.checkNetworkConditions = vi.fn().mockReturnValue(false)

      operations.startBackgroundPreload([mockTeam])

      expect(mockFeatures.checkNetworkConditions).toHaveBeenCalled()
    })

    it('should not start preload when no teams', async () => {
      operations.startBackgroundPreload([])

      // Should return early, not call preload service
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(mockQRPreloadService.start).not.toHaveBeenCalled()
    })

    it('should start preload when conditions are met', async () => {
      vi.useFakeTimers()

      mockFeatures.isFeatureEnabled = vi.fn().mockReturnValue(true)
      mockFeatures.checkNetworkConditions = vi.fn().mockReturnValue(true)

      operations.startBackgroundPreload([mockTeam])

      // Wait for idle timeout
      vi.advanceTimersByTime(150)
      await vi.runAllTimersAsync()

      expect(mockQRPreloadService.start).toHaveBeenCalledWith([mockTeam])

      vi.useRealTimers()
    })

    it('should stop preload when requested', () => {
      operations.stopBackgroundPreload()

      expect(mockQRPreloadService.stop).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Hover Prefetch Tests
  // ============================================================================

  describe('Hover Prefetch', () => {
    it('should skip prefetch when cache is valid and feature enabled', async () => {
      mockFeatures.isFeatureEnabled = vi.fn().mockReturnValue(true)
      mockIsCacheValidFn.mockReturnValue(true) // Cache is valid

      await operations.prefetchOnHover(mockTeam)

      // Should call isCacheValid to check cache
      expect(mockIsCacheValidFn).toHaveBeenCalledWith(mockTeam.id)
      // Should NOT prefetch because cache is valid
      expect(mockPrefetchQRCode).not.toHaveBeenCalled()
    })

    it('should prefetch when cache is invalid', async () => {
      mockFeatures.isFeatureEnabled = vi.fn().mockReturnValue(true)
      mockIsCacheValidFn.mockReturnValue(false) // Cache is invalid
      mockPrefetchQRCode.mockResolvedValue(undefined)

      await operations.prefetchOnHover(mockTeam)

      // Should prefetch because cache is invalid
      expect(mockPrefetchQRCode).toHaveBeenCalledWith(mockTeam.id)
    })

    it('should prefetch when feature is disabled', async () => {
      mockFeatures.isFeatureEnabled = vi.fn().mockReturnValue(false)
      mockIsCacheValidFn.mockReturnValue(false) // Cache is invalid
      mockPrefetchQRCode.mockResolvedValue(undefined)

      await operations.prefetchOnHover(mockTeam)

      // Should prefetch because feature is disabled (fallback behavior)
      expect(mockPrefetchQRCode).toHaveBeenCalledWith(mockTeam.id)
    })

    it('should not throw when called', async () => {
      expect(() => operations.prefetchOnHover(mockTeam)).not.toThrow()
    })
  })
})
