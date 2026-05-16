// Delayed Message Module - Validation Service
// 延遲訊息模組 - 驗證服務

import type {
  DelayedMessageRequest,
  DelayedMessageEntity,
  RecallInfo,
  ValidationRule,
  ValidationResult
} from '../types';
import { ValidationError } from '@modules/delayed-message/types';

/**
 * ValidationService - 統一驗證服務
 *
 * 職責：
 * - 統一所有業務規則驗證
 * - 提供可擴展的驗證規則框架
 * - 規範化驗證錯誤處理
 * - 支援複合驗證規則
 */
export class ValidationService {
  private rules = new Map<string, ValidationRule<unknown>>();

  constructor() {
    this.registerDefaultRules();
  }

  /**
   * 驗證延遲訊息請求
   */
  validateDelayedMessageRequest(request: DelayedMessageRequest): ValidationResult {
    const errors: string[] = [];

    // 基本必填欄位驗證
    if (!request.conversationId?.trim()) {
      errors.push('Conversation ID is required');
    }

    if (!request.content?.trim()) {
      errors.push('Message content is required');
    }

    if (!request.senderId?.trim()) {
      errors.push('Sender ID is required');
    }

    if (!request.recipientPlatformId?.trim()) {
      errors.push('Recipient platform ID is required');
    }

    if (!request.platform) {
      errors.push('Platform is required');
    }

    // 延遲時間驗證
    const delayValidation = this.validateDelaySeconds(request.delaySeconds);
    if (!delayValidation.isValid) {
      errors.push(...delayValidation.errors);
    }

    // 平台驗證
    const platformValidation = this.validatePlatform(request.platform);
    if (!platformValidation.isValid) {
      errors.push(...platformValidation.errors);
    }

    // 訊息類型驗證
    if (request.messageType) {
      const messageTypeValidation = this.validateMessageType(request.messageType);
      if (!messageTypeValidation.isValid) {
        errors.push(...messageTypeValidation.errors);
      }
    }

    // 內容長度驗證
    const contentValidation = this.validateMessageContent(request.content);
    if (!contentValidation.isValid) {
      errors.push(...contentValidation.errors);
    }

    // 媒體URL驗證（如果提供）
    if (request.mediaUrl) {
      const urlValidation = this.validateMediaUrl(request.mediaUrl);
      if (!urlValidation.isValid) {
        errors.push(...urlValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 驗證延遲秒數 (1-120秒)
   */
  validateDelaySeconds(delaySeconds: number): ValidationResult {
    const errors: string[] = [];

    if (typeof delaySeconds !== 'number' || isNaN(delaySeconds)) {
      errors.push('Delay seconds must be a valid number');
    } else if (delaySeconds < 1) {
      errors.push('Delay seconds must be at least 1 second');
    } else if (delaySeconds > 120) {
      errors.push('Delay seconds cannot exceed 120 seconds');
    } else if (!Number.isInteger(delaySeconds)) {
      errors.push('Delay seconds must be an integer');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 驗證平台類型
   */
  validatePlatform(platform: string): ValidationResult {
    const validPlatforms = ['line', 'facebook'];
    const errors: string[] = [];

    if (!validPlatforms.includes(platform)) {
      errors.push(`Platform must be one of: ${validPlatforms.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 驗證訊息類型
   */
  validateMessageType(messageType: string): ValidationResult {
    const validTypes = ['text', 'image', 'video', 'audio', 'file'];
    const errors: string[] = [];

    if (!validTypes.includes(messageType)) {
      errors.push(`Message type must be one of: ${validTypes.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 驗證訊息內容
   */
  validateMessageContent(content: string): ValidationResult {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push('Message content cannot be empty');
    } else if (content.length > 5000) {
      errors.push('Message content cannot exceed 5000 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 驗證媒體URL
   */
  validateMediaUrl(mediaUrl: string): ValidationResult {
    const errors: string[] = [];

    try {
      new URL(mediaUrl);

      // 檢查URL協議
      if (!mediaUrl.startsWith('https://')) {
        errors.push('Media URL must use HTTPS protocol');
      }
    } catch {
      errors.push('Invalid media URL format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 驗證撤回權限
   */
  validateRecallPermission(messageId: string, userId: string, recallInfo: RecallInfo | null): ValidationResult {
    const errors: string[] = [];

    if (!messageId?.trim()) {
      errors.push('Message ID is required');
    }

    if (!userId?.trim()) {
      errors.push('User ID is required');
    }

    if (!recallInfo) {
      errors.push('Message not found or already processed');
      return { isValid: false, errors };
    }

    // 檢查權限
    if (recallInfo.senderId !== userId) {
      errors.push('Permission denied: only the sender can recall the message');
    }

    // 檢查時間限制
    const now = new Date();
    const deadline = new Date(recallInfo.expiresAt);

    if (now > deadline) {
      errors.push('Recall deadline has passed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 驗證訊息實體
   */
  validateDelayedMessageEntity(entity: DelayedMessageEntity): ValidationResult {
    const errors: string[] = [];

    // 基本欄位驗證
    if (!entity.id?.trim()) {
      errors.push('Message ID is required');
    }

    if (!entity.conversationId?.trim()) {
      errors.push('Conversation ID is required');
    }

    if (!entity.agentId?.trim()) {
      errors.push('Agent ID is required');
    }

    if (!entity.content?.trim()) {
      errors.push('Content is required');
    }

    // 狀態驗證
    const validStatuses = ['pending', 'sent', 'cancelled', 'failed'];
    if (!validStatuses.includes(entity.status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    // 時間驗證
    try {
      new Date(entity.scheduledAt);
    } catch {
      errors.push('Invalid scheduled time format');
    }

    try {
      new Date(entity.createdAt);
    } catch {
      errors.push('Invalid created time format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 註冊自定義驗證規則
   */
  registerRule<T>(name: string, rule: ValidationRule<T>): void {
    this.rules.set(name, rule);
  }

  /**
   * 執行自定義驗證規則
   */
  executeRule<T>(ruleName: string, value: T): ValidationResult {
    const rule = this.rules.get(ruleName);
    if (!rule) {
      throw new ValidationError(`Unknown validation rule: ${ruleName}`, 'rule');
    }

    return rule.validate(value);
  }

  /**
   * 批量驗證
   */
  validateBatch(validations: Array<{ name: string; value: unknown; rule?: string }>): ValidationResult {
    const allErrors: string[] = [];

    for (const validation of validations) {
      let result: ValidationResult;

      if (validation.rule) {
        result = this.executeRule(validation.rule, validation.value);
      } else {
        // 嘗試根據名稱匹配預設驗證方法
        const methodName = `validate${validation.name.charAt(0).toUpperCase()}${validation.name.slice(1)}`;
        const method = (this as Record<string, unknown>)[methodName];

        if (typeof method === 'function') {
          result = method.call(this, validation.value);
        } else {
          result = { isValid: false, errors: [`No validation method found for ${validation.name}`] };
        }
      }

      if (!result.isValid) {
        allErrors.push(...result.errors.map(error => `${validation.name}: ${error}`));
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }

  /**
   * 建立驗證錯誤
   */
  createValidationError(message: string, field: string, details?: Record<string, unknown>): ValidationError {
    return new ValidationError(message, field, details);
  }

  /**
   * 註冊預設驗證規則
   */
  private registerDefaultRules(): void {
    // UUID 驗證規則
    this.registerRule('uuid', {
      validate: (value: string): ValidationResult => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return {
          isValid: uuidRegex.test(value),
          errors: uuidRegex.test(value) ? [] : ['Invalid UUID format']
        };
      }
    });

    // 電子郵件驗證規則
    this.registerRule('email', {
      validate: (value: string): ValidationResult => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return {
          isValid: emailRegex.test(value),
          errors: emailRegex.test(value) ? [] : ['Invalid email format']
        };
      }
    });

    // 非空字串驗證規則
    this.registerRule('nonEmptyString', {
      validate: (value: string): ValidationResult => {
        const isValid = typeof value === 'string' && value.trim().length > 0;
        return {
          isValid,
          errors: isValid ? [] : ['Value cannot be empty']
        };
      }
    });

    // 正整數驗證規則
    this.registerRule('positiveInteger', {
      validate: (value: number): ValidationResult => {
        const isValid = typeof value === 'number' && Number.isInteger(value) && value > 0;
        return {
          isValid,
          errors: isValid ? [] : ['Value must be a positive integer']
        };
      }
    });
  }
}

// 導出自定義錯誤類別
export { ValidationError } from '../types';
