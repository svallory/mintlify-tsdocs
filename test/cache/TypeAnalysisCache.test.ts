/**
 * Tests for TypeAnalysisCache
 *
 * This test suite verifies the type analysis caching system,
 * including LRU eviction, statistics tracking, and the cached function wrapper.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeAnalysisCache } from '../../src/cache/TypeAnalysisCache';
import { assertValidCacheStats } from '../helpers/assertions';

describe('TypeAnalysisCache', () => {
  let cache: TypeAnalysisCache;

  beforeEach(() => {
    cache = new TypeAnalysisCache({ maxSize: 3, enabled: true });
  });

  describe('Basic Functionality', () => {
    it('should cache type analysis results', () => {
      const analysis = { type: 'primitive', properties: [] };

      cache.set('string', analysis);
      const result = cache.get('string');

      expect(result).toBe(analysis);
    });

    it('should return undefined for cache miss', () => {
      const result = cache.get('unknown');
      expect(result).toBeUndefined();
    });

    it('should normalize whitespace in cache keys', () => {
      const analysis = { type: 'primitive', properties: [] };

      cache.set('  string  ', analysis);

      // Should hit with different whitespace
      expect(cache.get('string')).toBe(analysis);
      expect(cache.get('string  ')).toBe(analysis);
      expect(cache.get('  string')).toBe(analysis);
    });

    it('should handle complex type strings', () => {
      const analysis = {
        type: 'object',
        properties: [
          { name: 'prop1', type: 'string' },
          { name: 'prop2', type: 'number' },
        ],
      };

      cache.set('{ prop1: string; prop2: number }', analysis);
      expect(cache.get('{ prop1: string; prop2: number }')).toBe(analysis);
    });

    it('should handle generic type strings', () => {
      const analysis = { type: 'generic', properties: [] };

      cache.set('Array<Promise<string>>', analysis);
      expect(cache.get('Array<Promise<string>>')).toBe(analysis);
    });

    it('should handle union type strings', () => {
      const analysis = { type: 'union', properties: [] };

      cache.set('string | number | boolean', analysis);
      expect(cache.get('string | number | boolean')).toBe(analysis);
    });

    it('should update existing cache entry', () => {
      const analysis1 = { type: 'type1', properties: [] };
      const analysis2 = { type: 'type2', properties: [] };

      cache.set('string', analysis1);
      cache.set('string', analysis2);

      expect(cache.get('string')).toBe(analysis2);
    });

    it('should not change cache size when updating', () => {
      cache.set('string', { type: 'type1', properties: [] });
      expect(cache.getStats().size).toBe(1);

      cache.set('string', { type: 'type2', properties: [] });
      expect(cache.getStats().size).toBe(1);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used item when full', () => {
      cache.set('type1', { type: 'a', properties: [] });
      cache.set('type2', { type: 'b', properties: [] });
      cache.set('type3', { type: 'c', properties: [] });

      // Cache is full (maxSize: 3)
      expect(cache.getStats().size).toBe(3);

      // Add type4, should evict type1 (oldest)
      cache.set('type4', { type: 'd', properties: [] });

      expect(cache.get('type1')).toBeUndefined(); // Evicted
      expect(cache.get('type2')).toBeDefined();
      expect(cache.get('type3')).toBeDefined();
      expect(cache.get('type4')).toBeDefined();
    });

    it('should move accessed items to end (LRU behavior)', () => {
      cache.set('type1', { type: 'a', properties: [] });
      cache.set('type2', { type: 'b', properties: [] });
      cache.set('type3', { type: 'c', properties: [] });

      // Access type1 to make it recently used
      cache.get('type1');

      // Add type4, should evict type2 (now oldest)
      cache.set('type4', { type: 'd', properties: [] });

      expect(cache.get('type1')).toBeDefined(); // Kept (recently accessed)
      expect(cache.get('type2')).toBeUndefined(); // Evicted (oldest)
      expect(cache.get('type3')).toBeDefined(); // Kept
      expect(cache.get('type4')).toBeDefined(); // New
    });

    it('should not evict when cache not full', () => {
      cache.set('type1', { type: 'a', properties: [] });
      cache.set('type2', { type: 'b', properties: [] });

      expect(cache.getStats().size).toBe(2);

      // All should still be present
      expect(cache.get('type1')).toBeDefined();
      expect(cache.get('type2')).toBeDefined();
    });

    it('should handle maxSize of 1', () => {
      const smallCache = new TypeAnalysisCache({ maxSize: 1 });

      smallCache.set('type1', { type: 'a', properties: [] });
      smallCache.set('type2', { type: 'b', properties: [] });

      // Only most recent should remain
      expect(smallCache.get('type1')).toBeUndefined();
      expect(smallCache.get('type2')).toBeDefined();
    });

    it('should handle rapid evictions', () => {
      const cache = new TypeAnalysisCache({ maxSize: 5 });

      // Add 10 items to a cache with maxSize 5
      for (let i = 0; i < 10; i++) {
        cache.set(`type${i}`, { type: `type${i}`, properties: [] });
      }

      // Only last 5 should remain
      expect(cache.getStats().size).toBe(5);
      expect(cache.get('type0')).toBeUndefined();
      expect(cache.get('type5')).toBeDefined();
      expect(cache.get('type9')).toBeDefined();
    });

    it('should not evict when updating existing entry', () => {
      cache.set('type1', { type: 'a', properties: [] });
      cache.set('type2', { type: 'b', properties: [] });
      cache.set('type3', { type: 'c', properties: [] });

      // Update type1 - should not evict anything
      cache.set('type1', { type: 'updated', properties: [] });

      expect(cache.getStats().size).toBe(3);
      expect(cache.get('type1')?.type).toBe('updated');
      expect(cache.get('type2')).toBeDefined();
      expect(cache.get('type3')).toBeDefined();
    });
  });

  describe('Statistics Tracking', () => {
    it('should track hits and misses', () => {
      cache.set('string', { type: 'primitive', properties: [] });

      cache.get('string'); // Hit
      cache.get('number'); // Miss
      cache.get('boolean'); // Miss

      const stats = cache.getStats();

      expect(stats.hitCount).toBe(1);
      expect(stats.missCount).toBe(2);
      expect(stats.hitRate).toBeCloseTo(1 / 3, 2);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('string', { type: 'primitive', properties: [] });
      cache.set('number', { type: 'primitive', properties: [] });

      // 2 hits, 1 miss = 66.67% hit rate
      cache.get('string'); // Hit
      cache.get('number'); // Hit
      cache.get('boolean'); // Miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it('should return 0 hit rate when no requests', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should return 100% hit rate when all hits', () => {
      cache.set('string', { type: 'primitive', properties: [] });

      cache.get('string'); // Hit
      cache.get('string'); // Hit

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(1);
    });

    it('should reset statistics on clear', () => {
      cache.set('string', { type: 'primitive', properties: [] });
      cache.get('string'); // Hit
      cache.get('number'); // Miss

      let stats = cache.getStats();
      expect(stats.hitCount).toBeGreaterThan(0);
      expect(stats.missCount).toBeGreaterThan(0);

      cache.clear();

      stats = cache.getStats();
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0);
      expect(stats.size).toBe(0);
    });

    it('should track cache size correctly', () => {
      expect(cache.getStats().size).toBe(0);

      cache.set('type1', { type: 'a', properties: [] });
      expect(cache.getStats().size).toBe(1);

      cache.set('type2', { type: 'b', properties: [] });
      expect(cache.getStats().size).toBe(2);

      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });

    it('should report valid cache statistics', () => {
      const stats = cache.getStats();
      assertValidCacheStats(stats);
    });

    it('should report maxSize correctly', () => {
      expect(cache.getStats().maxSize).toBe(3);

      const bigCache = new TypeAnalysisCache({ maxSize: 1000 });
      expect(bigCache.getStats().maxSize).toBe(1000);
    });

    it('should not count evicted items in size', () => {
      cache.set('type1', { type: 'a', properties: [] });
      cache.set('type2', { type: 'b', properties: [] });
      cache.set('type3', { type: 'c', properties: [] });
      cache.set('type4', { type: 'd', properties: [] }); // Evicts type1

      expect(cache.getStats().size).toBe(3);
    });
  });

  describe('Cache Clear', () => {
    it('should clear all cached items', () => {
      cache.set('type1', { type: 'a', properties: [] });
      cache.set('type2', { type: 'b', properties: [] });

      expect(cache.getStats().size).toBe(2);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.get('type1')).toBeUndefined();
      expect(cache.get('type2')).toBeUndefined();
    });

    it('should allow adding items after clear', () => {
      cache.set('type1', { type: 'a', properties: [] });
      cache.clear();

      cache.set('type2', { type: 'b', properties: [] });
      expect(cache.get('type2')).toBeDefined();
      expect(cache.getStats().size).toBe(1);
    });
  });

  describe('Disabled Cache', () => {
    it('should not cache when disabled', () => {
      const disabledCache = new TypeAnalysisCache({ enabled: false });

      disabledCache.set('string', { type: 'primitive', properties: [] });
      const result = disabledCache.get('string');

      expect(result).toBeUndefined();
      expect(disabledCache.getStats().size).toBe(0);
    });

    it('should report enabled status in stats', () => {
      const enabledCache = new TypeAnalysisCache({ enabled: true });
      const disabledCache = new TypeAnalysisCache({ enabled: false });

      expect(enabledCache.getStats().enabled).toBe(true);
      expect(disabledCache.getStats().enabled).toBe(false);
    });

    it('should not track statistics when disabled', () => {
      const disabledCache = new TypeAnalysisCache({ enabled: false });

      disabledCache.set('string', { type: 'primitive', properties: [] });
      disabledCache.get('string'); // Would be hit if enabled

      const stats = disabledCache.getStats();
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0); // When disabled, misses are still counted but cache is not used
    });
  });

  describe('createCachedFunction', () => {
    it('should cache function results', () => {
      let callCount = 0;
      const analyze = (type: string) => {
        callCount++;
        return { type, analyzed: true, properties: [] };
      };

      const cached = TypeAnalysisCache.createCachedFunction(analyze);

      // First call
      const result1 = cached('string');
      expect(callCount).toBe(1);
      expect(result1.type).toBe('string');

      // Second call - should use cache
      const result2 = cached('string');
      expect(callCount).toBe(1); // Not called again
      expect(result2).toBe(result1); // Same object
    });

    it('should cache different inputs separately', () => {
      let callCount = 0;
      const analyze = (type: string) => {
        callCount++;
        return { type, properties: [] };
      };

      const cached = TypeAnalysisCache.createCachedFunction(analyze);

      cached('string');
      cached('number');

      expect(callCount).toBe(2); // Called for each unique input
    });

    it('should respect cache options', () => {
      let callCount = 0;
      const analyze = (type: string) => {
        callCount++;
        return { type, properties: [] };
      };

      const cached = TypeAnalysisCache.createCachedFunction(analyze, {
        maxSize: 2,
      });

      cached('type1');
      cached('type2');
      cached('type3'); // Should evict type1

      // Calling type1 again should recompute
      cached('type1');
      expect(callCount).toBe(4); // type1, type2, type3, type1 again
    });

    it('should work with disabled cache', () => {
      let callCount = 0;
      const analyze = (type: string) => {
        callCount++;
        return { type, properties: [] };
      };

      const cached = TypeAnalysisCache.createCachedFunction(analyze, {
        enabled: false,
      });

      cached('string');
      cached('string'); // Should call again (not cached)

      expect(callCount).toBe(2);
    });

    it('should handle multiple parameters via first parameter', () => {
      let callCount = 0;
      const analyze = (type: string, context?: string) => {
        callCount++;
        return { type, context, properties: [] };
      };

      const cached = TypeAnalysisCache.createCachedFunction(analyze);

      // Only first parameter (type) is used as cache key
      cached('string', 'context1');
      cached('string', 'context2'); // Same cache key, different context

      expect(callCount).toBe(1); // Only called once
    });

    it('should normalize whitespace in cached function', () => {
      let callCount = 0;
      const analyze = (type: string) => {
        callCount++;
        return { type, properties: [] };
      };

      const cached = TypeAnalysisCache.createCachedFunction(analyze);

      cached('  string  ');
      cached('string'); // Should hit cache

      expect(callCount).toBe(1);
    });
  });

  describe('Default Options', () => {
    it('should use default maxSize when not provided', () => {
      const defaultCache = new TypeAnalysisCache();
      expect(defaultCache.getStats().maxSize).toBe(1000);
    });

    it('should be enabled by default', () => {
      const defaultCache = new TypeAnalysisCache();
      expect(defaultCache.getStats().enabled).toBe(true);
    });

    it('should allow partial options', () => {
      const customCache = new TypeAnalysisCache({ maxSize: 500 });
      expect(customCache.getStats().maxSize).toBe(500);
      expect(customCache.getStats().enabled).toBe(true); // Still default
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty type string', () => {
      const analysis = { type: 'empty', properties: [] };
      cache.set('', analysis);
      expect(cache.get('')).toBe(analysis);
    });

    it('should handle very long type strings', () => {
      const longType = 'Array<'.repeat(100) + 'string' + '>'.repeat(100);
      const analysis = { type: 'long', properties: [] };

      cache.set(longType, analysis);
      expect(cache.get(longType)).toBe(analysis);
    });

    it('should handle type strings with special characters', () => {
      const analysis = { type: 'special', properties: [] };

      cache.set('Record<string, { [key: string]: number }>', analysis);
      expect(cache.get('Record<string, { [key: string]: number }>')).toBe(analysis);
    });

    it('should handle type strings with newlines', () => {
      const analysis = { type: 'multiline', properties: [] };
      const multilineType = '{\n  prop1: string;\n  prop2: number;\n}';

      cache.set(multilineType, analysis);
      expect(cache.get(multilineType)).toBe(analysis);
    });

    it('should handle rapid cache operations', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`type${i}`, { type: `type${i}`, properties: [] });
        expect(cache.get(`type${i}`)).toBeDefined();
      }
    });

    it('should handle null-like values in analysis', () => {
      const analysis = { type: 'nullable', properties: [] };
      cache.set('string | null', analysis);
      expect(cache.get('string | null')).toBe(analysis);
    });

    it('should handle analysis with complex nested properties', () => {
      const analysis = {
        type: 'complex',
        properties: [
          {
            name: 'nested',
            type: 'object',
            properties: [
              { name: 'deep', type: 'string' },
            ],
          },
        ],
      };

      cache.set('ComplexType', analysis);
      expect(cache.get('ComplexType')).toBe(analysis);
    });
  });
});
