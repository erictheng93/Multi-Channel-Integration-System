/**
 * Re-export from main utils to avoid code duplication
 * @deprecated Import directly from '@/utils/api-response' for new code
 */
export {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  internalErrorResponse,
  badRequestResponse,
  handleApiError
} from '../../utils/api-response';
