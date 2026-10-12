/**
 * Client-side checks for the LOGIN form.
 *
 * Password composition rules (length, upper/lower case, digits) belong to the screens where a
 * password is created or changed. Applied at login they only lock out people whose password
 * was set under another policy or elsewhere: the server accepts it, but the submit button
 * stayed disabled and no message explained why. The server is the authority on whether the
 * credentials are right, so the form only requires that something was entered.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateLoginEmail(value: string | null | undefined): string | null {
  if (!value || value === '') {
    return '請輸入電子郵件'
  }
  if (!EMAIL_PATTERN.test(value)) {
    return '請輸入有效的電子郵件格式'
  }
  return null
}

export function validateLoginPassword(value: string | null | undefined): string | null {
  if (!value || value === '') {
    return '請輸入密碼'
  }
  return null
}
