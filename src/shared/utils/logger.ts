/**
 * Re-export from main utils to avoid code duplication
 * @deprecated Import directly from '@/utils/logger' for new code
 */
import { logger as mainLogger, createContextLogger } from '../../utils/logger';

export { mainLogger as logger, createContextLogger };

export type {
  LogLevel,
  LogEntry,
  LoggerConfig
} from '../../utils/logger';

// P2-6: Fixed default export to reference imported variable
export default mainLogger;
