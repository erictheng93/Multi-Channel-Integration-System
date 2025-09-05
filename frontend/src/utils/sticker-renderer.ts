/**
 * 綜合貼圖渲染系統
 * 支持LINE貼圖、Facebook媒體和自定義貼圖的顯示
 */

// 貼圖渲染結果接口
export interface StickerRenderResult {
  type: 'image' | 'fallback';
  content: string;
  alt: string;
  className?: string;
  style?: Record<string, string>;
}

// LINE貼圖媒體數據接口
export interface LineMediaData {
  packageId: string;
  stickerId: string;
}

// Facebook媒體數據接口
export interface FacebookMediaData {
  attachmentId: string;
  url: string;
  type?: string;
}

// 未知貼圖數據類型
export interface UnknownStickerData {
  [key: string]: unknown;
}

// 所有支持的貼圖數據類型
export type StickerData = LineMediaData | FacebookMediaData | UnknownStickerData;

// 貼圖尺寸配置
const STICKER_SIZES = {
  small: { width: '80px', height: '80px' },
  medium: { width: '120px', height: '120px' },
  large: { width: '160px', height: '160px' },
  auto: { maxWidth: '200px', maxHeight: '200px' }
};

export class ComprehensiveStickerRenderer {
  private stickerCache = new Map<string, StickerRenderResult>();
  private errorCache = new Set<string>();
  
  constructor() {
    this.initializeErrorHandling();
  }

