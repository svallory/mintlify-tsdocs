/**
 * Utility exports for security and validation
 */

export { SecurityUtils } from './SecurityUtils';
export { Utilities } from './Utilities';
export { DocumentationHelper } from './DocumentationHelper';
export { ObjectTypeAnalyzer } from './ObjectTypeAnalyzer';
export { TypeInfoGenerator } from './TypeInfoGenerator';
export {
  DocumentationStats,
  type TypeCoverageStats,
  type ApiSurfaceStats,
  type DocumentationCoverageStats,
  type GeneratedFilesStats,
  type DocumentationStatistics
} from './DocumentationStats';

/**
 * Debug utility exports
 */
export {
  createDebugger,
  createScopedDebugger,
  enableDebug,
  disableDebug,
  getEnabledNamespaces,
  DebugLevel,
  type Debugger,
  type DebugFunction
} from './debug';

/**
 * Error handling exports
 */
export {
  DocumentationError,
  SecurityError,
  FileSystemError,
  ValidationError,
  ApiModelError,
  ErrorCode,
  type ErrorContext
} from '../errors/DocumentationError';

export {
  ErrorBoundary,
  GlobalErrorBoundary,
  withErrorBoundary,
  type ErrorBoundaryOptions,
  type ErrorResult
} from '../errors/ErrorBoundary';

/**
 * Link validation exports
 */
export { LinkValidator } from './LinkValidator';
export type { LinkValidation } from '../components/Link';