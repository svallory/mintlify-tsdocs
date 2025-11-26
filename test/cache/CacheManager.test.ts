/**
 * Tests for CacheManager
 *
 * This test suite verifies the centralized cache management system,
 * including the global singleton pattern fix and cache coordination.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  CacheManager,
  getGlobalCacheManager,
  resetGlobalCacheManager,
} from '../../src/cache/CacheManager';
import { assertValidCacheStats } from '../helpers/assertions';

describe('CacheManager', () => {
  // Clean up global state after each test
  afterEach(() => {
    resetGlobalCacheManager();
  });

  describe('Global Singleton', () => {
    it('should create singleton on first call', () => {
      const cache1 = getGlobalCacheManager({ enableStats: true });
      const cache2 = getGlobalCacheManager();

      expect(cache1).toBe(cache2); // Same instance
    });

    it('should throw error when reconfiguring global cache', () => {
      // This is the bug we fixed - test the fix!
      getGlobalCacheManager({ enableStats: true });

      expect(() => {
        getGlobalCacheManager({ enableStats: false });
      }).toThrow(/already initialized/);
    });

    it('should allow reconfiguration after reset', () => {
      getGlobalCacheManager({ enableStats: true });
      resetGlobalCacheManager();

      // Should work after reset
      const cache = getGlobalCacheManager({ enableStats: false });
      const stats = cache.getStats();

      expect(stats.typeAnalysis.hitCount).toBe(0);
      expect(stats.enabled).toBe(true);
    });

    it('should accept undefined options on subsequent calls', () => {
      const cache1 = getGlobalCacheManager({ enableStats: true });
      const cache2 = getGlobalCacheManager(undefined);

      expect(cache1).toBe(cache2);
    });

    it('should reject empty object options on subsequent calls', () => {
      getGlobalCacheManager({ enableStats: true });

      // Even empty options object should throw
      expect(() => {
        getGlobalCacheManager({});
      }).toThrow(/already initialized/);
    });

    it('should maintain state across multiple gets', () => {
      const cache = getGlobalCacheManager({ enableStats: true });

      // Add some data
      cache.typeAnalysis.set('string', { type: 'primitive', properties: [] });

      // Get again - should have same data
      const cache2 = getGlobalCacheManager();
      expect(cache2.typeAnalysis.get('string')).toBeDefined();
    });
  });

  describe('Factory Methods', () => {
    it('should create development cache with correct config', () => {
      const cache = CacheManager.createDevelopment();
      const stats = cache.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.typeAnalysis.maxSize).toBe(500);
      expect(stats.typeAnalysis.enabled).toBe(true);
      expect(stats.apiResolution.maxSize).toBe(200);
      expect(stats.apiResolution.enabled).toBe(true);
    });

    it('should create production cache with correct config', () => {
      const cache = CacheManager.createProduction();
      const stats = cache.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.typeAnalysis.maxSize).toBe(2000);
      expect(stats.typeAnalysis.enabled).toBe(true);
      expect(stats.apiResolution.maxSize).toBe(1000);
      expect(stats.apiResolution.enabled).toBe(true);
    });

    it('should create default cache with correct config', () => {
      const cache = CacheManager.createDefault();
      const stats = cache.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.typeAnalysis.maxSize).toBe(1000);
      expect(stats.apiResolution.maxSize).toBe(500);
    });

    it('should allow factory options override for typeAnalysis', () => {
      const cache = CacheManager.createDevelopment({
        typeAnalysis: { maxSize: 999 },
      });

      expect(cache.getStats().typeAnalysis.maxSize).toBe(999);
    });

    it('should allow factory options override for apiResolution', () => {
      const cache = CacheManager.createProduction({
        apiResolution: { maxSize: 1234 },
      });

      expect(cache.getStats().apiResolution.maxSize).toBe(1234);
    });

    it('should allow factory options override for enabled flag', () => {
      const cache = CacheManager.createDevelopment({
        enabled: false,
      });

      expect(cache.getStats().enabled).toBe(false);
    });

    it('should merge factory defaults with overrides', () => {
      const cache = CacheManager.createProduction({
        typeAnalysis: { maxSize: 5000 },
        // Should keep default apiResolution settings
      });

      const stats = cache.getStats();
      expect(stats.typeAnalysis.maxSize).toBe(5000);
      expect(stats.apiResolution.maxSize).toBe(1000); // Default from factory
    });
  });

  describe('Cache Coordination', () => {
    it('should coordinate multiple cache instances', () => {
      const cache = CacheManager.createDefault();

      // Both caches should be accessible
      expect(cache.typeAnalysis).toBeDefined();
      expect(cache.apiResolution).toBeDefined();
    });

    it('should clear all caches', () => {
      const cache = CacheManager.createDefault();

      // Add some data to both caches
      cache.typeAnalysis.set('string', { type: 'primitive', properties: [] });

      expect(cache.getStats().typeAnalysis.size).toBeGreaterThan(0);

      cache.clearAll();

      expect(cache.typeAnalysis.get('string')).toBeUndefined();
      expect(cache.getStats().typeAnalysis.size).toBe(0);
    });

    it('should aggregate statistics from all caches', () => {
      const cache = CacheManager.createDefault();

      // Generate some cache activity
      cache.typeAnalysis.set('string', { type: 'primitive', properties: [] });
      cache.typeAnalysis.get('string'); // Hit
      cache.typeAnalysis.get('number'); // Miss

      const stats = cache.getStats();

      expect(stats.totalHitRate).toBeGreaterThan(0);
      expect(stats.typeAnalysis.hitCount).toBe(1);
      expect(stats.typeAnalysis.missCount).toBe(1);
    });

    it('should calculate combined hit rate correctly', () => {
      const cache = CacheManager.createDefault();

      // TypeAnalysis: 2 hits, 1 miss
      cache.typeAnalysis.set('string', { type: 'primitive', properties: [] });
      cache.typeAnalysis.set('number', { type: 'primitive', properties: [] });
      cache.typeAnalysis.get('string'); // Hit
      cache.typeAnalysis.get('number'); // Hit
      cache.typeAnalysis.get('boolean'); // Miss

      const stats = cache.getStats();

      // Total: 2 hits out of 3 requests = 66.67%
      expect(stats.totalHitRate).toBeCloseTo(2 / 3, 2);
    });

    it('should return valid statistics structure', () => {
      const cache = CacheManager.createDefault();
      const stats = cache.getStats();

      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('typeAnalysis');
      expect(stats).toHaveProperty('apiResolution');
      expect(stats).toHaveProperty('totalHitRate');

      assertValidCacheStats(stats.typeAnalysis);
      assertValidCacheStats(stats.apiResolution);
    });

    it('should handle zero requests in totalHitRate calculation', () => {
      const cache = CacheManager.createDefault();
      const stats = cache.getStats();

      // No requests yet
      expect(stats.totalHitRate).toBe(0);
    });
  });

  describe('Disabled Cache', () => {
    it('should disable all caches when enabled=false', () => {
      const cache = new CacheManager({ enabled: false });

      cache.typeAnalysis.set('string', { type: 'primitive', properties: [] });
      const result = cache.typeAnalysis.get('string');

      expect(result).toBeUndefined();
    });

    it('should show disabled in stats', () => {
      const cache = new CacheManager({ enabled: false });
      const stats = cache.getStats();

      expect(stats.enabled).toBe(false);
    });

    it('should disable individual caches even if globally enabled', () => {
      const cache = new CacheManager({
        enabled: true,
        typeAnalysis: { enabled: false },
      });

      cache.typeAnalysis.set('string', { type: 'primitive', properties: [] });

      expect(cache.typeAnalysis.get('string')).toBeUndefined();
      expect(cache.getStats().typeAnalysis.enabled).toBe(false);
    });

    it('should respect individual cache enabled flag', () => {
      const cache = new CacheManager({
        enabled: true,
        typeAnalysis: { enabled: true },
        apiResolution: { enabled: false },
      });

      const stats = cache.getStats();
      expect(stats.typeAnalysis.enabled).toBe(true);
      expect(stats.apiResolution.enabled).toBe(false);
    });

    it('should override individual enabled with global disabled', () => {
      const cache = new CacheManager({
        enabled: false,
        typeAnalysis: { enabled: true }, // Should be overridden
      });

      const stats = cache.getStats();
      expect(stats.typeAnalysis.enabled).toBe(false);
    });
  });

  describe('Default Options', () => {
    it('should use default options when none provided', () => {
      const cache = new CacheManager();
      const stats = cache.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.typeAnalysis.enabled).toBe(true);
      expect(stats.apiResolution.enabled).toBe(true);
    });

    it('should allow partial options', () => {
      const cache = new CacheManager({
        typeAnalysis: { maxSize: 100 },
      });

      const stats = cache.getStats();
      expect(stats.typeAnalysis.maxSize).toBe(100);
      expect(stats.apiResolution.enabled).toBe(true); // Default
    });
  });

  describe('Edge Cases', () => {
    it('should handle maxSize of 1', () => {
      const cache = new CacheManager({
        typeAnalysis: { maxSize: 1 },
      });

      cache.typeAnalysis.set('type1', { type: 'a', properties: [] });
      cache.typeAnalysis.set('type2', { type: 'b', properties: [] });

      // Only type2 should remain
      expect(cache.typeAnalysis.get('type1')).toBeUndefined();
      expect(cache.typeAnalysis.get('type2')).toBeDefined();
    });

    it('should handle very long type strings', () => {
      const cache = new CacheManager();
      const longType = 'Array<'.repeat(100) + 'string' + '>'.repeat(100);

      cache.typeAnalysis.set(longType, { type: 'complex', properties: [] });
      expect(cache.typeAnalysis.get(longType)).toBeDefined();
    });

    it('should handle rapid cache operations', () => {
      const cache = new CacheManager();

      // Rapidly add and access items
      for (let i = 0; i < 100; i++) {
        cache.typeAnalysis.set(`type${i}`, { type: `type${i}`, properties: [] });
        cache.typeAnalysis.get(`type${i}`);
      }

      const stats = cache.getStats();
      expect(stats.typeAnalysis.hitCount).toBe(100);
    });

    it('should handle concurrent access to different caches', () => {
      const cache = new CacheManager();

      // Access both caches
      cache.typeAnalysis.set('string', { type: 'primitive', properties: [] });
      cache.typeAnalysis.get('string');

      const stats = cache.getStats();
      expect(stats.typeAnalysis.hitCount).toBe(1);
    });

    it('should handle empty options object', () => {
      const cache = new CacheManager({});
      const stats = cache.getStats();

      expect(stats.enabled).toBe(true);
    });
  });

  describe('Statistics Reporting', () => {
    it('should not print stats when enableStats is false', () => {
      const cache = new CacheManager({ enableStats: false });

      // Should not throw
      expect(() => cache.printStats()).not.toThrow();
    });

    it('should print stats when enableStats is true', () => {
      const cache = new CacheManager({ enableStats: true });

      // Add some activity
      cache.typeAnalysis.set('string', { type: 'primitive', properties: [] });
      cache.typeAnalysis.get('string');

      // Should not throw
      expect(() => cache.printStats()).not.toThrow();
    });
  });

  describe('Cache Independence', () => {
    it('should maintain separate cache instances', () => {
      const cache1 = new CacheManager();
      const cache2 = new CacheManager();

      cache1.typeAnalysis.set('string', { type: 'type1', properties: [] });
      cache2.typeAnalysis.set('string', { type: 'type2', properties: [] });

      // Should be different
      expect(cache1.typeAnalysis.get('string')?.type).toBe('type1');
      expect(cache2.typeAnalysis.get('string')?.type).toBe('type2');
    });

    it('should not affect global cache from local instances', () => {
      const globalCache = getGlobalCacheManager();
      const localCache = new CacheManager();

      globalCache.typeAnalysis.set('string', { type: 'global', properties: [] });
      localCache.typeAnalysis.set('string', { type: 'local', properties: [] });

      // Should be independent
      expect(globalCache.typeAnalysis.get('string')?.type).toBe('global');
      expect(localCache.typeAnalysis.get('string')?.type).toBe('local');
    });
  });
});
