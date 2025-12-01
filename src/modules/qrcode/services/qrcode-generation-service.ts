// QRCode 生成服務
// 負責生成各種類型和格式的 QR Code

import type {
  QRCodeType,
  QRCodeGenerationOptions,
  QRCodeErrorCorrectionLevel,
  QRCodeOutputFormat
} from '../types/qrcode-types';

// ======================== QR Code 內容處理器 ========================

/**
 * 處理不同類型 QR Code 內容的格式化
 */
export class QRCodeContentProcessor {
  /**
   * 處理 URL 類型
   */
  static processUrlContent(content: string): string {
    // 確保 URL 有協議前綴
    if (!content.match(/^https?:\/\//)) {
      return `https://${content}`;
    }
    return content;
  }

  /**
   * 處理聯絡人類型 (vCard 格式)
   */
  static processContactContent(contact: {
    name?: string;
    phone?: string;
    email?: string;
    organization?: string;
    url?: string;
  }): string {
    const vCard = [
      'BEGIN:VCARD',
      'VERSION:3.0'
    ];

    if (contact.name) vCard.push(`FN:${contact.name}`);
    if (contact.phone) vCard.push(`TEL:${contact.phone}`);
    if (contact.email) vCard.push(`EMAIL:${contact.email}`);
    if (contact.organization) vCard.push(`ORG:${contact.organization}`);
    if (contact.url) vCard.push(`URL:${contact.url}`);

    vCard.push('END:VCARD');
    return vCard.join('\\n');
  }

  /**
   * 處理 WiFi 類型
   */
  static processWifiContent(wifi: {
    ssid: string;
    password?: string;
    security?: 'WPA' | 'WEP' | 'nopass';
    hidden?: boolean;
  }): string {
    const { ssid, password = '', security = 'WPA', hidden = false } = wifi;
    return `WIFI:T:${security};S:${ssid};P:${password};H:${hidden ? 'true' : 'false'};;`;
  }

  /**
   * 處理 SMS 類型
   */
  static processSmsContent(sms: {
    phone: string;
    message?: string;
  }): string {
    const { phone, message = '' } = sms;
    return `sms:${phone}${message ? `?body=${encodeURIComponent(message)}` : ''}`;
  }

  /**
   * 處理電子郵件類型
   */
  static processEmailContent(email: {
    to: string;
    subject?: string;
    body?: string;
  }): string {
    const { to, subject = '', body = '' } = email;
    const params: string[] = [];
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);

    return `mailto:${to}${params.length > 0 ? `?${params.join('&')}` : ''}`;
  }

  /**
   * 處理電話類型
   */
  static processPhoneContent(phone: string): string {
    return `tel:${phone}`;
  }

  /**
   * 處理事件類型 (iCal 格式)
   */
  static processEventContent(event: {
    title: string;
    startDate: string;
    endDate?: string;
    location?: string;
    description?: string;
  }): string {
    const { title, startDate, endDate, location, description } = event;

    const lines = [
      'BEGIN:VEVENT',
      `SUMMARY:${title}`,
      `DTSTART:${startDate}`,
    ];

    if (endDate) lines.push(`DTEND:${endDate}`);
    if (location) lines.push(`LOCATION:${location}`);
    if (description) lines.push(`DESCRIPTION:${description}`);

    lines.push('END:VEVENT');
    return lines.join('\\n');
  }

  /**
   * 處理地理位置類型
   */
  static processLocationContent(location: {
    lat: number;
    lng: number;
    query?: string;
  }): string {
    const { lat, lng, query } = location;
    if (query) {
      return `geo:${lat},${lng}?q=${encodeURIComponent(query)}`;
    }
    return `geo:${lat},${lng}`;
  }

  /**
   * 統一內容處理入口
   */
  static processContent(type: QRCodeType, content: string | object): string {
    if (typeof content === 'string') {
      switch (type) {
        case 'url':
        case 'app':
        case 'social':
          return this.processUrlContent(content);
        case 'phone':
          return this.processPhoneContent(content);
        case 'text':
          return content;
        default:
          throw new Error(`Unsupported QR code type: ${type}`);
      }
    }

    // 處理物件類型的內容
    switch (type) {
      case 'contact':
        return this.processContactContent(content as any);
      case 'wifi':
        return this.processWifiContent(content as any);
      case 'sms':
        return this.processSmsContent(content as any);
      case 'email':
        return this.processEmailContent(content as any);
      case 'event':
        return this.processEventContent(content as any);
      case 'location':
        return this.processLocationContent(content as any);
      default:
        throw new Error(`Unsupported QR code type: ${type}`);
    }
  }
}

