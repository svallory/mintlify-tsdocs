/**
 * Tests for SecurityUtils
 *
 * These tests verify critical security controls for:
 * - Path traversal prevention
 * - Command injection prevention
 * - Input validation
 * - Content sanitization
 */

import { describe, it, expect } from 'vitest';
import { SecurityUtils } from '../../src/utils/SecurityUtils';
import {
  samplePaths,
  sampleCliInputs,
  sampleYamlContent,
  sampleJsxAttributes,
  sampleJsonContent,
} from '../helpers/fixtures';
import { assertErrorMessage, assertSanitizedYaml, assertSanitizedJsx } from '../helpers/assertions';
import * as path from 'path';

describe('SecurityUtils', () => {
  describe('validateFilePath', () => {
    const basePath = '/workspace/docs';

    it('should allow valid paths within base directory', () => {
      const validPath = 'reference/api/index.mdx';
      const result = SecurityUtils.validateFilePath(basePath, validPath);

      expect(result).toBeTruthy();
      expect(result.startsWith(basePath)).toBe(true);
    });

    it('should allow nested paths within base directory', () => {
      const validPath = 'reference/api/classes/MyClass.mdx';
      const result = SecurityUtils.validateFilePath(basePath, validPath);

      expect(result).toBeTruthy();
      expect(result.startsWith(basePath)).toBe(true);
    });

    it('should reject path traversal with ../', () => {
      const maliciousPath = '../../../etc/passwd';

      expect(() => {
        SecurityUtils.validateFilePath(basePath, maliciousPath);
      }).toThrow(/Path traversal detected/);
    });

    it('should reject absolute paths outside base directory', () => {
      const maliciousPath = '/etc/passwd';

      expect(() => {
        SecurityUtils.validateFilePath(basePath, maliciousPath);
      }).toThrow(/Path traversal detected/);
    });

    it('should reject paths that navigate out of base', () => {
      const maliciousPath = 'reference/../../../../../../etc/passwd';

      expect(() => {
        SecurityUtils.validateFilePath(basePath, maliciousPath);
      }).toThrow(/Path traversal detected/);
    });

    it('should handle relative paths correctly', () => {
      const relativePath = './reference/api/index.mdx';
      const result = SecurityUtils.validateFilePath(basePath, relativePath);

      expect(result).toBeTruthy();
      expect(result.startsWith(basePath)).toBe(true);
    });

    it('should resolve to absolute path', () => {
      const relativePath = 'reference/api/index.mdx';
      const result = SecurityUtils.validateFilePath(basePath, relativePath);

      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe('validateFilename', () => {
    it('should allow valid filenames', () => {
      const validNames = [
        'document.md',
        'api-reference.mdx',
        'MyClass.mdx',
        'index.tsx',
        'file_with_underscores.ts',
      ];

      for (const name of validNames) {
        const result = SecurityUtils.validateFilename(name);
        expect(result).toBe(name);
      }
    });

    it('should reject empty filenames', () => {
      expect(() => {
        SecurityUtils.validateFilename('');
      }).toThrow(/cannot be empty/);

      expect(() => {
        SecurityUtils.validateFilename('   ');
      }).toThrow(/cannot be empty/);
    });

    it('should reject reserved Windows filenames', () => {
      const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];

      for (const name of reservedNames) {
        expect(() => {
          SecurityUtils.validateFilename(name);
        }).toThrow(/Reserved filename detected/);
      }
    });

    it('should reject path traversal in filename', () => {
      expect(() => {
        SecurityUtils.validateFilename('../../../passwd');
      }).toThrow(/dangerous characters/);

      expect(() => {
        SecurityUtils.validateFilename('~/secret');
      }).toThrow(/dangerous characters/);
    });

    it('should reject filenames over 255 characters', () => {
      const longName = 'a'.repeat(256) + '.md';

      expect(() => {
        SecurityUtils.validateFilename(longName);
      }).toThrow(/too long/);
    });

    it('should strip path components from filename', () => {
      const result = SecurityUtils.validateFilename('/path/to/file.md');
      expect(result).toBe('file.md');
    });

    it('should reject filenames starting with /', () => {
      expect(() => {
        SecurityUtils.validateFilename('/root');
      }).toThrow(/dangerous characters/);
    });
  });

  describe('validateCliInput', () => {
    it('should allow safe CLI input', () => {
      const safeInputs = [
        './docs',
        'my-project',
        '--output ./docs',
        'path/to/file',
      ];

      for (const input of safeInputs) {
        const result = SecurityUtils.validateCliInput(input, 'test-param');
        expect(result).toBeTruthy();
      }
    });

    it('should trim whitespace', () => {
      const result = SecurityUtils.validateCliInput('  ./docs  ', 'path');
      expect(result).toBe('./docs');
    });

    it('should reject empty input', () => {
      expect(() => {
        SecurityUtils.validateCliInput('', 'test-param');
      }).toThrow(/cannot be empty/);

      expect(() => {
        SecurityUtils.validateCliInput('   ', 'test-param');
      }).toThrow(/cannot be empty/);
    });

    it('should reject command injection with semicolons', () => {
      expect(() => {
        SecurityUtils.validateCliInput('./docs; rm -rf /', 'path');
      }).toThrow(/command injection/);
    });

    it('should reject command injection with pipes', () => {
      expect(() => {
        SecurityUtils.validateCliInput('./docs | cat', 'path');
      }).toThrow(/command injection/);
    });

    it('should reject command substitution with $()', () => {
      expect(() => {
        SecurityUtils.validateCliInput('$(whoami)', 'command');
      }).toThrow(/command injection/);
    });

    it('should reject command substitution with backticks', () => {
      expect(() => {
        SecurityUtils.validateCliInput('`cat /etc/passwd`', 'command');
      }).toThrow(/command injection/);
    });

    it('should reject input with newlines', () => {
      expect(() => {
        SecurityUtils.validateCliInput('./docs\nrm -rf /', 'path');
      }).toThrow(/command injection/);
    });

    it('should reject input that is too long', () => {
      const longInput = 'a'.repeat(1001);

      expect(() => {
        SecurityUtils.validateCliInput(longInput, 'param');
      }).toThrow(/too long/);
    });

    it('should reject input with ampersands', () => {
      expect(() => {
        SecurityUtils.validateCliInput('./docs && rm file', 'path');
      }).toThrow(/command injection/);
    });

    it('should reject input with redirection', () => {
      expect(() => {
        SecurityUtils.validateCliInput('./docs > /tmp/output', 'path');
      }).toThrow(/command injection/);
    });
  });

  describe('sanitizeYamlText', () => {
    it('should return empty string for empty input', () => {
      const result = SecurityUtils.sanitizeYamlText('');
      expect(result).toBe('');
    });

    it('should pass through simple text unchanged', () => {
      const result = SecurityUtils.sanitizeYamlText('Simple description');
      expect(result).toBe('Simple description');
    });

    it('should escape double quotes', () => {
      const result = SecurityUtils.sanitizeYamlText('Text with "quotes"');
      expect(result).toContain('\\"');
    });

    it('should escape single quotes', () => {
      const result = SecurityUtils.sanitizeYamlText("Text with 'quotes'");
      expect(result).toContain("\\'");
    });

    it('should escape newlines', () => {
      const result = SecurityUtils.sanitizeYamlText('Line 1\nLine 2');
      expect(result).toContain('\\n');
      expect(result).not.toContain('\n');
    });

    it('should escape backslashes', () => {
      const result = SecurityUtils.sanitizeYamlText('Path\\to\\file');
      expect(result).toContain('\\\\');
    });

    it('should wrap text starting with special chars in quotes', () => {
      const specialStarts = ['-', '?', ':', '#', '&', '*', '!', '|', '>', "'", '"', '%', '@', '`'];

      for (const char of specialStarts) {
        const result = SecurityUtils.sanitizeYamlText(`${char}text`);
        expect(result.startsWith('"')).toBe(true);
        expect(result.endsWith('"')).toBe(true);
      }
    });

    it('should wrap text with colons in quotes', () => {
      const result = SecurityUtils.sanitizeYamlText('Key: value');
      expect(result.startsWith('"')).toBe(true);
    });

    it('should handle complex YAML-problematic content', () => {
      const result = SecurityUtils.sanitizeYamlText('- Item with "quotes" and: colons\nand newlines');
      assertSanitizedYaml(result, sampleYamlContent.specialChars);
    });
  });

  describe('sanitizeJsxAttribute', () => {
    it('should return empty string for empty input', () => {
      const result = SecurityUtils.sanitizeJsxAttribute('');
      expect(result).toBe('');
    });

    it('should escape HTML entities', () => {
      const result = SecurityUtils.sanitizeJsxAttribute('Hello <world> & "friends"');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });

    it('should escape single quotes', () => {
      const result = SecurityUtils.sanitizeJsxAttribute("It's a test");
      expect(result).toContain('&#x27;');
    });

    it('should reject javascript: URLs in href attribute', () => {
      expect(() => {
        SecurityUtils.sanitizeJsxAttribute('javascript:alert(1)', 'href');
      }).toThrow(/Dangerous protocol/);
    });

    it('should reject javascript: URLs in src attribute', () => {
      expect(() => {
        SecurityUtils.sanitizeJsxAttribute('javascript:void(0)', 'src');
      }).toThrow(/Dangerous protocol/);
    });

    it('should reject data: URLs in href attribute', () => {
      expect(() => {
        SecurityUtils.sanitizeJsxAttribute('data:text/html,<script>alert(1)</script>', 'href');
      }).toThrow(/Dangerous protocol/);
    });

    it('should reject vbscript: URLs', () => {
      expect(() => {
        SecurityUtils.sanitizeJsxAttribute('vbscript:msgbox(1)', 'href');
      }).toThrow(/Dangerous protocol/);
    });

    it('should reject file: URLs', () => {
      expect(() => {
        SecurityUtils.sanitizeJsxAttribute('file:///etc/passwd', 'href');
      }).toThrow(/Dangerous protocol/);
    });

    it('should allow safe URLs in href', () => {
      const safeUrls = [
        'https://example.com',
        'http://example.com',
        '/relative/path',
        './relative/path',
        '#anchor',
        'mailto:user@example.com',
      ];

      for (const url of safeUrls) {
        const result = SecurityUtils.sanitizeJsxAttribute(url, 'href');
        expect(result).toBeTruthy();
      }
    });

    it('should allow safe content in non-URL attributes', () => {
      const result = SecurityUtils.sanitizeJsxAttribute('Click here', 'title');
      expect(result).toBe('Click here');
    });

    it('should handle whitespace in dangerous URLs', () => {
      expect(() => {
        SecurityUtils.sanitizeJsxAttribute('  javascript:alert(1)  ', 'href');
      }).toThrow(/Dangerous protocol/);
    });
  });

  describe('sanitizeJsonForJsx', () => {
    it('should serialize and escape JSON data', () => {
      const data = { name: 'test', value: 123 };
      const result = SecurityUtils.sanitizeJsonForJsx(data);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should escape ampersands as Unicode', () => {
      const data = { text: 'Tom & Jerry' };
      const result = SecurityUtils.sanitizeJsonForJsx(data);

      expect(result).toContain('\\u0026');
      expect(result).not.toMatch(/&(?!#)/);
    });

    it('should escape less-than as Unicode', () => {
      const data = { comparison: 'x < y' };
      const result = SecurityUtils.sanitizeJsonForJsx(data);

      expect(result).toContain('\\u003c');
    });

    it('should escape greater-than as Unicode', () => {
      const data = { comparison: 'x > y' };
      const result = SecurityUtils.sanitizeJsonForJsx(data);

      expect(result).toContain('\\u003e');
    });

    it('should handle arrays', () => {
      const data = [1, 2, 3];
      const result = SecurityUtils.sanitizeJsonForJsx(data);

      expect(result).toBeTruthy();
      expect(result.startsWith('[')).toBe(true);
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'John',
          address: { city: 'NYC' }
        }
      };
      const result = SecurityUtils.sanitizeJsonForJsx(data);

      expect(result).toBeTruthy();
    });

    it('should throw on circular references', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      expect(() => {
        SecurityUtils.sanitizeJsonForJsx(circular);
      }).toThrow();
    });
  });

  describe('validateJsonContent', () => {
    it('should accept valid JSON objects', () => {
      const result = SecurityUtils.validateJsonContent('{"name": "test", "value": 123}');
      expect(result).toBeTruthy();
    });

    it('should accept valid JSON arrays', () => {
      const result = SecurityUtils.validateJsonContent('[1, 2, 3]');
      expect(result).toBeTruthy();
    });

    it('should trim whitespace', () => {
      const result = SecurityUtils.validateJsonContent('  {"name": "test"}  ');
      expect(result).toBe('{"name": "test"}');
    });

    it('should reject empty input', () => {
      expect(() => {
        SecurityUtils.validateJsonContent('');
      }).toThrow(/cannot be empty/);
    });

    it('should reject non-JSON content', () => {
      expect(() => {
        SecurityUtils.validateJsonContent('not json at all');
      }).toThrow(/must start with/);
    });

    it('should reject JSON not starting with { or [', () => {
      expect(() => {
        SecurityUtils.validateJsonContent('"string"');
      }).toThrow(/must start with/);
    });

    it('should reject JSON not ending with } or ]', () => {
      expect(() => {
        SecurityUtils.validateJsonContent('{"incomplete": ');
      }).toThrow(/must end with/);
    });

    it('should reject __proto__ pollution attempts', () => {
      expect(() => {
        SecurityUtils.validateJsonContent('{"__proto__": {"polluted": true}}');
      }).toThrow(/dangerous patterns/);
    });

    it('should reject eval() patterns', () => {
      expect(() => {
        SecurityUtils.validateJsonContent('{"code": "eval(malicious)"}');
      }).toThrow(/dangerous patterns/);
    });

    it('should reject Function() patterns', () => {
      expect(() => {
        SecurityUtils.validateJsonContent('{"code": "Function(malicious)"}');
      }).toThrow(/dangerous patterns/);
    });

    it('should reject setTimeout patterns', () => {
      expect(() => {
        SecurityUtils.validateJsonContent('{"code": "setTimeout(bad)"}');
      }).toThrow(/dangerous patterns/);
    });

    it('should reject setInterval patterns', () => {
      expect(() => {
        SecurityUtils.validateJsonContent('{"code": "setInterval(bad)"}');
      }).toThrow(/dangerous patterns/);
    });

    it('should allow constructor and prototype as legitimate keys', () => {
      // These are legitimate in API documentation
      const result1 = SecurityUtils.validateJsonContent('{"constructor": "MyClass"}');
      const result2 = SecurityUtils.validateJsonContent('{"prototype": "Object"}');

      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
    });

    it('should reject JSON over 10MB', () => {
      const largeJson = `{"data": "${'x'.repeat(11 * 1024 * 1024)}"}`;

      expect(() => {
        SecurityUtils.validateJsonContent(largeJson);
      }).toThrow(/too large/);
    });

    it('should handle complex valid JSON', () => {
      const complexJson = JSON.stringify({
        name: 'TestAPI',
        methods: [
          { name: 'get', params: ['id'] },
          { name: 'set', params: ['id', 'value'] }
        ],
        metadata: {
          version: '1.0',
          author: 'Test'
        }
      });

      const result = SecurityUtils.validateJsonContent(complexJson);
      expect(result).toBeTruthy();
    });
  });

  describe('parseJsonSafe', () => {
    it('should parse valid JSON objects', () => {
      const json = '{"name": "test", "value": 123}';
      const result = SecurityUtils.parseJsonSafe(json);

      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should parse valid JSON arrays', () => {
      const json = '[1, 2, 3, "test"]';
      const result = SecurityUtils.parseJsonSafe(json);

      expect(result).toEqual([1, 2, 3, 'test']);
    });

    it('should filter out __proto__ keys', () => {
      const json = '{"name": "test", "__proto__": {"polluted": true}}';
      const result = SecurityUtils.parseJsonSafe(json);

      expect(result).toEqual({ name: 'test' });
      expect(result.__proto__).toBe(Object.prototype); // Should be default prototype, not polluted
    });

    it('should filter out constructor keys', () => {
      const json = '{"name": "test", "constructor": {"polluted": true}}';
      const result = SecurityUtils.parseJsonSafe(json);

      expect(result).toEqual({ name: 'test' });
      expect(result.constructor).toBe(Object); // Should be default constructor
    });

    it('should filter out prototype keys', () => {
      const json = '{"name": "test", "prototype": {"polluted": true}}';
      const result = SecurityUtils.parseJsonSafe(json);

      expect(result).toEqual({ name: 'test' });
    });

    it('should filter dangerous keys in nested objects', () => {
      const json = '{"data": {"__proto__": {"evil": true}, "value": 42}}';
      const result = SecurityUtils.parseJsonSafe(json);

      expect(result).toEqual({ data: { value: 42 } });
    });

    it('should handle arrays with nested objects containing dangerous keys', () => {
      const json = '[{"name": "test", "__proto__": {"bad": true}}, {"value": 123}]';
      const result = SecurityUtils.parseJsonSafe(json);

      expect(result).toEqual([{ name: 'test' }, { value: 123 }]);
    });

    it('should preserve legitimate data while filtering dangerous keys', () => {
      const json = '{"name": "API", "version": "1.0", "__proto__": {"hack": true}, "methods": ["get", "set"]}';
      const result = SecurityUtils.parseJsonSafe(json);

      expect(result).toEqual({
        name: 'API',
        version: '1.0',
        methods: ['get', 'set']
      });
    });

    it('should work with TypeScript generic types', () => {
      interface TestConfig {
        name: string;
        value: number;
      }

      const json = '{"name": "test", "value": 42}';
      const result = SecurityUtils.parseJsonSafe<TestConfig>(json);

      expect(result.name).toBe('test');
      expect(result.value).toBe(42);
    });

    it('should throw on malformed JSON', () => {
      const malformedJson = '{invalid json}';

      expect(() => {
        SecurityUtils.parseJsonSafe(malformedJson);
      }).toThrow();
    });

    it('should handle empty objects', () => {
      const json = '{}';
      const result = SecurityUtils.parseJsonSafe(json);

      expect(result).toEqual({});
    });

    it('should handle empty arrays', () => {
      const json = '[]';
      const result = SecurityUtils.parseJsonSafe(json);

      expect(result).toEqual([]);
    });

    it('should handle complex nested structures with pollution attempts', () => {
      const json = JSON.stringify({
        config: {
          name: 'test',
          __proto__: { evil: true },
          settings: {
            value: 42,
            constructor: { bad: true },
            nested: {
              prototype: { worse: true },
              data: 'legitimate'
            }
          }
        }
      });

      const result = SecurityUtils.parseJsonSafe(json);

      expect(result).toEqual({
        config: {
          name: 'test',
          settings: {
            value: 42,
            nested: {
              data: 'legitimate'
            }
          }
        }
      });
    });

    it('should not pollute Object.prototype', () => {
      const originalProto = Object.prototype;
      const json = '{"__proto__": {"polluted": true, "hacked": "yes"}}';

      SecurityUtils.parseJsonSafe(json);

      // Verify Object.prototype wasn't modified
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).hacked).toBeUndefined();
      expect(Object.prototype).toBe(originalProto);
    });

    it('should not add constructor properties to Object', () => {
      const json = '{"constructor": {"polluted": true}}';

      SecurityUtils.parseJsonSafe(json);

      // Verify Object constructor wasn't modified
      expect((Object as any).polluted).toBeUndefined();
    });
  });
});
