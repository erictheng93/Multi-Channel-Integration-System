// LINE previewImageUrl must be <= 1MB JPEG/PNG; larger previews show as broken images.
export const PREVIEW_MAX_BYTES = 1024 * 1024
export const PREVIEW_MAX_EDGE = 1024

const START_QUALITY = 0.85
const QUALITY_STEP = 0.15
const MIN_QUALITY = 0.4

export type JpegEncoder = (_q: number) => Promise<Blob>

export function scaleToFit(width: number, height: number, maxEdge = PREVIEW_MAX_EDGE) {
  const ratio = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

export async function encodeUnderLimit(encode: JpegEncoder, maxBytes = PREVIEW_MAX_BYTES): Promise<Blob> {
  for (let quality = START_QUALITY; quality >= MIN_QUALITY - 1e-9; quality -= QUALITY_STEP) {
    const blob = await encode(quality)
    if (blob.size <= maxBytes) {
      return blob
    }
  }
  throw new Error('預覽圖無法壓縮到 1MB 以下')
}

 
export async function createBroadcastPreview(file: File): Promise<File> {
  const bitmap = await (globalThis as any).createImageBitmap(file)
  const { width, height } = scaleToFit(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('瀏覽器不支援圖片處理')
  }
  // JPEG has no alpha: paint white so transparent PNG areas do not turn black.
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await encodeUnderLimit((quality) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('預覽圖產生失敗'))),
      'image/jpeg',
      quality
    )
  }))
  const baseName = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `preview-${baseName}.jpg`, { type: 'image/jpeg' })
}
