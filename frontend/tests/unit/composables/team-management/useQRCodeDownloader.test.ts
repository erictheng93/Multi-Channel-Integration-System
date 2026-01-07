/**
 * useQRCodeDownloader Composable - Unit Tests
 *
 * Tests Canvas rendering logic, CORS handling, and download functionality
 * Coverage target: 80%+
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useQRCodeDownloader } from '@/composables/team-management/useQRCodeDownloader'

// Mock toast composable
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn()
  })
}))

// Mock runtime config
vi.mock('@/config/runtime', () => ({
  getBackendUrl: () => 'http://localhost:8787',
  getStoragePublicUrl: () => 'http://storage.example.com'
}))

describe('useQRCodeDownloader', () => {
  let mockCanvas: HTMLCanvasElement
  let mockContext: CanvasRenderingContext2D
  let mockImage: HTMLImageElement

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock Canvas API
    mockContext = {
      fillStyle: '',
      font: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      fillRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockContext),
      toDataURL: vi.fn(() => 'data:image/png;base64,mockedImageData')
    } as unknown as HTMLCanvasElement

    // Mock document.createElement for canvas
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas
      }
      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          click: vi.fn()
        } as unknown as HTMLAnchorElement
      }
      return document.createElement(tagName)
    })

    // Mock Image constructor
    mockImage = {
      src: '',
      crossOrigin: '',
      onload: null,
      onerror: null
    } as unknown as HTMLImageElement

    global.Image = vi.fn(() => mockImage) as any

    // Mock document.body methods
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with correct default state', () => {
    const { isDownloading, downloadError } = useQRCodeDownloader()

    expect(isDownloading.value).toBe(false)
    expect(downloadError.value).toBe(null)
  })

  it('should create canvas with correct dimensions (3x scale)', async () => {
    const { downloadQRCodeCard } = useQRCodeDownloader()

    // Trigger image load automatically
    setTimeout(() => {
      if (mockImage.onload) {
        mockImage.onload(new Event('load'))
      }
    }, 0)

    await downloadQRCodeCard({
      qrCodeUrl: 'http://example.com/qr.png',
      teamName: 'Test Team'
    })

    // Default scale is 3, cardWidth = 260 * 3 = 780
    expect(mockCanvas.width).toBe(780)
    // Height calculation: bodyPadding(105) + qr(420) + titleMargin(72) + titleHeight(74)
    //                    + subtitleMargin(24) + subtitleHeight(51) + btnMargin(75) + btnHeight(120) + footerPadding(60)
    expect(mockCanvas.height).toBeGreaterThan(0)
  })

  it('should convert storage URL to proxy URL for CORS', async () => {
    const { downloadQRCodeCard } = useQRCodeDownloader()

    // Trigger image load
    setTimeout(() => {
      if (mockImage.onload) {
        mockImage.onload(new Event('load'))
      }
    }, 0)

    await downloadQRCodeCard({
      qrCodeUrl: 'http://storage.example.com/qr-codes/team-1.png',
      teamName: 'Test Team'
    })

    // Verify proxy URL was used
    expect(mockImage.src).toBe('http://localhost:8787/api/r2-public/qr-codes/team-1.png')
  })

  it('should not convert non-storage URLs', async () => {
    const { downloadQRCodeCard } = useQRCodeDownloader()

    setTimeout(() => {
      if (mockImage.onload) {
        mockImage.onload(new Event('load'))
      }
    }, 0)

    await downloadQRCodeCard({
      qrCodeUrl: 'http://other-domain.com/qr.png',
      teamName: 'Test Team'
    })

    // URL should remain unchanged
    expect(mockImage.src).toBe('http://other-domain.com/qr.png')
  })

  it('should enable high-quality rendering', async () => {
    const { downloadQRCodeCard } = useQRCodeDownloader()

    setTimeout(() => {
      if (mockImage.onload) {
        mockImage.onload(new Event('load'))
      }
    }, 0)

    await downloadQRCodeCard({
      qrCodeUrl: 'http://example.com/qr.png',
      teamName: 'Test Team'
    })

    expect(mockContext.imageSmoothingEnabled).toBe(true)
    expect(mockContext.imageSmoothingQuality).toBe('high')
  })

  it('should set crossOrigin for CORS support', async () => {
    const { downloadQRCodeCard } = useQRCodeDownloader()

    setTimeout(() => {
      if (mockImage.onload) {
        mockImage.onload(new Event('load'))
      }
    }, 0)

    await downloadQRCodeCard({
      qrCodeUrl: 'http://example.com/qr.png',
      teamName: 'Test Team'
    })

    expect(mockImage.crossOrigin).toBe('anonymous')
  })

  it('should trigger download with correct filename', async () => {
    const { downloadQRCodeCard } = useQRCodeDownloader()
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn()
    }

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas
      }
      if (tagName === 'a') {
        return mockLink as unknown as HTMLAnchorElement
      }
      return document.createElement(tagName)
    })

    setTimeout(() => {
      if (mockImage.onload) {
        mockImage.onload(new Event('load'))
      }
    }, 0)

    await downloadQRCodeCard({
      qrCodeUrl: 'http://example.com/qr.png',
      teamName: 'My Team'
    })

    // Verify filename format: {TeamName}_LINE_QR_{YYYYMMDD}.png
    expect(mockLink.download).toMatch(/^My Team_LINE_QR_\d{8}\.png$/)
    expect(mockLink.click).toHaveBeenCalled()
  })

  it('should handle image load errors', async () => {
    const { downloadQRCodeCard, downloadError } = useQRCodeDownloader()

    setTimeout(() => {
      if (mockImage.onerror) {
        mockImage.onerror(new Event('error'))
      }
    }, 0)

    await downloadQRCodeCard({
      qrCodeUrl: 'http://example.com/invalid.png',
      teamName: 'Test Team'
    })

    expect(downloadError.value).toBeTruthy()
    expect(downloadError.value).toContain('failed to load')
  })

  it('should handle missing QR Code URL', async () => {
    const { downloadQRCodeCard, downloadError } = useQRCodeDownloader()

    await downloadQRCodeCard({
      qrCodeUrl: '',
      teamName: 'Test Team'
    })

    expect(downloadError.value).toBe('QR Code URL is required')
  })

  it('should set isDownloading during operation', async () => {
    const { downloadQRCodeCard, isDownloading } = useQRCodeDownloader()

    const downloadPromise = downloadQRCodeCard({
      qrCodeUrl: 'http://example.com/qr.png',
      teamName: 'Test Team'
    })

    // Should be downloading
    expect(isDownloading.value).toBe(true)

    // Trigger image load
    if (mockImage.onload) {
      mockImage.onload(new Event('load'))
    }

    await downloadPromise

    // Should finish downloading
    expect(isDownloading.value).toBe(false)
  })

  it('should use custom scale factor', async () => {
    const { downloadQRCodeCard } = useQRCodeDownloader()

    setTimeout(() => {
      if (mockImage.onload) {
        mockImage.onload(new Event('load'))
      }
    }, 0)

    await downloadQRCodeCard({
      qrCodeUrl: 'http://example.com/qr.png',
      teamName: 'Test Team',
      scale: 2
    })

    // Scale 2: cardWidth = 260 * 2 = 520
    expect(mockCanvas.width).toBe(520)
  })

  it('should draw all card elements', async () => {
    const { downloadQRCodeCard } = useQRCodeDownloader()

    setTimeout(() => {
      if (mockImage.onload) {
        mockImage.onload(new Event('load'))
      }
    }, 0)

    await downloadQRCodeCard({
      qrCodeUrl: 'http://example.com/qr.png',
      teamName: 'Test Team'
    })

    // Verify Canvas drawing operations
    expect(mockContext.fill).toHaveBeenCalled() // Background + button
    expect(mockContext.fillText).toHaveBeenCalledTimes(3) // Title + subtitle + button text
    expect(mockContext.drawImage).toHaveBeenCalled() // QR Code image
  })
})
