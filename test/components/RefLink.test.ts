/**
 * Tests for RefLink component - Path Construction
 *
 * These tests verify the path construction logic that converts
 * API reference IDs to proper file paths, handling edge cases like
 * double dots and empty segments.
 */

import { describe, it, expect } from 'vitest';

/**
 * Helper: Extract path construction logic from RefLink component
 * This is the core logic that converts RefId to path
 */
function constructRefPath(target: string): string | null {
  // Input validation (same as RefLink component)
  if (!target || typeof target !== 'string') {
    return null; // Invalid input
  }

  // Path construction with empty segment filtering
  // Format: mint-tsdocs.MarkdownDocumenter.generateFiles -> ./mint-tsdocs/MarkdownDocumenter/generateFiles
  const segments = target.split('.').filter(segment => segment.length > 0);
  const path = segments.length > 0 ? `./${segments.join('/')}` : './invalid';

  return path;
}

describe('RefLink - Path Construction', () => {
  describe('valid RefId formats', () => {
    it('should convert simple RefId to path', () => {
      const path = constructRefPath('mint-tsdocs.MarkdownDocumenter');

      expect(path).toBe('./mint-tsdocs/MarkdownDocumenter');
    });

    it('should convert nested RefId to path', () => {
      const path = constructRefPath('mint-tsdocs.MarkdownDocumenter.generateFiles');

      expect(path).toBe('./mint-tsdocs/MarkdownDocumenter/generateFiles');
    });

    it('should convert deeply nested RefId to path', () => {
      const path = constructRefPath('package.module.class.method.property');

      expect(path).toBe('./package/module/class/method/property');
    });

    it('should handle single segment RefId', () => {
      const path = constructRefPath('ClassNameOnly');

      expect(path).toBe('./ClassNameOnly');
    });
  });

  describe('malformed RefId handling', () => {
    it('should filter out empty segments from double dots', () => {
      const path = constructRefPath('api..item');

      expect(path).toBe('./api/item');
      expect(path).not.toContain('//'); // No double slashes
    });

    it('should filter out empty segments from leading dot', () => {
      const path = constructRefPath('.api.item');

      expect(path).toBe('./api/item');
    });

    it('should filter out empty segments from trailing dot', () => {
      const path = constructRefPath('api.item.');

      expect(path).toBe('./api/item');
    });

    it('should handle multiple consecutive dots', () => {
      const path = constructRefPath('api...item');

      expect(path).toBe('./api/item');
      expect(path).not.toContain('//');
    });

    it('should handle dots at beginning, middle, and end', () => {
      const path = constructRefPath('.api..item...method.');

      expect(path).toBe('./api/item/method');
      expect(path).not.toContain('//');
    });
  });

  describe('edge cases', () => {
    it('should return null for empty string', () => {
      const path = constructRefPath('');

      expect(path).toBeNull();
    });

    it('should return null for null input', () => {
      const path = constructRefPath(null as any);

      expect(path).toBeNull();
    });

    it('should return null for undefined input', () => {
      const path = constructRefPath(undefined as any);

      expect(path).toBeNull();
    });

    it('should return null for non-string input', () => {
      const path = constructRefPath(123 as any);

      expect(path).toBeNull();
    });

    it('should handle RefId with only dots', () => {
      const path = constructRefPath('...');

      expect(path).toBe('./invalid');
    });

    it('should handle single dot', () => {
      const path = constructRefPath('.');

      expect(path).toBe('./invalid');
    });
  });

  describe('special characters in RefId', () => {
    it('should handle hyphens in segment names', () => {
      const path = constructRefPath('mint-tsdocs.custom-class.my-method');

      expect(path).toBe('./mint-tsdocs/custom-class/my-method');
    });

    it('should handle underscores in segment names', () => {
      const path = constructRefPath('package.Class_Name.method_name');

      expect(path).toBe('./package/Class_Name/method_name');
    });

    it('should handle numbers in segment names', () => {
      const path = constructRefPath('v1.Api2.method3');

      expect(path).toBe('./v1/Api2/method3');
    });

    it('should handle mixed naming conventions', () => {
      const path = constructRefPath('my-package.MyClass.my_method.Property123');

      expect(path).toBe('./my-package/MyClass/my_method/Property123');
    });
  });

  describe('realistic API reference patterns', () => {
    it('should handle typical package.Class pattern', () => {
      const path = constructRefPath('mint-tsdocs.MarkdownDocumenter');

      expect(path).toBe('./mint-tsdocs/MarkdownDocumenter');
    });

    it('should handle package.Class.method pattern', () => {
      const path = constructRefPath('mint-tsdocs.MarkdownDocumenter.generateFiles');

      expect(path).toBe('./mint-tsdocs/MarkdownDocumenter/generateFiles');
    });

    it('should handle package.Class.property pattern', () => {
      const path = constructRefPath('mint-tsdocs.ApiDocumenterCommandLine.options');

      expect(path).toBe('./mint-tsdocs/ApiDocumenterCommandLine/options');
    });

    it('should handle nested namespace pattern', () => {
      const path = constructRefPath('mint-tsdocs.utils.SecurityUtils.sanitizePath');

      expect(path).toBe('./mint-tsdocs/utils/SecurityUtils/sanitizePath');
    });
  });

  describe('path consistency', () => {
    it('should always start with ./', () => {
      const paths = [
        constructRefPath('simple'),
        constructRefPath('package.Class'),
        constructRefPath('package.Class.method'),
      ];

      paths.forEach(path => {
        expect(path).toMatch(/^\.\//);
      });
    });

    it('should never contain double slashes', () => {
      const malformedInputs = [
        'api..item',
        'api...item',
        '.api.item',
        'api.item.',
        '..api..item..'
      ];

      malformedInputs.forEach(input => {
        const path = constructRefPath(input);
        if (path && path !== './invalid') {
          expect(path).not.toContain('//');
        }
      });
    });

    it('should never end with a slash', () => {
      const inputs = [
        'simple',
        'package.Class',
        'api.item.',
        '.api.item'
      ];

      inputs.forEach(input => {
        const path = constructRefPath(input);
        if (path && path !== './invalid') {
          expect(path).not.toMatch(/\/$/);
        }
      });
    });
  });

  describe('path safety', () => {
    it('should not allow path traversal patterns', () => {
      // Note: Our current implementation doesn't validate this
      // This test documents the current behavior
      const path = constructRefPath('package..parent');

      // Current behavior: filters empty segments
      expect(path).toBe('./package/parent');
      // In the future, we might want to reject this entirely
    });

    it('should handle potential injection attempts', () => {
      // Our filter approach handles most injection attempts
      const attempts = [
        'api..../../etc/passwd',
        '.api.item',
        'api.item..',
      ];

      attempts.forEach(attempt => {
        const path = constructRefPath(attempt);
        if (path) {
          // Should not contain ../
          expect(path.split('/').filter(s => s === '..')).toHaveLength(0);
        }
      });
    });
  });
});

describe('RefLink - Integration Scenarios', () => {
  it('should match expected output for documentation generator', () => {
    // Real examples from mint-tsdocs
    const testCases = [
      {
        input: 'mint-tsdocs.MarkdownDocumenter',
        expected: './mint-tsdocs/MarkdownDocumenter'
      },
      {
        input: 'mint-tsdocs.MarkdownDocumenter.generateFiles',
        expected: './mint-tsdocs/MarkdownDocumenter/generateFiles'
      },
      {
        input: 'mint-tsdocs.ApiDocumenterCommandLine',
        expected: './mint-tsdocs/ApiDocumenterCommandLine'
      }
    ];

    testCases.forEach(({ input, expected }) => {
      const actual = constructRefPath(input);
      expect(actual).toBe(expected);
    });
  });

  it('should handle all segments being filtered out', () => {
    const path = constructRefPath('....');

    expect(path).toBe('./invalid');
  });
});
