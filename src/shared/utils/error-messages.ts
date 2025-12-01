/**
 * Re-export from main utils to avoid code duplication
 * @deprecated Import directly from '@/utils/error-messages' for new code
 */
export {
  ERROR_MESSAGES,
  getErrorMessage,
  expectErrorMessage,
  ENGLISH_TO_CHINESE_ERROR_MAP,
  translateErrorMessage
} from '../../utils/error-messages';

export type { ErrorMessageKey } from '../../utils/error-messages';
