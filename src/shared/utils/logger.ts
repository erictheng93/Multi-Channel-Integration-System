/**
 * Re-export from main utils to avoid code duplication
 * @deprecated Import directly from '@/utils/logger' for new code
 */
export {
  logger,
  createContextLogger
} from '../../utils/logger';

export type {
  LogLevel,
  LogEntry,
  LoggerConfig
} from '../../utils/logger';

export default logger;
