/**
 * Tests for PageLink component - Path Construction
 *
 * These tests verify the path construction logic that converts
 * page identifiers to proper paths with leading slashes.
 */

import { describe, it, expect } from 'vitest';

/**
 * Helper: Extract path construction logic from PageLink component
 * This is the core logic that converts PageId to path
 */
function constructPagePath(target: string): string | null {
  // Input validation (same as PageLink component)
  if (!target || typeof target !== 'string') {
    return null; // Invalid input
  }

  // Generate path - prefix with / if not already there
  let path = target;
  if (!path.startsWith('/')) {
    path = `/${target}`;
  }

  return path;
}

describe('PageLink - Path Construction', () => {
  describe('valid PageId formats', () => {
    it('should add leading slash to simple page name', () => {
      const path = constructPagePath('introduction');

      expect(path).toBe('/introduction');
    });

    it('should handle nested paths', () => {
      const path = constructPagePath('components/type-tree');

      expect(path).toBe('/components/type-tree');
    });

    it('should handle deeply nested paths', () => {
      const path = constructPagePath('docs/api/reference/classes');

      expect(path).toBe('/docs/api/reference/classes');
    });

    it('should not add double slash if already starts with /', () => {
      const path = constructPagePath('/already-prefixed');

      expect(path).toBe('/already-prefixed');
      expect(path).not.toMatch(/^\/\//); // No double slash
    });

    it('should handle path with leading slash and nesting', () => {
      const path = constructPagePath('/docs/getting-started');

      expect(path).toBe('/docs/getting-started');
      expect(path).not.toMatch(/^\/\//);
    });
  });

  describe('edge cases', () => {
    it('should return null for empty string', () => {
      const path = constructPagePath('');

      expect(path).toBeNull();
    });

    it('should return null for null input', () => {
      const path = constructPagePath(null as any);

      expect(path).toBeNull();
    });

    it('should return null for undefined input', () => {
      const path = constructPagePath(undefined as any);

      expect(path).toBeNull();
    });

    it('should return null for non-string input', () => {
      const path = constructPagePath(123 as any);

      expect(path).toBeNull();
    });

    it('should handle single slash', () => {
      const path = constructPagePath('/');

      expect(path).toBe('/');
    });

    it('should handle root path', () => {
      const path = constructPagePath('index');

      expect(path).toBe('/index');
    });
  });

  describe('special characters in PageId', () => {
    it('should handle hyphens in path', () => {
      const path = constructPagePath('getting-started');

      expect(path).toBe('/getting-started');
    });

    it('should handle underscores in path', () => {
      const path = constructPagePath('api_reference');

      expect(path).toBe('/api_reference');
    });

    it('should handle numbers in path', () => {
      const path = constructPagePath('v1/api');

      expect(path).toBe('/v1/api');
    });

    it('should handle mixed naming conventions', () => {
      const path = constructPagePath('docs/v2/API_Reference/getting-started');

      expect(path).toBe('/docs/v2/API_Reference/getting-started');
    });

    it('should handle dots in path (file extensions)', () => {
      const path = constructPagePath('changelog.md');

      expect(path).toBe('/changelog.md');
    });
  });

  describe('realistic page paths', () => {
    it('should handle typical doc page', () => {
      const path = constructPagePath('introduction');

      expect(path).toBe('/introduction');
    });

    it('should handle component documentation', () => {
      const path = constructPagePath('components/type-tree');

      expect(path).toBe('/components/type-tree');
    });

    it('should handle API reference paths', () => {
      const path = constructPagePath('api/markdown-documenter');

      expect(path).toBe('/api/markdown-documenter');
    });

    it('should handle guide sections', () => {
      const path = constructPagePath('guides/getting-started/installation');

      expect(path).toBe('/guides/getting-started/installation');
    });
  });

  describe('path consistency', () => {
    it('should always start with /', () => {
      const paths = [
        constructPagePath('simple'),
        constructPagePath('nested/path'),
        constructPagePath('deeply/nested/path'),
      ];

      paths.forEach(path => {
        expect(path).toMatch(/^\//);
      });
    });

    it('should never have double slash at start', () => {
      const inputs = [
        'simple',
        '/already-prefixed',
        'nested/path',
        '/nested/path'
      ];

      inputs.forEach(input => {
        const path = constructPagePath(input);
        if (path) {
          expect(path).not.toMatch(/^\/\//);
        }
      });
    });

    it('should preserve trailing slashes if present', () => {
      const path = constructPagePath('docs/');

      expect(path).toBe('/docs/');
    });

    it('should preserve multiple slashes in middle of path', () => {
      // This is questionable behavior, but documenting current implementation
      const path = constructPagePath('docs//nested');

      expect(path).toBe('/docs//nested');
      // Note: We might want to normalize this in the future
    });
  });

  describe('Mintlify navigation patterns', () => {
    it('should match Mintlify docs.json page format', () => {
      // Typical Mintlify navigation items
      const testCases = [
        { input: 'introduction', expected: '/introduction' },
        { input: 'quickstart', expected: '/quickstart' },
        { input: 'api-reference/overview', expected: '/api-reference/overview' },
        { input: 'components/type-tree', expected: '/components/type-tree' }
      ];

      testCases.forEach(({ input, expected }) => {
        const actual = constructPagePath(input);
        expect(actual).toBe(expected);
      });
    });

    it('should handle tab-based navigation paths', () => {
      // When using tabs in Mintlify
      const paths = [
        constructPagePath('api/classes/markdown-documenter'),
        constructPagePath('api/interfaces/config-options'),
        constructPagePath('guides/installation')
      ];

      paths.forEach(path => {
        expect(path).toMatch(/^\//);
        expect(path).not.toMatch(/^\/\//);
      });
    });
  });
});

describe('PageLink - Integration Scenarios', () => {
  it('should handle paths from navigation generation', () => {
    // Real examples that would come from docs.json
    const testCases = [
      {
        input: 'reference/markdown-documenter',
        expected: '/reference/markdown-documenter'
      },
      {
        input: 'reference/api-documenter-command-line',
        expected: '/reference/api-documenter-command-line'
      },
      {
        input: 'components/preview',
        expected: '/components/preview'
      }
    ];

    testCases.forEach(({ input, expected }) => {
      const actual = constructPagePath(input);
      expect(actual).toBe(expected);
    });
  });

  it('should be idempotent for already-prefixed paths', () => {
    const input = '/docs/getting-started';
    const path1 = constructPagePath(input);
    const path2 = constructPagePath(path1!);

    expect(path1).toBe(path2);
    expect(path1).toBe('/docs/getting-started');
  });
});
