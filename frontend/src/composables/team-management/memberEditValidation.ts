import type {
  MemberEditFormData,
  MemberEditFormErrors,
  MemberEditPasswordErrors,
  MemberEditPasswordFormData,
  PasswordMatchStatus
} from './memberEditTypes'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES: MemberEditFormData['role'][] = ['admin', 'agent']

export function isMemberEditFormValid(formData: MemberEditFormData): boolean {
  return Object.keys(validateMemberEditForm(formData)).length === 0
}

export function validateMemberEditForm(formData: MemberEditFormData): MemberEditFormErrors {
  const errors: MemberEditFormErrors = {}

  if (!formData.displayName.trim()) {
    errors.displayName = '請輸入姓名'
  } else if (formData.displayName.length > 100) {
    errors.displayName = '姓名不能超過 100 個字元'
  }

  if (!formData.email.trim()) {
    errors.email = '請輸入電子郵件'
  } else if (!EMAIL_REGEX.test(formData.email)) {
    errors.email = '請輸入有效的電子郵件格式'
  }

  if (!formData.role || !VALID_ROLES.includes(formData.role)) {
    errors.role = '請選擇角色'
  }

  return errors
}

export function isMemberEditPasswordFormValid(
  passwordForm: MemberEditPasswordFormData
): boolean {
  return Object.keys(validateMemberEditPasswordForm(passwordForm)).length === 0
}

export function validateMemberEditPasswordForm(
  passwordForm: MemberEditPasswordFormData
): MemberEditPasswordErrors {
  const errors: MemberEditPasswordErrors = {}

  if (!passwordForm.newPassword) {
    errors.newPassword = '請輸入新密碼'
  } else if (passwordForm.newPassword.length < 6) {
    errors.newPassword = '密碼至少需要 6 個字元'
  }

  if (!passwordForm.confirmPassword) {
    errors.confirmPassword = '請確認密碼'
  } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    errors.confirmPassword = '密碼不一致'
  }

  return errors
}

export function getPasswordMatchStatus(
  passwordForm: MemberEditPasswordFormData
): PasswordMatchStatus {
  if (passwordForm.newPassword.length === 0) {
    return 'idle'
  }

  return passwordForm.newPassword === passwordForm.confirmPassword ? 'match' : 'mismatch'
}