  /**
   * 初始化錯誤處理
   */
  private initializeErrorHandling() {
    // 監聽圖片加載錯誤，添加到錯誤緩存
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        const target = event.target as HTMLImageElement;
        if (target?.tagName === 'IMG' && target.src) {
          this.errorCache.add(target.src);
        }
      }, true);
    }
  }

  /**
   * 主要的貼圖處理方法
   */
  async processStickerMetadata(
    metadata: string | null, 
    messageType: string,
    size: keyof typeof STICKER_SIZES = 'medium'
  ): Promise<StickerRenderResult | null> {
    
    console.log('🔍 [StickerRenderer] processStickerMetadata called')
    console.log('🔍 [StickerRenderer] metadata:', metadata)
    console.log('🔍 [StickerRenderer] messageType:', messageType)
    console.log('🔍 [StickerRenderer] size:', size)
    
    if (!metadata || messageType !== 'sticker') {
      console.log('❌ [StickerRenderer] Invalid metadata or messageType, returning null')
      return null;
    }

    try {
      const parsedMetadata = JSON.parse(metadata);
      console.log('🔍 [StickerRenderer] Parsed metadata:', parsedMetadata)
      const result = await this.renderSticker(parsedMetadata, size);
      console.log('🔍 [StickerRenderer] Render result:', result)
      return result;
    } catch (error) {
      console.warn('❌ [StickerRenderer] 無法解析貼圖元數據:', error);
      const fallback = this.createFallbackResult('貼圖', size);
      console.log('🔍 [StickerRenderer] Created fallback result:', fallback)
      return fallback;
    }
  }

  /**
   * 渲染不同類型的貼圖
   */
  private async renderSticker(
    metadata: StickerData,
    size: keyof typeof STICKER_SIZES
  ): Promise<StickerRenderResult> {
    
    // LINE貼圖處理
    if (this.isLineSticker(metadata)) {
      return this.renderLineSticker(metadata, size);
    }
    
    // Facebook媒體處理  
    if (this.isFacebookMedia(metadata)) {
      return this.renderFacebookMedia(metadata, size);
    }
    
    // 其他類型處理
    return this.renderGenericSticker(metadata, size);
  }

  /**
   * 檢查是否為LINE貼圖
   */
  private isLineSticker(metadata: StickerData): metadata is LineMediaData {
    return metadata && 
           'packageId' in metadata && typeof metadata.packageId === 'string' && 
           'stickerId' in metadata && typeof metadata.stickerId === 'string';
  }

  /**
   * 檢查是否為Facebook媒體
   */
  private isFacebookMedia(metadata: StickerData): metadata is FacebookMediaData {
    return metadata && 
           'url' in metadata && typeof metadata.url === 'string';
  }

  /**
   * 渲染LINE貼圖
   */
  private async renderLineSticker(
    metadata: LineMediaData, 
    size: keyof typeof STICKER_SIZES
  ): Promise<StickerRenderResult> {
    
    console.log('🔍 [StickerRenderer] renderLineSticker called with:', metadata)
    
    const { packageId, stickerId } = metadata;
    if (!packageId || !stickerId) {
      console.log('❌ [StickerRenderer] Missing packageId or stickerId')
      return this.createFallbackResult('LINE 貼圖', size);
    }

    // TypeScript type narrowing - we know these are strings now
    const validPackageId: string = packageId;
    const validStickerId: string = stickerId;

    console.log('🔍 [StickerRenderer] Package ID:', validPackageId, 'Sticker ID:', validStickerId)

    const cacheKey = `line_${validPackageId}_${validStickerId}_${size}`;
    
    // 檢查緩存
    const cached = this.stickerCache.get(cacheKey);
    if (cached) {
      console.log('🔍 [StickerRenderer] Found cached result for:', cacheKey)
      return cached;
    }

    // 生成LINE貼圖URL
    const stickerUrls = this.generateLineStickerUrls(validPackageId, validStickerId);
    console.log('🔍 [StickerRenderer] Generated URLs:', stickerUrls)
    
    // 測試URL可用性
    for (let i = 0; i < stickerUrls.length; i++) {
      const url = stickerUrls[i];
      if (!url) {continue;} // Skip undefined URLs
      
      console.log(`🔍 [StickerRenderer] Trying URL ${i + 1}/${stickerUrls.length}: ${url}`)
      
      if (!this.errorCache.has(url)) {
        console.log('🔍 [StickerRenderer] URL not in error cache, creating image result')
        const result = await this.createImageResult(url, `LINE 貼圖 ${validStickerId}`, size, {
          'data-sticker-package': validPackageId,
          'data-sticker-id': validStickerId,
          'data-sticker-type': 'line'
        });
        
        console.log('✅ [StickerRenderer] Created image result for URL:', url)
        this.stickerCache.set(cacheKey, result);
        return result;
      } else {
        console.log('❌ [StickerRenderer] URL is in error cache, skipping:', url)
      }
    }

    // 所有URL都失敗，返回後備方案
    console.log('❌ [StickerRenderer] All URLs failed, creating fallback result')
    const fallback = this.createFallbackResult('LINE 貼圖', size);
    this.stickerCache.set(cacheKey, fallback);
    return fallback;
  }

  /**
   * 生成LINE貼圖URL變體
   */
  private generateLineStickerUrls(packageId: string, stickerId: string): string[] {
    return [
      `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`,
      `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker.png`,
      `https://stickershop.line-scdn.net/products/${packageId}/sticker.png?v=${stickerId}`,
      // 備用CDN
      `https://obs.line-scdn.net/${packageId}/${stickerId}/android/sticker.png`,
      `https://obs.line-scdn.net/${packageId}/${stickerId}/ios/sticker.png`
    ];
  }

  /**
   * 渲染Facebook媒體
   */
  private async renderFacebookMedia(
    metadata: FacebookMediaData, 
    size: keyof typeof STICKER_SIZES
  ): Promise<StickerRenderResult> {
    
    const { url, type } = metadata;
    if (!url) {
      return this.createFallbackResult('Facebook 媒體', size);
    }

    const cacheKey = `fb_${type}_${url}_${size}`;
    const cached = this.stickerCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (type === 'image' && !this.errorCache.has(url)) {
      const result = await this.createImageResult(url, `Facebook ${type}`, size, {
        'data-media-type': type,
        'data-media-source': 'facebook'
      });
      
      this.stickerCache.set(cacheKey, result);
      return result;
    }

    const fallback = this.createFallbackResult(`Facebook ${type}`, size);
    this.stickerCache.set(cacheKey, fallback);
    return fallback;
  }

  /**
   * 渲染通用貼圖
   */
  private async renderGenericSticker(
    metadata: StickerData, 
    size: keyof typeof STICKER_SIZES
  ): Promise<StickerRenderResult> {
    
    // 嘗試從metadata中提取圖片URL
    const possibleUrls = [
      'url' in metadata ? metadata.url : undefined,
      'imageUrl' in metadata ? (metadata as { imageUrl?: unknown }).imageUrl : undefined,
      'originalContentUrl' in metadata ? (metadata as { originalContentUrl?: unknown }).originalContentUrl : undefined,
      'previewImageUrl' in metadata ? (metadata as { previewImageUrl?: unknown }).previewImageUrl : undefined
    ].filter((url): url is string => typeof url === 'string');

    for (const url of possibleUrls) {
      if (typeof url === 'string' && !this.errorCache.has(url)) {
        const result = await this.createImageResult(url, '自定義貼圖', size, {
          'data-media-source': 'generic'
        });
        return result;
      }
    }

    return this.createFallbackResult('貼圖', size);
  }

  /**
   * 創建圖片結果
   */
  private async createImageResult(
    url: string, 
    alt: string, 
    size: keyof typeof STICKER_SIZES,
    dataAttributes: Record<string, string> = {}
  ): Promise<StickerRenderResult> {
    
    console.log('🔍 [StickerRenderer] createImageResult called with:', { url, alt, size, dataAttributes })
    
    const sizeStyle = STICKER_SIZES[size];
    const dataAttrs = Object.entries(dataAttributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');
    
    const content = `
      <img src="${url}" alt="${alt}" class="sticker-image" ${dataAttrs} 
           style="object-fit: contain; border-radius: 8px; opacity: 0; transition: opacity 0.3s ease;" 
           onload="this.style.opacity=1; console.log('✅ Sticker loaded:', '${url}')" 
           onerror="console.log('❌ Sticker failed to load:', '${url}'); this.style.display='none'; this.nextElementSibling.style.display='block';" />
      <div class="sticker-fallback" style="display: none; text-align: center; padding: 8px; background: #f0f0f0; border: 1px dashed #ccc; border-radius: 8px; font-size: 12px; color: #666;">
        <span style="font-size: 16px;">🖼️</span><br>
        [${alt}]
      </div>
    `.trim();
    
    const result = {
      type: 'image' as const,
      content,
      alt,
      className: 'sticker-container',
      style: {
        display: 'inline-block',
        ...sizeStyle,
        margin: '4px'
      }
    };
    
    console.log('🔍 [StickerRenderer] Created image result:', result)
    console.log('🔍 [StickerRenderer] Image HTML content:', content)
    
    return result;
  }

  /**
   * 創建後備顯示結果
   */
  private createFallbackResult(
    label: string, 
    size: keyof typeof STICKER_SIZES
  ): StickerRenderResult {
    
    console.log('🔍 [StickerRenderer] createFallbackResult called with:', { label, size })
    
    const sizeStyle = STICKER_SIZES[size];
    
    const result = {
      type: 'fallback' as const,
      content: `<div class="sticker-fallback" style="display: inline-flex; align-items: center; justify-content: center; flex-direction: column; text-align: center; padding: 8px; background: #f0f0f0; border: 1px dashed #ccc; border-radius: 8px; font-size: 12px; color: #666; ${Object.entries(sizeStyle).map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`).join('; ')}">
        <span style="font-size: 16px; margin-bottom: 4px;">🖼️</span>
        <span>[${label}]</span>
      </div>`,
      alt: label,
      className: 'sticker-container sticker-fallback-container',
      style: {
        display: 'inline-block',
        margin: '4px'
      }
    };
    
    console.log('🔍 [StickerRenderer] Created fallback result:', result)
    
    return result;
  }

  /**
   * 檢測消息是否包含貼圖
   */
  hasStickers(messageType: string, metadata: string | null): boolean {
    if (messageType !== 'sticker' || !metadata) {
      return false;
    }

    try {
      const parsed = JSON.parse(metadata);
      return this.isLineSticker(parsed) || this.isFacebookMedia(parsed);
    } catch {
      return false;
    }
  }

  /**
   * 批量處理多個貼圖
   */
  async processBatchStickers(
    stickers: Array<{ metadata: string | null; messageType: string }>,
    size: keyof typeof STICKER_SIZES = 'medium'
  ): Promise<StickerRenderResult[]> {
    
    const promises = stickers.map(sticker => 
      this.processStickerMetadata(sticker.metadata, sticker.messageType, size)
    );
    
    const results = await Promise.allSettled(promises);
    return results
      .map(result => result.status === 'fulfilled' ? result.value : null)
      .filter(Boolean) as StickerRenderResult[];
  }

  /**
   * 清除緩存
   */
  clearCache() {
    this.stickerCache.clear();
    this.errorCache.clear();
  }

  /**
   * 獲取緩存統計
   */
  getCacheStats() {
    return {
      stickerCacheSize: this.stickerCache.size,
      errorCacheSize: this.errorCache.size,
      cacheEntries: Array.from(this.stickerCache.keys())
    };
  }
}

// 創建全局實例
export const comprehensiveStickerRenderer = new ComprehensiveStickerRenderer();

/**
 * 便捷函數：處理單個貼圖
 */
export async function renderSticker(
  metadata: string | null, 
  messageType: string,
  size: keyof typeof STICKER_SIZES = 'medium'
): Promise<StickerRenderResult | null> {
  return comprehensiveStickerRenderer.processStickerMetadata(metadata, messageType, size);
}

/**
 * 便捷函數：檢測是否包含貼圖
 */
export function hasStickers(messageType: string, metadata: string | null): boolean {
  return comprehensiveStickerRenderer.hasStickers(messageType, metadata);
}