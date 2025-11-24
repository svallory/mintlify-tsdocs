/**
 * Tests for ApiResolutionCache
 *
 * NOTE: Some tests are expected to FAIL initially to document current bugs
 * See: agent/reports/review/PERFORMANCE_REVIEW.md for known issues
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ApiResolutionCache } from '../../src/cache/ApiResolutionCache';
import {
  createMockDeclarationReference,
  createMockApiItem,
  createObjectWithToString,
} from '../helpers/mocks';
import { assertValidCacheStats, assertUniqueCacheKey } from '../helpers/assertions';

describe('ApiResolutionCache', () => {
  let cache: ApiResolutionCache;

  beforeEach(() => {
    cache = new ApiResolutionCache({ maxSize: 3, enabled: true });
  });

  describe('Basic Functionality', () => {
    it('should store and retrieve cached values', () => {
      const ref = createMockDeclarationReference({ packageName: 'test-pkg' });
      const context = createMockApiItem({ displayName: 'TestContext' });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, context, result);
      const retrieved = cache.get(ref, context);

      expect(retrieved).toBe(result);
    });

    it('should return undefined for cache miss', () => {
      const ref = createMockDeclarationReference({ packageName: 'test-pkg' });
      const context = createMockApiItem();

      const retrieved = cache.get(ref, context);

      expect(retrieved).toBeUndefined();
    });

    it('should handle undefined context', () => {
      const ref = createMockDeclarationReference({ packageName: 'test-pkg' });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, undefined, result);
      const retrieved = cache.get(ref, undefined);

      expect(retrieved).toBe(result);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate unique cache keys for different declaration references', () => {
      const ref1 = createMockDeclarationReference({
        packageName: 'pkg1',
        memberReferences: [{ name: 'Member1' }],
      });
      const ref2 = createMockDeclarationReference({
        packageName: 'pkg2',
        memberReferences: [{ name: 'Member2' }],
      });
      const context = createMockApiItem();

      const result1 = { resolvedApiItem: createMockApiItem({ displayName: 'Item1' }), errorMessage: undefined };
      const result2 = { resolvedApiItem: createMockApiItem({ displayName: 'Item2' }), errorMessage: undefined };

      cache.set(ref1, context, result1);
      cache.set(ref2, context, result2);

      const retrieved1 = cache.get(ref1, context);
      const retrieved2 = cache.get(ref2, context);

      // These should be different objects
      expect(retrieved1).toBe(result1);
      expect(retrieved2).toBe(result2);
      expect(retrieved1).not.toBe(retrieved2);
    });

    it('should not have cache collisions with identical toString() values', () => {
      const toStringValue = 'test-package!Member';

      const ref1 = createObjectWithToString(toStringValue, {
        packageName: 'test-package',
        data: 'ref1-data',
      });
      const ref2 = createObjectWithToString(toStringValue, {
        packageName: 'test-package',
        data: 'ref2-data',
      });

      const context = createMockApiItem();
      const result1 = { resolvedApiItem: createMockApiItem({ displayName: 'Result1' }), errorMessage: undefined };
      const result2 = { resolvedApiItem: createMockApiItem({ displayName: 'Result2' }), errorMessage: undefined };

      cache.set(ref1, context, result1);
      cache.set(ref2, context, result2);

      const retrieved1 = cache.get(ref1, context);
      const retrieved2 = cache.get(ref2, context);

      // FIXED: Should not collide even with identical toString()
      expect(retrieved1).toBe(result1);
      expect(retrieved2).toBe(result2);
    });

    it('should generate different keys for same ref with different contexts', () => {
      const ref = createMockDeclarationReference({ packageName: 'test-pkg' });
      const context1 = createMockApiItem({ displayName: 'Context1' });
      const context2 = createMockApiItem({ displayName: 'Context2' });

      const result1 = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };
      const result2 = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, context1, result1);
      cache.set(ref, context2, result2);

      const retrieved1 = cache.get(ref, context1);
      const retrieved2 = cache.get(ref, context2);

      expect(retrieved1).toBe(result1);
      expect(retrieved2).toBe(result2);
      expect(retrieved1).not.toBe(retrieved2);
    });
  });

  describe('Cache Key Generation (Collision Fix)', () => {
    it('should include packageName in cache key', () => {
      const ref1 = createMockDeclarationReference({
        packageName: 'pkg1',
        memberReferences: [],
      });
      const ref2 = createMockDeclarationReference({
        packageName: 'pkg2',
        memberReferences: [],
      });

      const result1 = { resolvedApiItem: createMockApiItem({ displayName: 'Item1' }), errorMessage: undefined };
      const result2 = { resolvedApiItem: createMockApiItem({ displayName: 'Item2' }), errorMessage: undefined };

      cache.set(ref1, undefined, result1);
      cache.set(ref2, undefined, result2);

      expect(cache.get(ref1, undefined)).toBe(result1);
      expect(cache.get(ref2, undefined)).toBe(result2);
    });

    it('should include memberReferences in cache key', () => {
      const ref1 = createMockDeclarationReference({
        packageName: 'pkg',
        memberReferences: [{ name: 'MemberA' }],
      });
      const ref2 = createMockDeclarationReference({
        packageName: 'pkg',
        memberReferences: [{ name: 'MemberB' }],
      });

      const result1 = { resolvedApiItem: createMockApiItem({ displayName: 'Item1' }), errorMessage: undefined };
      const result2 = { resolvedApiItem: createMockApiItem({ displayName: 'Item2' }), errorMessage: undefined };

      cache.set(ref1, undefined, result1);
      cache.set(ref2, undefined, result2);

      expect(cache.get(ref1, undefined)).toBe(result1);
      expect(cache.get(ref2, undefined)).toBe(result2);
    });

    it('should include multiple memberReferences in cache key', () => {
      const ref1 = createMockDeclarationReference({
        packageName: 'pkg',
        memberReferences: [{ name: 'A' }, { name: 'B' }],
      });
      const ref2 = createMockDeclarationReference({
        packageName: 'pkg',
        memberReferences: [{ name: 'A' }, { name: 'C' }],
      });

      const result1 = { resolvedApiItem: createMockApiItem({ displayName: 'Item1' }), errorMessage: undefined };
      const result2 = { resolvedApiItem: createMockApiItem({ displayName: 'Item2' }), errorMessage: undefined };

      cache.set(ref1, undefined, result1);
      cache.set(ref2, undefined, result2);

      expect(cache.get(ref1, undefined)).toBe(result1);
      expect(cache.get(ref2, undefined)).toBe(result2);
    });

    it('should handle empty memberReferences', () => {
      const ref = createMockDeclarationReference({
        packageName: 'pkg',
        memberReferences: [],
      });

      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, undefined, result);
      expect(cache.get(ref, undefined)).toBe(result);
    });

    it('should treat undefined and null context as equivalent', () => {
      const ref = createMockDeclarationReference({ packageName: 'test' });

      const result1 = { resolvedApiItem: createMockApiItem({ displayName: 'Item1' }), errorMessage: undefined };
      const result2 = { resolvedApiItem: createMockApiItem({ displayName: 'Item2' }), errorMessage: undefined };

      cache.set(ref, undefined, result1);
      cache.set(ref, null as any, result2); // Overwrites result1

      // Both should return the same (most recent) result
      expect(cache.get(ref, undefined)).toBe(result2);
      expect(cache.get(ref, null as any)).toBe(result2);
    });

    it('should handle refs with identical structure but different object identity', () => {
      // Create two refs with identical data but different object identities
      const ref1 = createMockDeclarationReference({
        packageName: 'test-package',
        memberReferences: [{ name: 'Member' }],
      });
      const ref2 = createMockDeclarationReference({
        packageName: 'test-package',
        memberReferences: [{ name: 'Member' }],
      });

      const result1 = { resolvedApiItem: createMockApiItem({ displayName: 'Item1' }), errorMessage: undefined };

      cache.set(ref1, undefined, result1);

      // ref2 should hit the same cache entry (identical data)
      const retrieved = cache.get(ref2, undefined);
      expect(retrieved).toBe(result1);
    });

    it('should generate stable keys for same inputs', () => {
      const ref = createMockDeclarationReference({
        packageName: 'test-package',
        memberReferences: [{ name: 'Member' }],
      });
      const context = createMockApiItem({ displayName: 'Context' });

      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, context, result);

      // Multiple gets should all hit the cache
      expect(cache.get(ref, context)).toBe(result);
      expect(cache.get(ref, context)).toBe(result);
      expect(cache.get(ref, context)).toBe(result);

      const stats = cache.getStats();
      expect(stats.hitCount).toBe(3);
    });
  });

  describe('LRU Eviction', () => {
    it('should enforce maximum size limit', () => {
      const refs = [
        createMockDeclarationReference({ packageName: 'pkg1' }),
        createMockDeclarationReference({ packageName: 'pkg2' }),
        createMockDeclarationReference({ packageName: 'pkg3' }),
        createMockDeclarationReference({ packageName: 'pkg4' }),
      ];

      const results = refs.map((_, i) => ({
        resolvedApiItem: createMockApiItem({ displayName: `Item${i}` }),
        errorMessage: undefined,
      }));

      // Fill cache to maxSize (3)
      cache.set(refs[0], undefined, results[0]);
      cache.set(refs[1], undefined, results[1]);
      cache.set(refs[2], undefined, results[2]);

      // Cache should be full
      const stats = cache.getStats();
      expect(stats.size).toBe(3);

      // Add one more - should evict oldest (refs[0])
      cache.set(refs[3], undefined, results[3]);

      expect(cache.get(refs[0], undefined)).toBeUndefined();
      expect(cache.get(refs[1], undefined)).toBe(results[1]);
      expect(cache.get(refs[2], undefined)).toBe(results[2]);
      expect(cache.get(refs[3], undefined)).toBe(results[3]);
    });

    it('should move accessed items to end (LRU behavior)', () => {
      const refs = [
        createMockDeclarationReference({ packageName: 'pkg1' }),
        createMockDeclarationReference({ packageName: 'pkg2' }),
        createMockDeclarationReference({ packageName: 'pkg3' }),
        createMockDeclarationReference({ packageName: 'pkg4' }),
      ];

      const results = refs.map((_, i) => ({
        resolvedApiItem: createMockApiItem({ displayName: `Item${i}` }),
        errorMessage: undefined,
      }));

      // Fill cache
      cache.set(refs[0], undefined, results[0]);
      cache.set(refs[1], undefined, results[1]);
      cache.set(refs[2], undefined, results[2]);

      // Access refs[0] - should move to end
      cache.get(refs[0], undefined);

      // Add new item - should evict refs[1] (now oldest)
      cache.set(refs[3], undefined, results[3]);

      expect(cache.get(refs[0], undefined)).toBe(results[0]); // Kept (recently accessed)
      expect(cache.get(refs[1], undefined)).toBeUndefined(); // Evicted (oldest)
      expect(cache.get(refs[2], undefined)).toBe(results[2]); // Kept
      expect(cache.get(refs[3], undefined)).toBe(results[3]); // New
    });

    it('should not evict if item already exists', () => {
      const refs = [
        createMockDeclarationReference({ packageName: 'pkg1' }),
        createMockDeclarationReference({ packageName: 'pkg2' }),
        createMockDeclarationReference({ packageName: 'pkg3' }),
      ];

      const results = refs.map((_, i) => ({
        resolvedApiItem: createMockApiItem({ displayName: `Item${i}` }),
        errorMessage: undefined,
      }));

      // Fill cache
      cache.set(refs[0], undefined, results[0]);
      cache.set(refs[1], undefined, results[1]);
      cache.set(refs[2], undefined, results[2]);

      // Update existing item - should not evict anything
      const updatedResult = {
        resolvedApiItem: createMockApiItem({ displayName: 'UpdatedItem0' }),
        errorMessage: undefined,
      };
      cache.set(refs[0], undefined, updatedResult);

      const stats = cache.getStats();
      expect(stats.size).toBe(3);
      expect(cache.get(refs[0], undefined)).toBe(updatedResult);
    });
  });

  describe('Statistics Tracking', () => {
    it('should track cache hits and misses', () => {
      const ref = createMockDeclarationReference({ packageName: 'test-pkg' });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      // Initial stats
      let stats = cache.getStats();
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0);

      // Miss
      cache.get(ref, undefined);
      stats = cache.getStats();
      expect(stats.missCount).toBe(1);

      // Set and hit
      cache.set(ref, undefined, result);
      cache.get(ref, undefined);
      stats = cache.getStats();
      expect(stats.hitCount).toBe(1);
    });

    it('should calculate hit rate correctly', () => {
      const refs = [
        createMockDeclarationReference({ packageName: 'pkg1' }),
        createMockDeclarationReference({ packageName: 'pkg2' }),
      ];
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(refs[0], undefined, result);

      // 1 hit, 1 miss = 50% hit rate
      cache.get(refs[0], undefined); // Hit
      cache.get(refs[1], undefined); // Miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.5);
    });

    it('should return valid cache statistics', () => {
      const stats = cache.getStats();
      assertValidCacheStats(stats);
    });

    it('should track cache size correctly', () => {
      const ref = createMockDeclarationReference({ packageName: 'test-pkg' });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      expect(cache.getStats().size).toBe(0);

      cache.set(ref, undefined, result);
      expect(cache.getStats().size).toBe(1);
    });
  });

  describe('Cache Clear', () => {
    it('should clear all cached items', () => {
      const ref1 = createMockDeclarationReference({ packageName: 'pkg1' });
      const ref2 = createMockDeclarationReference({ packageName: 'pkg2' });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref1, undefined, result);
      cache.set(ref2, undefined, result);

      expect(cache.getStats().size).toBe(2);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.get(ref1, undefined)).toBeUndefined();
      expect(cache.get(ref2, undefined)).toBeUndefined();
    });

    it('should reset statistics on clear', () => {
      const ref = createMockDeclarationReference({ packageName: 'test-pkg' });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, undefined, result);
      cache.get(ref, undefined); // Hit

      let stats = cache.getStats();
      expect(stats.hitCount).toBeGreaterThan(0);

      cache.clear();

      stats = cache.getStats();
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0);
    });
  });

  describe('Disabled Cache', () => {
    it('should not cache when disabled', () => {
      const disabledCache = new ApiResolutionCache({ enabled: false });
      const ref = createMockDeclarationReference({ packageName: 'test-pkg' });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      disabledCache.set(ref, undefined, result);
      const retrieved = disabledCache.get(ref, undefined);

      expect(retrieved).toBeUndefined();
      expect(disabledCache.getStats().size).toBe(0);
    });

    it('should report enabled status in stats', () => {
      const enabledCache = new ApiResolutionCache({ enabled: true });
      const disabledCache = new ApiResolutionCache({ enabled: false });

      expect(enabledCache.getStats().enabled).toBe(true);
      expect(disabledCache.getStats().enabled).toBe(false);
    });
  });

  describe('Cached Resolver Wrapper', () => {
    it('should wrap resolver function with caching', () => {
      let callCount = 0;
      const mockResolver = (ref: any, context?: any) => {
        callCount++;
        return { resolvedApiItem: createMockApiItem(), errorMessage: undefined };
      };

      const cachedResolver = cache.createCachedResolver(mockResolver);
      const ref = createMockDeclarationReference({ packageName: 'test-pkg' });

      // First call - should invoke resolver
      cachedResolver(ref, undefined);
      expect(callCount).toBe(1);

      // Second call - should use cache
      cachedResolver(ref, undefined);
      expect(callCount).toBe(1); // Not incremented

      const stats = cache.getStats();
      expect(stats.hitCount).toBe(1);
    });

    it('should cache different resolutions separately', () => {
      let callCount = 0;
      const mockResolver = (ref: any, context?: any) => {
        callCount++;
        return {
          resolvedApiItem: createMockApiItem({ displayName: `Item${callCount}` }),
          errorMessage: undefined,
        };
      };

      const cachedResolver = cache.createCachedResolver(mockResolver);
      const ref1 = createMockDeclarationReference({ packageName: 'pkg1' });
      const ref2 = createMockDeclarationReference({ packageName: 'pkg2' });

      cachedResolver(ref1, undefined);
      cachedResolver(ref2, undefined);
      cachedResolver(ref1, undefined); // Cache hit
      cachedResolver(ref2, undefined); // Cache hit

      expect(callCount).toBe(2); // Only called twice (once per ref)
    });
  });

  describe('Edge Cases', () => {
    it('should handle null context', () => {
      const ref = createMockDeclarationReference({ packageName: 'test' });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, null as any, result);
      expect(cache.get(ref, null as any)).toBe(result);
    });

    it('should handle undefined context', () => {
      const ref = createMockDeclarationReference({ packageName: 'test' });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, undefined, result);
      expect(cache.get(ref, undefined)).toBe(result);
    });

    it('should handle very long package names', () => {
      const longPackageName = 'a'.repeat(1000);
      const ref = createMockDeclarationReference({ packageName: longPackageName });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, undefined, result);
      expect(cache.get(ref, undefined)).toBe(result);
    });

    it('should handle many member references', () => {
      const memberReferences = Array.from({ length: 100 }, (_, i) => ({ name: `Member${i}` }));
      const ref = createMockDeclarationReference({
        packageName: 'test',
        memberReferences,
      });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, undefined, result);
      expect(cache.get(ref, undefined)).toBe(result);
    });

    it('should handle special characters in package names', () => {
      const ref = createMockDeclarationReference({ packageName: '@scope/package-name' });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, undefined, result);
      expect(cache.get(ref, undefined)).toBe(result);
    });

    it('should handle special characters in member names', () => {
      const ref = createMockDeclarationReference({
        packageName: 'test',
        memberReferences: [{ name: 'Member_$123' }],
      });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, undefined, result);
      expect(cache.get(ref, undefined)).toBe(result);
    });

    it('should handle rapid cache operations', () => {
      for (let i = 0; i < 100; i++) {
        const ref = createMockDeclarationReference({ packageName: `pkg${i}` });
        const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };
        cache.set(ref, undefined, result);
        expect(cache.get(ref, undefined)).toBe(result);
      }
    });

    it('should handle resolution with error messages', () => {
      const ref = createMockDeclarationReference({ packageName: 'test' });
      const result = { resolvedApiItem: undefined, errorMessage: 'Resolution failed' };

      cache.set(ref, undefined, result);
      expect(cache.get(ref, undefined)).toBe(result);
    });

    it('should cache both successful and failed resolutions', () => {
      const ref1 = createMockDeclarationReference({ packageName: 'pkg1' });
      const ref2 = createMockDeclarationReference({ packageName: 'pkg2' });

      const success = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };
      const failure = { resolvedApiItem: undefined, errorMessage: 'Failed' };

      cache.set(ref1, undefined, success);
      cache.set(ref2, undefined, failure);

      expect(cache.get(ref1, undefined)).toBe(success);
      expect(cache.get(ref2, undefined)).toBe(failure);
    });

    it('should handle context with complex structure', () => {
      const ref = createMockDeclarationReference({ packageName: 'test' });
      const complexContext = createMockApiItem({
        displayName: 'ComplexContext',
        kind: 'class',
        members: ['member1', 'member2'],
      });
      const result = { resolvedApiItem: createMockApiItem(), errorMessage: undefined };

      cache.set(ref, complexContext, result);
      expect(cache.get(ref, complexContext)).toBe(result);
    });
  });
});
