/**
 * useQRCodeDownloader Composable
 *
 * Purpose: Extract QR Code download Canvas rendering logic (175 lines)
 * Extracted from: TeamCard.vue downloadQRCode() method (lines 950-1126)
 *
 * Responsibilities:
 * - High-quality Canvas rendering for QR Code cards
 * - CORS handling via Worker proxy
 * - iOS/Apple professional font stack
 * - PNG encoding and download trigger
 *
 * @module composables/team-management/useQRCodeDownloader
 */

import { ref, type Ref } from 'vue'
import { getBackendUrl, getStoragePublicUrl } from '@/config/runtime'
import { useToast } from '@/composables/useToast'

/**
 * Return type for useQRCodeDownloader composable
 */
export interface UseQRCodeDownloaderReturn {
  /** Download operation in progress */
  isDownloading: Ref<boolean>

  /** Error message if download fails */
  downloadError: Ref<string | null>

  /**
   * Download QR Code card with Flex Bubble design
   * @param options - Download configuration
   */
  downloadQRCodeCard: (options: {
    qrCodeUrl: string
    teamName: string
    scale?: number
  }) => Promise<void>
}

/**
 * QR Code downloader composable with Canvas rendering
 *
 * Features:
 * - 3x scale for high-DPI displays (780x600+ px)
 * - CORS-safe image loading via Worker proxy
 * - iOS/Apple design language (fonts, colors, shadows)
 * - Professional PNG output with metadata
 *
 * @returns Download controls and state
 */
