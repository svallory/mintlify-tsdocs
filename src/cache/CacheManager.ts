/**
 * Centralized cache management for performance optimization
 */

import { createDebugger, type Debugger } from '../utils/debug';
import { TypeAnalysisCache, TypeAnalysisCacheOptions } from './TypeAnalysisCache';
import { ApiResolutionCache, ApiResolutionCacheOptions } from './ApiResolutionCache';

const debug: Debugger = createDebugger('cache');

/**
 * Configuration for all cache types
 */
export interface CacheManagerOptions {
  /**
   * Enable caching globally
   * @default true
   */
  enabled?: boolean;

  /**
   * Type analysis cache options
   */
  typeAnalysis?: TypeAnalysisCacheOptions;

  /**
   * API resolution cache options
   */
  apiResolution?: ApiResolutionCacheOptions;

  /**
   * Enable cache statistics reporting
   * @default false
   */
  enableStats?: boolean;
}

/**
 * Centralized cache manager for coordinating all caching operations
 *
 * This class manages all caching operations in mint-tsdocs. To understand how caching
 * fits into the overall architecture, check the {@link /architecture/caching-layer | Caching Layer}
 * documentation. The cache system includes {@link TypeAnalysisCache | type analysis caching}
 * and {@link ApiResolutionCache | API resolution caching}.
 *
 * @see /architecture/caching-layer - Caching architecture details
 */
export class CacheManager {
  private readonly _typeAnalysisCache: TypeAnalysisCache;
  private readonly _apiResolutionCache: ApiResolutionCache;
  private readonly _enabled: boolean;
  private readonly _enableStats: boolean;

  constructor(options: CacheManagerOptions = {}) {
    this._enabled = options.enabled ?? true;
    this._enableStats = options.enableStats ?? false;

    // Create individual caches with global enable/disable
    this._typeAnalysisCache = new TypeAnalysisCache({
      ...options.typeAnalysis,
      enabled: this._enabled && (options.typeAnalysis?.enabled ?? true)
    });

    this._apiResolutionCache = new ApiResolutionCache({
      ...options.apiResolution,
      enabled: this._enabled && (options.apiResolution?.enabled ?? true)
    });
  }

  /**
   * Get the type analysis cache
   */
  public get typeAnalysis(): TypeAnalysisCache {
    return this._typeAnalysisCache;
  }

  /**
   * Get the API resolution cache
   */
  public get apiResolution(): ApiResolutionCache {
    return this._apiResolutionCache;
  }

  /**
   * Clear all caches
   */
  public clearAll(): void {
    this._typeAnalysisCache.clear();
    this._apiResolutionCache.clear();
  }

  /**
   * Get statistics for all caches
   */
  public getStats(): {
    enabled: boolean;
    typeAnalysis: ReturnType<TypeAnalysisCache['getStats']>;
    apiResolution: ReturnType<ApiResolutionCache['getStats']>;
    totalHitRate: number;
  } {
    const typeAnalysisStats = this._typeAnalysisCache.getStats();
    const apiResolutionStats = this._apiResolutionCache.getStats();

    const totalRequests = typeAnalysisStats.hitCount + typeAnalysisStats.missCount +
                         apiResolutionStats.hitCount + apiResolutionStats.missCount;
    const totalHits = typeAnalysisStats.hitCount + apiResolutionStats.hitCount;
    const totalHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    return {
      enabled: this._enabled,
      typeAnalysis: typeAnalysisStats,
      apiResolution: apiResolutionStats,
      totalHitRate
    };
  }

  /**
   * Print cache statistics if enabled
   */
  public printStats(): void {
    if (!this._enableStats) {
      return;
    }

    const stats = this.getStats();
    debug.info('\n📊 Cache Statistics:');
    debug.info(`   Overall Hit Rate: ${(stats.totalHitRate * 100).toFixed(1)}%`);
    debug.info(`   Type Analysis Cache: ${stats.typeAnalysis.hitRate * 100}% hit rate (${stats.typeAnalysis.hitCount}/${stats.typeAnalysis.hitCount + stats.typeAnalysis.missCount})`);
    debug.info(`   API Resolution Cache: ${stats.apiResolution.hitRate * 100}% hit rate (${stats.apiResolution.hitCount}/${stats.apiResolution.hitCount + stats.apiResolution.missCount})`);
  }

  /**
   * Create a cache manager with default settings
   */
  public static createDefault(options: Partial<CacheManagerOptions> = {}): CacheManager {
    return new CacheManager({
      enabled: true,
      enableStats: true,
      typeAnalysis: {
        maxSize: 1000,
        enabled: true
      },
      apiResolution: {
        maxSize: 500,
        enabled: true
      },
      ...options
    });
  }

  /**
   * Create a cache manager optimized for development
   */
  public static createDevelopment(options: Partial<CacheManagerOptions> = {}): CacheManager {
    return new CacheManager({
      enabled: true,
      enableStats: true,
      typeAnalysis: {
        maxSize: 500,
        enabled: true
      },
      apiResolution: {
        maxSize: 200,
        enabled: true
      },
      ...options
    });
  }

  /**
   * Create a cache manager optimized for production
   */
  public static createProduction(options: Partial<CacheManagerOptions> = {}): CacheManager {
    return new CacheManager({
      enabled: true,
      enableStats: false,
      typeAnalysis: {
        maxSize: 2000,
        enabled: true
      },
      apiResolution: {
        maxSize: 1000,
        enabled: true
      },
      ...options
    });
  }
}

/**
 * Global cache manager instance
 */
let globalCacheManager: CacheManager | null = null;

/**
 * Get the global cache manager instance
 *
 * @param options - Cache configuration options (only used on first call)
 * @throws {Error} If options are provided after the global cache manager has already been initialized
 *
 * @remarks
 * The global cache manager is a singleton. Options can only be provided on the first call.
 * If you need to reconfigure, call {@link resetGlobalCacheManager} first, or create a
 * new instance with `new CacheManager(options)` instead.
 */
export function getGlobalCacheManager(options?: CacheManagerOptions): CacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new CacheManager(options);
  } else if (options) {
    throw new Error(
      'Global CacheManager already initialized with different options. ' +
      'Call resetGlobalCacheManager() first to reconfigure, or use new CacheManager(options) for a separate instance.'
    );
  }
  return globalCacheManager;
}

/**
 * Reset the global cache manager
 */
export function resetGlobalCacheManager(): void {
  globalCacheManager = null;
}