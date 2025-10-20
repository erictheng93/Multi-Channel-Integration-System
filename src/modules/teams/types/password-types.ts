// Password Management Types
// 密碼管理相關類型定義

export interface ResetPasswordRequest {
  newPassword: string;
  reason?: string;
}

export interface ResetPasswordWithPolicyRequest {
  newPassword: string;
  requireChange?: boolean;
  expiryDays?: number;
  reason?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expiryDays?: number;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}
