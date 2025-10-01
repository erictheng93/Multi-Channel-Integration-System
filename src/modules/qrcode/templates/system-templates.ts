// QR Code 系統內建模板
// 提供預定義的 QR Code 模板，方便用戶快速創建常用類型的 QR Code

import type { QRCodeType } from '@modules/qrcode/types/qrcode-types';

/**
 * QR Code 模板接口
 */
export interface QRCodeTemplate {
  id: string;
  name: string;
  description: string;
  category: 'url' | 'text' | 'vcard' | 'wifi' | 'email' | 'phone' | 'sms' | 'custom';

  // QR Code 配置
  type: QRCodeType;
  size: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  outputFormat: 'png' | 'svg' | 'jpeg' | 'webp';

  // 樣式配置
  foregroundColor: string;
  backgroundColor: string;
  logoUrl?: string;
  borderWidth: number;

  // 預設內容範本（帶佔位符）
  contentTemplate: string;
  contentPlaceholders: string[];

  // 元數據
  isPublic: boolean;
  isSystem: boolean;
  teamId?: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;

  // 統計
  usageCount: number;
}

/**
 * 系統內建模板列表
 * 這些模板總是可用，無需數據庫存儲
 */
export const SYSTEM_TEMPLATES: QRCodeTemplate[] = [
  // 1. 公司名片 (vCard)
  {
    id: 'sys-vcard-business',
    name: '公司名片',
    description: 'vCard 格式的公司聯絡資訊，掃描後可直接加入通訊錄',
    category: 'vcard',
    type: 'contact',
    size: 300,
    errorCorrectionLevel: 'M',
    outputFormat: 'png',
    foregroundColor: '#000000',
    backgroundColor: '#FFFFFF',
    borderWidth: 20,
    contentTemplate: `BEGIN:VCARD
VERSION:3.0
FN:{{fullName}}
ORG:{{companyName}}
TITLE:{{jobTitle}}
TEL;TYPE=WORK,VOICE:{{phoneNumber}}
TEL;TYPE=CELL:{{mobileNumber}}
EMAIL;TYPE=WORK:{{email}}
URL:{{website}}
ADR;TYPE=WORK:;;{{address}};;;;
END:VCARD`,
    contentPlaceholders: ['fullName', 'companyName', 'jobTitle', 'phoneNumber', 'mobileNumber', 'email', 'website', 'address'],
    isPublic: true,
    isSystem: true,
    createdBy: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    usageCount: 0
  },

  // 2. WiFi 連線
  {
    id: 'sys-wifi-connect',
    name: 'WiFi 快速連接',
    description: 'WiFi 網路設定，掃描後可快速連接到指定 WiFi',
    category: 'wifi',
    type: 'wifi',
    size: 300,
    errorCorrectionLevel: 'H', // 高容錯，適合列印
    outputFormat: 'png',
    foregroundColor: '#1E40AF', // 藍色
    backgroundColor: '#FFFFFF',
    borderWidth: 15,
    contentTemplate: 'WIFI:T:{{encryption}};S:{{ssid}};P:{{password}};H:{{hidden}};;',
    contentPlaceholders: ['encryption', 'ssid', 'password', 'hidden'],
    isPublic: true,
    isSystem: true,
    createdBy: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    usageCount: 0
  },

  // 3. 社交媒體連結
  {
    id: 'sys-social-links',
    name: '社交媒體集合',
    description: '社交平台連結頁面，一次展示所有社交帳號',
    category: 'url',
    type: 'url',
    size: 350,
    errorCorrectionLevel: 'M',
    outputFormat: 'png',
    foregroundColor: '#DC2626', // 紅色
    backgroundColor: '#FFFFFF',
    borderWidth: 10,
    contentTemplate: '{{linkPageUrl}}',
    contentPlaceholders: ['linkPageUrl'],
    isPublic: true,
    isSystem: true,
    createdBy: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    usageCount: 0
  },

  // 4. 產品資訊
  {
    id: 'sys-product-info',
    name: '產品資訊頁',
    description: '產品詳情頁面連結，適合產品包裝和展示',
    category: 'url',
    type: 'url',
    size: 300,
    errorCorrectionLevel: 'M',
    outputFormat: 'png',
    foregroundColor: '#059669', // 綠色
    backgroundColor: '#FFFFFF',
    borderWidth: 15,
    contentTemplate: '{{productUrl}}?ref=qrcode',
    contentPlaceholders: ['productUrl'],
    isPublic: true,
    isSystem: true,
    createdBy: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    usageCount: 0
  },

  // 5. 活動報名
  {
    id: 'sys-event-registration',
    name: '活動報名',
    description: '活動資訊和報名連結，適合活動宣傳',
    category: 'url',
    type: 'url',
    size: 350,
    errorCorrectionLevel: 'M',
    outputFormat: 'png',
    foregroundColor: '#7C3AED', // 紫色
    backgroundColor: '#FFFFFF',
    borderWidth: 20,
    contentTemplate: '{{eventUrl}}?utm_source=qrcode&utm_campaign={{eventName}}',
    contentPlaceholders: ['eventUrl', 'eventName'],
    isPublic: true,
    isSystem: true,
    createdBy: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    usageCount: 0
  },

  // 6. 電子郵件
  {
    id: 'sys-email-contact',
    name: '電子郵件聯絡',
    description: '預填電子郵件地址和主旨，掃描後可直接發送郵件',
    category: 'email',
    type: 'email',
    size: 300,
    errorCorrectionLevel: 'M',
    outputFormat: 'png',
    foregroundColor: '#EA580C', // 橘色
    backgroundColor: '#FFFFFF',
    borderWidth: 10,
    contentTemplate: 'mailto:{{email}}?subject={{subject}}&body={{body}}',
    contentPlaceholders: ['email', 'subject', 'body'],
    isPublic: true,
    isSystem: true,
    createdBy: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    usageCount: 0
  },

  // 7. 電話撥號
  {
    id: 'sys-phone-call',
    name: '快速撥號',
    description: '電話號碼直接撥號，掃描後可立即撥打電話',
    category: 'phone',
    type: 'phone',
    size: 300,
    errorCorrectionLevel: 'L',
    outputFormat: 'png',
    foregroundColor: '#0891B2', // 青色
    backgroundColor: '#FFFFFF',
    borderWidth: 15,
    contentTemplate: 'tel:{{phoneNumber}}',
    contentPlaceholders: ['phoneNumber'],
    isPublic: true,
    isSystem: true,
    createdBy: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    usageCount: 0
  },

  // 8. SMS 簡訊
  {
    id: 'sys-sms-message',
    name: 'SMS 簡訊',
    description: '預填 SMS 內容，掃描後可直接發送簡訊',
    category: 'sms',
    type: 'sms',
    size: 300,
    errorCorrectionLevel: 'M',
    outputFormat: 'png',
    foregroundColor: '#16A34A', // 綠色
    backgroundColor: '#FFFFFF',
    borderWidth: 10,
    contentTemplate: 'sms:{{phoneNumber}}?body={{message}}',
    contentPlaceholders: ['phoneNumber', 'message'],
    isPublic: true,
    isSystem: true,
    createdBy: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    usageCount: 0
  }
];

