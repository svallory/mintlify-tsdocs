/**
 * Debug utility providing level-based logging
 *
 * Usage:
 * ```typescript
 * import { createDebugger } from './utils/debug';
 *
 * const debug = createDebugger('documenter');
 * debug.info('Processing file: %s', filename);
 * debug.warn('Skipping invalid item');
 * debug.error('Failed to parse: %O', error);
 * ```
 *
 * Environment variables:
 * - `DEBUG=mint-tsdocs:*` - Enable all debug output
 * - `DEBUG=mint-tsdocs:*:error` - Only errors
 * - `DEBUG=mint-tsdocs:*:warn,mint-tsdocs:*:error` - Warnings and errors
 * - `DEBUG=mint-tsdocs:documenter:*` - All levels for documenter namespace
 */

import debug from 'debug';

const APP_NAMESPACE = 'mint-tsdocs';

/**
 * Debug levels in increasing verbosity order
 *
 * @beta
 */
export const DebugLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
} as const;

export type DebugLevel = typeof DebugLevel[keyof typeof DebugLevel];

/**
 * Debug function type (matches debug package signature)
 *
 * @beta
 */
export type DebugFunction = debug.Debugger;

/**
 * Debugger instance with level-specific methods
 *
 * @beta
 */
export interface Debugger {
  /**
   * Log error-level messages (always shown when debugging enabled)
   */
  error: DebugFunction;

  /**
   * Log warning-level messages
   */
  warn: DebugFunction;

  /**
   * Log info-level messages
   */
  info: DebugFunction;

  /**
   * Log debug-level messages
   */
  debug: DebugFunction;

  /**
   * Log trace-level messages (most verbose)
   */
  trace: DebugFunction;

  /**
   * Check if a specific level is enabled
   */
  isEnabled(level: DebugLevel): boolean;

  /**
   * Get the namespace for this debugger
   */
  namespace: string;
}

/**
 * Create a namespaced debugger with level-specific methods
 *
 * @param namespace - The namespace for this debugger (e.g., 'documenter', 'templates')
 * @returns Debugger instance with level methods
 *
 * @example
 * ```typescript
 * const debug = createDebugger('templates');
 * debug.info('Loading template: %s', templateName);
 * debug.error('Template not found: %s', templatePath);
 *
 * if (debug.isEnabled('trace')) {
 *   debug.trace('Template data: %O', complexObject);
 * }
 * ```
 *
 * @beta
 */
export function createDebugger(namespace: string): Debugger {
  const fullNamespace = `${APP_NAMESPACE}:${namespace}`;

  const levels = {
    error: debug(`${fullNamespace}:${DebugLevel.ERROR}`),
    warn: debug(`${fullNamespace}:${DebugLevel.WARN}`),
    info: debug(`${fullNamespace}:${DebugLevel.INFO}`),
    debug: debug(`${fullNamespace}:${DebugLevel.DEBUG}`),
    trace: debug(`${fullNamespace}:${DebugLevel.TRACE}`),
  };

  return {
    ...levels,
    isEnabled(level: DebugLevel): boolean {
      return levels[level].enabled;
    },
    namespace: fullNamespace,
  };
}

/**
 * Create a scoped debugger under a parent namespace
 *
 * @param parentNamespace - Parent namespace (e.g., 'templates')
 * @param childNamespace - Child namespace (e.g., 'liquid')
 * @returns Debugger instance with combined namespace
 *
 * @example
 * ```typescript
 * const debug = createScopedDebugger('templates', 'liquid');
 * // Creates debugger with namespace: mint-tsdocs:templates:liquid:*
 * ```
 */
export function createScopedDebugger(parentNamespace: string, childNamespace: string): Debugger {
  return createDebugger(`${parentNamespace}:${childNamespace}`);
}

/**
 * Enable or disable debugging programmatically
 *
 * @param namespaces - Comma-separated list of namespaces to enable
 *
 * @example
 * ```typescript
 * // Enable all levels for all namespaces
 * enableDebug('mint-tsdocs:*');
 *
 * // Enable only errors and warnings
 * enableDebug('mint-tsdocs:*:error,mint-tsdocs:*:warn');
 *
 * // Disable all
 * enableDebug('');
 * ```
 */
export function enableDebug(namespaces: string): void {
  debug.enable(namespaces);
}

/**
 * Disable all debugging
 */
export function disableDebug(): void {
  debug.disable();
}

/**
 * Get currently enabled debug namespaces
 */
export function getEnabledNamespaces(): string {
  // @ts-ignore - accessing internal property for debugging purposes
  return debug.names?.map((n: RegExp) => n.toString()).join(',') ?? '';
}
