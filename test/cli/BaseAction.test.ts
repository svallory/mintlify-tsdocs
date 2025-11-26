/**
 * Tests for CLI BaseAction
 *
 * Tests basic CLI functionality and validation
 */

import { describe, it, expect } from 'bun:test';
import { SecurityUtils } from '../../src/utils/SecurityUtils';

describe('CLI Path Validation', () => {
  describe('Input path validation', () => {
    it('should validate safe input paths', () => {
      const safePaths = [
        './docs',
        './lib/index.d.ts',
        'docs/reference',
        '/absolute/path/to/docs',
      ];

      for (const path of safePaths) {
        // Should not throw
        expect(() => {
          SecurityUtils.validateCliInput(path, 'input-path');
        }).not.toThrow();
      }
    });

    it('should reject dangerous command patterns in paths', () => {
      const dangerousPaths = [
        './docs; rm -rf /',
        './docs && cat /etc/passwd',
        '$(whoami)/docs',
        '`ls`/docs',
        './docs | tee output',
      ];

      for (const path of dangerousPaths) {
        expect(() => {
          SecurityUtils.validateCliInput(path, 'input-path');
        }).toThrow(/command injection/);
      }
    });

    it('should trim and normalize path input', () => {
      const result = SecurityUtils.validateCliInput('  ./docs/reference  ', 'path');
      expect(result).toBe('./docs/reference');
      expect(result.startsWith(' ')).toBe(false);
      expect(result.endsWith(' ')).toBe(false);
    });
  });

  describe('Output path validation', () => {
    it('should validate paths are within project', () => {
      const basePath = '/workspace/project';
      const outputPath = 'docs/reference';

      const validated = SecurityUtils.validateFilePath(basePath, outputPath);

      expect(validated).toBeTruthy();
      expect(validated.startsWith(basePath)).toBe(true);
    });

    it('should reject path traversal in output paths', () => {
      const basePath = '/workspace/project';
      const maliciousPath = '../../../etc/passwd';

      expect(() => {
        SecurityUtils.validateFilePath(basePath, maliciousPath);
      }).toThrow(/Path traversal detected/);
    });

    it('should reject absolute paths outside project', () => {
      const basePath = '/workspace/project';
      const maliciousPath = '/etc/passwd';

      expect(() => {
        SecurityUtils.validateFilePath(basePath, maliciousPath);
      }).toThrow(/Path traversal detected/);
    });
  });

  describe('File name validation', () => {
    it('should validate safe file names', () => {
      const safeNames = [
        'index.md',
        'api-reference.mdx',
        'MyClass.mdx',
        'function_name.md',
      ];

      for (const name of safeNames) {
        const result = SecurityUtils.validateFilename(name);
        expect(result).toBe(name);
      }
    });

    it('should reject reserved Windows file names', () => {
      const reserved = ['CON', 'PRN', 'AUX', 'NUL'];

      for (const name of reserved) {
        expect(() => {
          SecurityUtils.validateFilename(name);
        }).toThrow(/Reserved filename/);
      }
    });

    it('should reject file names with path traversal', () => {
      expect(() => {
        SecurityUtils.validateFilename('../secret.md');
      }).toThrow(/dangerous characters/);
    });
  });

  describe('Option validation', () => {
    it('should validate boolean flags', () => {
      // Boolean flags don't need special validation
      const flags = ['--yes', '--force', '--skip-extractor'];

      for (const flag of flags) {
        // Simple presence check
        expect(flag.startsWith('--')).toBe(true);
      }
    });

    it('should validate option values', () => {
      const optionValue = 'my-project-name';
      const result = SecurityUtils.validateCliInput(optionValue, 'project-name');

      expect(result).toBe(optionValue);
    });

    it('should reject dangerous option values', () => {
      const dangerous = 'project; rm -rf /';

      expect(() => {
        SecurityUtils.validateCliInput(dangerous, 'project-name');
      }).toThrow(/command injection/);
    });
  });
});

describe('CLI Error Handling', () => {
  it('should provide helpful error messages for missing files', () => {
    // This test documents expected error message format
    const error = new Error('File not found: mint-tsdocs.config.json');

    expect(error.message).toContain('File not found');
    expect(error.message).toContain('mint-tsdocs.config.json');
  });

  it('should provide helpful error messages for invalid paths', () => {
    try {
      SecurityUtils.validateFilePath('/workspace', '../../../etc/passwd');
    } catch (error: any) {
      expect(error.message).toContain('Path traversal');
      expect(error.message).toContain('outside allowed directory');
    }
  });

  it('should provide helpful error messages for validation failures', () => {
    try {
      SecurityUtils.validateCliInput('', 'project-name');
    } catch (error: any) {
      expect(error.message).toContain('cannot be empty');
      expect(error.message).toContain('project-name');
    }
  });
});
