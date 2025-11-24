/**
 * Mock utilities for testing
 */

import { vi } from 'vitest';
import type { ApiItem } from '@microsoft/api-extractor-model';

/**
 * Mock ApiItem for testing
 */
export function createMockApiItem(overrides: Partial<any> = {}): any {
  const displayName = overrides.displayName || 'MockClass';
  const kind = overrides.kind || 'class';

  return {
    kind,
    displayName,
    canonicalReference: {
      toString: () => `mock-package!${displayName}:${kind}`
    },
    getSortKey: () => displayName,
    ...overrides
  };
}

/**
 * Mock DeclarationReference for testing cache keys
 */
export function createMockDeclarationReference(overrides: Partial<any> = {}): any {
  const packageName = overrides.packageName || 'test-package';
  const memberReferences = overrides.memberReferences || [];

  return {
    packageName,
    memberReferences,
    toString: () => {
      const members = memberReferences.map((m: any) => m.name).join('.');
      return members ? `${packageName}!${members}` : packageName;
    },
    ...overrides
  };
}

/**
 * Mock file system operations
 */
export function createMockFileSystem() {
  return {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    exists: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
  };
}

/**
 * Mock terminal for CLI testing
 */
export function createMockTerminal() {
  const output: string[] = [];

  return {
    writeLine: vi.fn((message: string) => output.push(message)),
    writeError: vi.fn((message: string) => output.push(`ERROR: ${message}`)),
    writeWarning: vi.fn((message: string) => output.push(`WARNING: ${message}`)),
    getOutput: () => output,
    clear: () => output.length = 0,
  };
}

/**
 * Mock cache manager for testing
 */
export function createMockCacheManager() {
  const typeAnalysisCache = new Map();
  const apiResolutionCache = new Map();

  return {
    typeAnalysis: {
      get: vi.fn((key: string) => typeAnalysisCache.get(key)),
      set: vi.fn((key: string, value: any) => typeAnalysisCache.set(key, value)),
      clear: vi.fn(() => typeAnalysisCache.clear()),
      getStats: vi.fn(() => ({
        size: typeAnalysisCache.size,
        maxSize: 1000,
        hitRate: 0,
        hitCount: 0,
        missCount: 0,
        enabled: true
      }))
    },
    apiResolution: {
      get: vi.fn((ref: any, context?: any) => apiResolutionCache.get(`${ref}|${context}`)),
      set: vi.fn((ref: any, context: any, value: any) => apiResolutionCache.set(`${ref}|${context}`, value)),
      clear: vi.fn(() => apiResolutionCache.clear()),
      getStats: vi.fn(() => ({
        size: apiResolutionCache.size,
        maxSize: 500,
        hitRate: 0,
        hitCount: 0,
        missCount: 0,
        enabled: true
      }))
    },
    clearAll: vi.fn(() => {
      typeAnalysisCache.clear();
      apiResolutionCache.clear();
    }),
    getStats: vi.fn(() => ({
      enabled: true,
      typeAnalysis: {
        size: typeAnalysisCache.size,
        maxSize: 1000,
        hitRate: 0,
        hitCount: 0,
        missCount: 0,
        enabled: true
      },
      apiResolution: {
        size: apiResolutionCache.size,
        maxSize: 500,
        hitRate: 0,
        hitCount: 0,
        missCount: 0,
        enabled: true
      },
      totalHitRate: 0
    }))
  };
}

/**
 * Create a mock with a specific toString() value
 * Useful for testing cache key collisions
 */
export function createObjectWithToString(toStringValue: string, data: any = {}): any {
  return {
    ...data,
    toString: () => toStringValue
  };
}

/**
 * Mock template engine for testing
 */
export function createMockTemplateEngine() {
  return {
    render: vi.fn((template: string, data: any) => {
      // Simple mock that just returns the template
      return Promise.resolve(template);
    }),
    renderFile: vi.fn((filePath: string, data: any) => {
      return Promise.resolve(`Rendered: ${filePath}`);
    })
  };
}