// ======================== QR Code 生成引擎 ========================

/**
 * QR Code 生成引擎
 * 使用不同的生成策略來創建 QR Code
 */
export class QRCodeGenerationEngine {
  /**
   * 生成 QR Code (基於瀏覽器 API - 模擬)
   * 實際實作時應使用 qrcode 或類似的庫
   */
  static async generateQRCode(
    content: string,
    options: QRCodeGenerationOptions
  ): Promise<string> {
    const {
      size,
      errorCorrectionLevel,
      outputFormat,
      foregroundColor,
      backgroundColor,
      logoUrl,
      borderWidth,
      includeMargin = true
    } = options;

    try {
      // 模擬 QR Code 生成過程
      // 在實際實作中，這裡會使用真實的 QR Code 生成庫

      // 1. 驗證內容長度
      if (content.length > 4296) {
        throw new Error('Content too long for QR code');
      }

      // 2. 驗證參數
      this.validateGenerationOptions(options);

      // 3. 生成基本 QR Code 矩陣
      const qrMatrix = this.generateQRMatrix(content, errorCorrectionLevel);

      // 4. 應用樣式設定
      const styledQRCode = this.applyStyles(qrMatrix, {
        size,
        foregroundColor,
        backgroundColor,
        borderWidth: borderWidth ?? 0,
        includeMargin
      });

      // 5. 添加 Logo (如果有)
      let finalQRCode = styledQRCode;
      if (logoUrl) {
        finalQRCode = await this.addLogo(styledQRCode, logoUrl);
      }

      // 6. 轉換為指定格式
      return await this.convertToFormat(finalQRCode, outputFormat);

    } catch (error) {
      console.error('QR code generation failed:', error);
      throw new Error(`QR code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 驗證生成選項
   */
  private static validateGenerationOptions(options: QRCodeGenerationOptions): void {
    const { size, errorCorrectionLevel, outputFormat, foregroundColor, backgroundColor } = options;

    if (size < 100 || size > 2000) {
      throw new Error('QR code size must be between 100 and 2000 pixels');
    }

    if (!['L', 'M', 'Q', 'H'].includes(errorCorrectionLevel)) {
      throw new Error('Invalid error correction level');
    }

    if (!['png', 'jpg', 'svg', 'pdf', 'base64'].includes(outputFormat)) {
      throw new Error('Invalid output format');
    }

    if (!this.isValidHexColor(foregroundColor) || !this.isValidHexColor(backgroundColor)) {
      throw new Error('Invalid color format');
    }
  }

  /**
   * 驗證十六進制顏色格式
   */
  private static isValidHexColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  /**
   * 生成 QR Code 矩陣 (模擬)
   * 實際實作時會使用真實的 QR Code 演算法
   */
  private static generateQRMatrix(content: string, errorCorrectionLevel: QRCodeErrorCorrectionLevel): number[][] {
    // 模擬生成 QR Code 矩陣
    // 實際實作時會使用 Reed-Solomon 錯誤修正和 QR Code 規範

    const size = this.calculateMatrixSize(content.length, errorCorrectionLevel);
    const matrix: number[][] = [];

    // 創建空矩陣
    for (let i = 0; i < size; i++) {
      matrix[i] = new Array(size).fill(0);
    }

    // 模擬填充 QR Code 數據
    // 實際實作會包含尋找圖樣、對齊圖樣、時序圖樣等
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        // 簡單的模擬邏輯 - 實際會更複雜
        matrix[i][j] = (i + j + content.charCodeAt((i + j) % content.length)) % 2;
      }
    }

    return matrix;
  }

  /**
   * 計算矩陣大小
   */
  private static calculateMatrixSize(contentLength: number, errorCorrectionLevel: QRCodeErrorCorrectionLevel): number {
    // 簡化的大小計算邏輯
    // 實際實作會根據 QR Code 版本和錯誤修正等級來計算
    let baseSize = 21; // QR Code version 1 的基本大小

    // 根據內容長度調整版本
    if (contentLength > 25) baseSize = 25;
    if (contentLength > 47) baseSize = 29;
    if (contentLength > 77) baseSize = 33;
    // ... 更多版本

    return baseSize;
  }

  /**
   * 應用樣式設定
   */
  private static applyStyles(
    matrix: number[][],
    styles: {
      size: number;
      foregroundColor: string;
      backgroundColor: string;
      borderWidth: number;
      includeMargin: boolean;
    }
  ): string {
    const { size, foregroundColor, backgroundColor, borderWidth, includeMargin } = styles;
    const matrixSize = matrix.length;
    const margin = includeMargin ? 4 : 0;
    const totalSize = size + (borderWidth * 2);
    const cellSize = (size - (margin * 2)) / matrixSize;

    // 生成 SVG 格式的 QR Code
    const svg = [
      `<svg width="${totalSize}" height="${totalSize}" xmlns="http://www.w3.org/2000/svg">`,
      `<rect width="${totalSize}" height="${totalSize}" fill="${backgroundColor}"/>`,
    ];

    // 如果有邊框
    if (borderWidth > 0) {
      svg.push(`<rect x="0" y="0" width="${totalSize}" height="${borderWidth}" fill="${foregroundColor}"/>`);
      svg.push(`<rect x="0" y="0" width="${borderWidth}" height="${totalSize}" fill="${foregroundColor}"/>`);
      svg.push(`<rect x="${totalSize - borderWidth}" y="0" width="${borderWidth}" height="${totalSize}" fill="${foregroundColor}"/>`);
      svg.push(`<rect x="0" y="${totalSize - borderWidth}" width="${totalSize}" height="${borderWidth}" fill="${foregroundColor}"/>`);
    }

    // 繪製 QR Code 矩陣
    for (let i = 0; i < matrixSize; i++) {
      for (let j = 0; j < matrixSize; j++) {
        if (matrix[i][j] === 1) {
          const x = borderWidth + margin + (j * cellSize);
          const y = borderWidth + margin + (i * cellSize);
          svg.push(`<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${foregroundColor}"/>`);
        }
      }
    }