/**
 * 根據 ID 獲取模板
 */
export function getTemplateById(templateId: string): QRCodeTemplate | undefined {
  return SYSTEM_TEMPLATES.find(t => t.id === templateId);
}

/**
 * 根據類別獲取模板
 */
export function getTemplatesByCategory(category: QRCodeTemplate['category']): QRCodeTemplate[] {
  return SYSTEM_TEMPLATES.filter(t => t.category === category);
}

/**
 * 獲取所有模板類別
 */
export function getAllCategories(): string[] {
  return Array.from(new Set(SYSTEM_TEMPLATES.map(t => t.category)));
}

/**
 * 搜尋模板
 */
export function searchTemplates(query: string): QRCodeTemplate[] {
  const lowerQuery = query.toLowerCase();
  return SYSTEM_TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.category.toLowerCase().includes(lowerQuery)
  );
}

/**
 * 替換模板佔位符
 */
export function replacePlaceholders(
  template: string,
  placeholders: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(placeholders)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * 驗證佔位符是否完整
 */
export function validatePlaceholders(
  template: QRCodeTemplate,
  providedPlaceholders: Record<string, string>
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const placeholder of template.contentPlaceholders) {
    if (!providedPlaceholders[placeholder] || providedPlaceholders[placeholder].trim() === '') {
      missing.push(placeholder);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}