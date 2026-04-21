import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('systemSettingsDiagnostic')
// SystemSettings 語言設定診斷工具 - 暫時停用
// 此文件暫時註釋以避免 TypeScript 錯誤

interface DiagnosticResult {
  step: string
  status: 'success' | 'error' | 'warning'
  message: string
  details?: unknown
}

export const runSystemSettingsDiagnostic = (): DiagnosticResult[] => {
  frontendLogger.debug('SystemSettingsDiagnostic is temporarily disabled')
  return []
}

export default {
  runSystemSettingsDiagnostic
}