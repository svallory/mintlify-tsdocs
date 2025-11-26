/**
 * Global test setup for Vitest
 * Runs before all tests
 */

import { beforeEach, afterEach } from 'bun:test';
import { resetGlobalCacheManager } from '../src/cache/CacheManager';

// Reset cache manager before each test to ensure test isolation
beforeEach(() => {
  resetGlobalCacheManager();
});

// Clean up after each test
afterEach(() => {
  // Additional cleanup can be added here
});