    svg.push('</svg>');
    return svg.join('');
  }

  /**
   * 添加 Logo
   */
  private static async addLogo(svgQRCode: string, logoUrl: string): Promise<string> {
    try {
      // 在實際實作中，這裡會：
      // 1. 下載 logo 圖片
      // 2. 調整大小 (通常是 QR Code 大小的 10-20%)
      // 3. 將 logo 嵌入到 SVG 中心位置
      // 4. 確保不影響 QR Code 的可讀性

      // 模擬添加 logo
      const logoSize = 40; // 固定 logo 大小，實際會根據 QR Code 大小調整
      const svgParts = svgQRCode.split('</svg>');
      const logoElement = `<image x="50%" y="50%" width="${logoSize}" height="${logoSize}" href="${logoUrl}" style="transform: translate(-50%, -50%)"/>`;

      return svgParts[0] + logoElement + '</svg>';
    } catch (error) {
      console.warn('Failed to add logo to QR code:', error);
      return svgQRCode; // 如果添加 logo 失敗，返回原始 QR Code
    }
  }

  /**
   * 轉換為指定格式
   */
  private static async convertToFormat(svgContent: string, format: QRCodeOutputFormat): Promise<string> {
    switch (format) {
      case 'svg':
        return svgContent;

      case 'base64':
        // 轉換為 base64 編碼的 SVG
        return `data:image/svg+xml;base64,${btoa(svgContent)}`;

      case 'png':
      case 'jpg':
        // 在實際實作中，會使用 Canvas API 或圖片處理庫
        // 將 SVG 轉換為點陣圖格式
        return this.svgToRaster(svgContent, format);

      case 'pdf':
        // 在實際實作中，會使用 PDF 生成庫
        return this.svgToPdf(svgContent);

      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }

  /**
   * SVG 轉點陣圖 (模擬)
   */
  private static async svgToRaster(svgContent: string, format: 'png' | 'jpg'): Promise<string> {
    // 模擬轉換過程
    // 實際實作會使用 Canvas API 或 sharp 等圖片處理庫

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const mockImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    return `data:${mimeType};base64,${mockImageData}`;
  }

  /**
   * SVG 轉 PDF (模擬)
   */
  private static async svgToPdf(svgContent: string): Promise<string> {
    // 模擬轉換過程
    // 實際實作會使用 PDFKit 或類似的 PDF 生成庫

    const mockPdfData = 'JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL091dGxpbmVzIDIgMCBSCi9QYWdlcyAzIDAgUgo+PgplbmRvYmoK';

    return `data:application/pdf;base64,${mockPdfData}`;
  }
}

// ======================== QR Code 生成服務 ========================

/**
 * QR Code 生成服務主類
 */