export function useQRCodeDownloader(): UseQRCodeDownloaderReturn {
  const { showSuccess, showError } = useToast()

  const isDownloading = ref(false)
  const downloadError = ref<string | null>(null)

  /**
   * Convert R2 Storage URL to Worker proxy URL for CORS support
   * R2 Custom Domain doesn't support CORS, so we route through Worker
   *
   * @param qrCodeUrl - Original QR Code image URL
   * @returns CORS-safe proxy URL or original URL
   */
  const convertToProxyUrl = (qrCodeUrl: string): string => {
    const storageUrl = getStoragePublicUrl()
    const storageHostname = new URL(storageUrl).hostname

    if (qrCodeUrl.includes(storageHostname)) {
      // Convert Storage URL to Worker proxy URL
      return qrCodeUrl.replace(
        storageUrl,
        `${getBackendUrl()}/api/r2-public`
      )
    }

    return qrCodeUrl
  }

  /**
   * Helper: Draw rounded rectangle path on canvas
   */
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  /**
   * Download QR Code card as high-quality PNG
   * Renders a complete Flex Bubble card design with:
   * - QR Code image
   * - Team name title
   * - Subtitle text
   * - Action button (styled but non-functional in static image)
   *
   * Output: {TeamName}_LINE_QR_{YYYYMMDD}.png
   */
  const downloadQRCodeCard = async (options: {
    qrCodeUrl: string
    teamName: string
    scale?: number
  }) => {
    const { qrCodeUrl, teamName, scale = 3 } = options

    if (!qrCodeUrl) {
      downloadError.value = 'QR Code URL is required'
      showError('QR Code URL 無效')
      return
    }

    try {
      isDownloading.value = true
      downloadError.value = null

      // 🔧 Convert to CORS-safe proxy URL
      const proxyUrl = convertToProxyUrl(qrCodeUrl)
      console.log('🔧 [QR Download] Using proxy URL:', proxyUrl)

      // 🎨 Design parameters (3x scale for print quality)
      const cardWidth = 260 * scale
      const borderRadius = 20 * scale

      // 📐 Padding settings (matches QRcodeDesign.html)
      const bodyPaddingTop = 35 * scale
      const footerPaddingX = 20 * scale
      const footerPaddingBottom = 20 * scale

      // 🎯 QR Code dimensions
      const qrSize = 140 * scale

      // ✍️ Typography settings
      const titleFontSize = 19 * scale
      const titleMarginTop = 24 * scale
      const subtitleFontSize = 13 * scale
      const subtitleMarginTop = 8 * scale

      // 🔘 Button settings
      const btnHeight = 40 * scale
      const btnRadius = 10 * scale
      const btnFontSize = 15 * scale
      const btnMarginTop = 25 * scale

      // 📏 Calculate total height (with line-height buffer)
      const titleHeight = titleFontSize * 1.3
      const subtitleHeight = subtitleFontSize * 1.3
      const cardHeight =
        bodyPaddingTop +
        qrSize +
        titleMarginTop +
        titleHeight +
        subtitleMarginTop +
        subtitleHeight +
        btnMarginTop +
        btnHeight +
        footerPaddingBottom

      // 🎨 Create high-quality Canvas (alpha channel disabled for performance)
      const canvas = document.createElement('canvas')
      canvas.width = cardWidth
      canvas.height = cardHeight
      const ctx = canvas.getContext('2d', { alpha: false })

      if (!ctx) {
        throw new Error('Unable to create Canvas 2D context')
      }

      // 🔧 Enable high-quality rendering
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // 1️⃣ Draw card background (white + iOS shadow)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
      ctx.shadowBlur = 12 * scale
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 4 * scale

      ctx.fillStyle = '#FFFFFF'
      drawRoundedRect(ctx, 0, 0, cardWidth, cardHeight, borderRadius)
      ctx.fill()

      // Disable shadow for subsequent draws
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0

      // 2️⃣ Load and draw QR Code image
      const qrImg = new window.Image()
      qrImg.crossOrigin = 'anonymous' // Enable CORS
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve()
        qrImg.onerror = () => reject(new Error('QR Code image failed to load'))
        qrImg.src = proxyUrl
      })

      // Draw QR Code centered
      const qrX = (cardWidth - qrSize) / 2
      const qrY = bodyPaddingTop
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

      // 3️⃣ Draw title (Team name - iOS font)
      ctx.fillStyle = '#000000' // Pure black
      ctx.font = `600 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", Roboto, Helvetica, Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      const titleY = qrY + qrSize + titleMarginTop
      ctx.fillText(teamName, cardWidth / 2, titleY)

      // 4️⃣ Draw subtitle (iOS gray)
      ctx.fillStyle = '#8E8E93' // Apple System Gray
      ctx.font = `400 ${subtitleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", Roboto, Helvetica, Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      const subtitleY = titleY + titleHeight + subtitleMarginTop
      ctx.fillText('掃描加入 LINE 官方帳號', cardWidth / 2, subtitleY)

      // 5️⃣ Draw button (iOS Secondary style - gray background, blue text)
      const btnWidth = cardWidth - footerPaddingX * 2
      const btnX = footerPaddingX
      const btnY = subtitleY + subtitleHeight + btnMarginTop

      // Button background - iOS Secondary Gray
      ctx.fillStyle = '#F2F2F7'
      drawRoundedRect(ctx, btnX, btnY, btnWidth, btnHeight, btnRadius)
      ctx.fill()

      // Button text - Apple Blue
      ctx.fillStyle = '#007AFF'
      ctx.font = `600 ${btnFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", Roboto, Helvetica, Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('掃描 QR Code 加入', cardWidth / 2, btnY + btnHeight / 2)

      // 6️⃣ Convert to PNG and trigger download
      // Generate professional filename: {TeamName}_LINE_QR_{YYYYMMDD}.png
      const now = new Date()
      const year = now.getFullYear()
      const month = (now.getMonth() + 1).toString().padStart(2, '0')
      const day = now.getDate().toString().padStart(2, '0')
      const dateStr = `${year}${month}${day}`

      const pngDataUrl = canvas.toDataURL('image/png', 1.0)
      const link = document.createElement('a')
      link.href = pngDataUrl
      link.download = `${teamName}_LINE_QR_${dateStr}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      showSuccess(`✅ QR Code 卡片已下載 (${teamName})`)
    } catch (error) {
      console.error('❌ QR Code download failed:', error)
      downloadError.value = error instanceof Error ? error.message : 'Unknown error'
      showError('QR Code 下載失敗，請稍後再試')
    } finally {
      isDownloading.value = false
    }
  }

  return {
    isDownloading,
    downloadError,
    downloadQRCodeCard
  }
}