export class QRCodeGenerationService {
  /**
   * 生成 QR Code
   */
  static async generate(
    type: QRCodeType,
    content: string | object,
    options: Partial<QRCodeGenerationOptions> = {}
  ): Promise<string> {
    // 處理內容
    const processedContent = QRCodeContentProcessor.processContent(type, content);

    // 合併預設選項
    const generationOptions: QRCodeGenerationOptions = {
      size: 300,
      errorCorrectionLevel: 'M',
      outputFormat: 'png',
      foregroundColor: '#000000',
      backgroundColor: '#FFFFFF',
      borderWidth: 0,
      includeMargin: true,
      ...options
    };

    // 生成 QR Code
    return await QRCodeGenerationEngine.generateQRCode(processedContent, generationOptions);
  }

  /**
   * 批次生成 QR Codes
   */
  static async batchGenerate(
    requests: Array<{
      type: QRCodeType;
      content: string | object;
      options?: Partial<QRCodeGenerationOptions>;
    }>
  ): Promise<Array<{ success: boolean; data?: string; error?: string }>> {
    const results = await Promise.allSettled(
      requests.map(request => this.generate(request.type, request.content, request.options))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return { success: true, data: result.value };
      } else {
        return { success: false, error: result.reason?.message || 'Unknown error' };
      }
    });
  }

  /**
   * 驗證 QR Code 內容
   */
  static validateContent(type: QRCodeType, content: string | object): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      // 嘗試處理內容
      QRCodeContentProcessor.processContent(type, content);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Content validation failed');
    }

    // 類型特定驗證
    switch (type) {
      case 'url':
      case 'app':
      case 'social':
        if (typeof content === 'string') {
          if (!this.isValidUrl(content)) {
            errors.push('Invalid URL format');
          }
        }
        break;

      case 'email':
        if (typeof content === 'object' && content && 'to' in content) {
          if (!this.isValidEmail((content as any).to)) {
            errors.push('Invalid email address');
          }
        }
        break;

      case 'phone':
        if (typeof content === 'string') {
          if (!this.isValidPhoneNumber(content)) {
            errors.push('Invalid phone number format');
          }
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 驗證 URL 格式
   */
  private static isValidUrl(url: string): boolean {
    try {
      const urlToTest = url.startsWith('http') ? url : `https://${url}`;
      const parsed = new URL(urlToTest);
      // 確保 URL 有有效的主機名稱
      return parsed.hostname.includes('.') || parsed.hostname === 'localhost';
    } catch {
      return false;
    }
  }

  /**
   * 驗證電子郵件格式
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 驗證電話號碼格式
   */
  private static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * 估算 QR Code 容量
   */
  static estimateCapacity(
    errorCorrectionLevel: QRCodeErrorCorrectionLevel,
    dataType: 'numeric' | 'alphanumeric' | 'byte' | 'kanji' = 'byte'
  ): { version: number; capacity: number }[] {
    // QR Code 容量表 (簡化版本)
    const capacityTable = {
      L: { // Low (~7%)
        numeric: [41, 77, 127, 187, 255, 322, 370, 461, 552, 652],
        alphanumeric: [25, 47, 77, 114, 154, 195, 224, 279, 335, 395],
        byte: [17, 32, 53, 78, 106, 134, 154, 192, 230, 271],
        kanji: [10, 20, 32, 48, 65, 82, 95, 118, 141, 167]
      },
      M: { // Medium (~15%)
        numeric: [34, 63, 101, 149, 202, 255, 293, 365, 432, 513],
        alphanumeric: [20, 38, 61, 90, 122, 154, 178, 221, 262, 311],
        byte: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
        kanji: [8, 16, 26, 38, 52, 65, 75, 93, 111, 131]
      },
      Q: { // Quartile (~25%)
        numeric: [27, 48, 77, 111, 144, 178, 207, 259, 312, 364],
        alphanumeric: [16, 29, 47, 67, 87, 108, 125, 157, 189, 221],
        byte: [11, 20, 32, 46, 60, 74, 86, 108, 130, 151],
        kanji: [7, 12, 20, 28, 37, 45, 53, 66, 80, 93]
      },
      H: { // High (~30%)
        numeric: [17, 34, 58, 82, 106, 139, 154, 202, 235, 288],
        alphanumeric: [10, 20, 35, 50, 64, 84, 93, 122, 143, 174],
        byte: [7, 14, 24, 34, 44, 58, 64, 84, 98, 119],
        kanji: [4, 8, 15, 21, 27, 36, 39, 52, 60, 74]
      }
    };

    const capacities = capacityTable[errorCorrectionLevel][dataType];
    return capacities.map((capacity, index) => ({
      version: index + 1,
      capacity
    }));
  }
}