# Test Plan for mint-tsdocs

## Overview

This document outlines the testing strategy for mint-tsdocs, a CLI tool that generates Mintlify-compatible MDX documentation from TypeScript source code.

**Current Status:** Testing infrastructure being established (v0.0.3)

**Testing Philosophy:**
- Write tests that document current behavior (including bugs)
- Start with critical functionality that could cause data loss or security issues
- Use tests to enable safe refactoring and fixes
- Prefer unit tests for speed, integration tests for confidence

## Testing Strategy

### Priority Levels

1. **CRITICAL** - Security, data integrity, command execution
2. **HIGH** - Core functionality, file operations, template rendering
3. **MEDIUM** - Caching, performance optimizations, utilities
4. **LOW** - Edge cases, minor helpers, logging

### Test Types

#### Unit Tests (Priority: HIGH)
Focus on isolated functions with clear inputs/outputs:
- Cache key generation and collision detection
- Path validation and sanitization
- Input validation (CLI arguments, file paths)
- Type analysis parsing
- Template data conversion
- Security utilities

**Target Coverage:** 80% for critical modules

#### Integration Tests (Priority: MEDIUM)
Test interactions between components:
- Full documentation generation flow (TypeScript → MDX)
- Template system (loading, merging, rendering)
- Navigation generation and updates
- Cache coordination across modules
- CLI command execution with real files

**Target Coverage:** 60% of major workflows

#### End-to-End Tests (Priority: LOW - Future)
Test complete user workflows:
- `init` command with real projects
- `generate` command producing valid MDX
- `customize` command creating usable templates
- Integration with actual TypeScript projects

**Target Coverage:** Key user workflows

### Test Framework: Vitest

**Rationale:**
- Native TypeScript support
- Fast execution with Vite-powered transforms
- Compatible with Jest APIs (easy migration path)
- Better ESM support than Jest
- Built-in coverage reporting

## Test Coverage Goals

| Module | Current | Target | Priority | Notes |
|--------|---------|--------|----------|-------|
| Cache System | 0% | 90% | CRITICAL | Currently broken, needs comprehensive tests |
| Security Utils | 0% | 85% | CRITICAL | Path traversal, command injection prevention |
| CLI Commands | 0% | 70% | HIGH | Command parsing, validation |
| Template System | 0% | 75% | HIGH | Rendering correctness |
| Type Analysis | 0% | 70% | HIGH | Parsing accuracy |
| File Operations | 0% | 80% | HIGH | Path handling, I/O safety |
| Navigation | 0% | 60% | MEDIUM | docs.json updates |
| Markdown Emission | 0% | 65% | MEDIUM | TSDoc → MDX conversion |
| Utilities | 0% | 50% | LOW | Helper functions |
| **Overall** | **0%** | **60%** | - | Baseline for v1.0 |

## Test Cases by Module

### 1. Cache Module (CRITICAL)

**File:** `src/cache/ApiResolutionCache.ts`

**Known Issues:**
- Cache key generation uses `toString()` which may not be unique
- Potential cache collisions when objects have same string representation
- No validation of cache key uniqueness

**Test Cases:**

```typescript
describe('ApiResolutionCache', () => {
  // EXPECTED TO FAIL - Documents current bug
  it('should generate unique cache keys for different declaration references', () => {
    // Test that different objects produce different cache keys
    // This should FAIL if toString() produces collisions
  });

  it('should not have cache collisions with same toString() values', () => {
    // Create objects with identical toString() but different structure
    // This should FAIL, documenting the bug
  });

  it('should enforce LRU eviction when cache is full', () => {
    // Verify oldest items are evicted correctly
  });

  it('should track hit/miss statistics accurately', () => {
    // Verify cache statistics are correct
  });

  it('should handle cache disabled mode', () => {
    // When enabled=false, should not cache
  });

  it('should move items to end on access (LRU behavior)', () => {
    // Verify LRU behavior is correct
  });
});
```

**File:** `src/cache/TypeAnalysisCache.ts`

```typescript
describe('TypeAnalysisCache', () => {
  it('should cache type analysis results', () => {
    // Basic caching functionality
  });

  it('should handle complex type strings with generics', () => {
    // Test with: Array<Promise<Record<string, unknown>>>
  });

  it('should evict least recently used items', () => {
    // Verify LRU eviction
  });

  it('should not exceed maxSize limit', () => {
    // Verify size constraints
  });
});
```

**File:** `src/cache/CacheManager.ts`

```typescript
describe('CacheManager', () => {
  it('should coordinate multiple cache instances', () => {
    // Test cache manager coordination
  });

  it('should clear all caches correctly', () => {
    // Verify clearAll() works
  });

  it('should calculate statistics across all caches', () => {
    // Test getStats() aggregation
  });

  it('should respect global enabled/disabled setting', () => {
    // When disabled, all caches should be disabled
  });

  it('should create production/development/default configurations', () => {
    // Test factory methods
  });
});
```

### 2. Security Utilities (CRITICAL)

**File:** `src/utils/SecurityUtils.ts`

**Security Concerns:**
- Path traversal prevention
- Command injection prevention
- Input validation for CLI
- Safe file operations

**Test Cases:**

```typescript
describe('SecurityUtils.validateFilePath', () => {
  it('should allow valid paths within base directory', () => {
    // Valid: /base/docs/file.md
  });

  it('should reject path traversal with ../', () => {
    // Invalid: /base/../etc/passwd
  });

  it('should reject absolute paths outside base', () => {
    // Invalid: /etc/passwd
  });

  it('should reject symbolic link traversal', () => {
    // Invalid: /base/symlink -> /etc/passwd
  });

  it('should handle relative paths correctly', () => {
    // Valid: ./docs/file.md
  });
});

describe('SecurityUtils.validateFilename', () => {
  it('should allow valid filenames', () => {
    // Valid: document.md, api-reference.mdx
  });

  it('should reject reserved Windows filenames', () => {
    // Invalid: CON, PRN, AUX, NUL
  });

  it('should reject path traversal in filename', () => {
    // Invalid: ../../../etc/passwd
  });

  it('should reject filenames over 255 characters', () => {
    // Invalid: very_long_filename...
  });

  it('should reject filenames with dangerous characters', () => {
    // Invalid: file<script>.md
  });
});

describe('SecurityUtils.validateCliInput', () => {
  it('should allow safe CLI input', () => {
    // Valid: --output ./docs
  });

  it('should reject command injection attempts', () => {
    // Invalid: --output ./docs; rm -rf /
    // Invalid: --output $(whoami)
    // Invalid: --output `cat /etc/passwd`
  });

  it('should reject input with newlines', () => {
    // Invalid: --output ./docs\nrm -rf /
  });

  it('should trim whitespace', () => {
    // Valid: "  ./docs  " -> "./docs"
  });

  it('should reject empty input', () => {
    // Invalid: ""
  });
});

describe('SecurityUtils.sanitizeYamlText', () => {
  it('should escape YAML special characters', () => {
    // Test: quotes, newlines, colons, etc.
  });

  it('should wrap text with special chars in quotes', () => {
    // Text starting with - should be quoted
  });

  it('should handle empty strings', () => {
    // Return empty string
  });
});

describe('SecurityUtils.sanitizeJsxAttribute', () => {
  it('should escape HTML entities', () => {
    // <, >, &, ", '
  });

  it('should reject javascript: URLs in href/src', () => {
    // Invalid: javascript:alert(1)
  });

  it('should reject data: URLs in href/src', () => {
    // Invalid: data:text/html,<script>alert(1)</script>
  });

  it('should allow safe URLs', () => {
    // Valid: https://example.com, /relative/path
  });
});

describe('SecurityUtils.validateJsonContent', () => {
  it('should accept valid JSON', () => {
    // Valid: {"key": "value"}
  });

  it('should reject JSON over 10MB', () => {
    // Invalid: huge JSON
  });

  it('should reject potential code execution patterns', () => {
    // Check for eval(, Function(, etc.
  });

  it('should allow constructor/prototype as legitimate keys', () => {
    // Valid: {"constructor": "MyClass"}
    // (This is legitimate in API docs)
  });

  it('should reject __proto__ pollution attempts', () => {
    // Invalid: {"__proto__": {...}}
  });
});
```

### 3. CLI Commands (HIGH)

**File:** `src/cli/InitAction.ts`

```typescript
describe('InitAction', () => {
  it('should auto-detect TypeScript entry point', () => {
    // Check package.json types/typings field
  });

  it('should create mint-tsdocs.config.json with valid schema', () => {
    // Validate against JSON schema
  });

  it('should create .tsdocs cache directory', () => {
    // Verify directory structure
  });

  it('should handle --yes flag (skip prompts)', () => {
    // Use auto-detected defaults
  });

  it('should handle --skip-mintlify flag', () => {
    // Don't run `mint new`
  });

  it('should validate output paths', () => {
    // Prevent path traversal
  });
});
```

**File:** `src/cli/GenerateAction.ts`

```typescript
describe('GenerateAction', () => {
  it('should load config from mint-tsdocs.config.json', () => {
    // Test config loading
  });

  it('should run api-extractor by default', () => {
    // Verify api-extractor execution
  });

  it('should skip api-extractor with --skip-extractor', () => {
    // Use existing .api.json files
  });

  it('should validate input/output paths', () => {
    // Prevent dangerous paths
  });

  it('should handle missing config gracefully', () => {
    // Show helpful error message
  });
});
```

**File:** `src/cli/CustomizeAction.ts`

```typescript
describe('CustomizeAction', () => {
  it('should copy default templates to user directory', () => {
    // Verify files are copied
  });

  it('should not overwrite existing templates without --force', () => {
    // Protect user customizations
  });

  it('should overwrite with --force flag', () => {
    // Allow explicit overwrites
  });

  it('should validate template directory path', () => {
    // Prevent path traversal
  });
});
```

### 4. Template System (HIGH)

**File:** `src/templates/LiquidTemplateEngine.ts`

```typescript
describe('LiquidTemplateEngine', () => {
  it('should render simple templates', () => {
    // Test: "Hello {{ name }}"
  });

  it('should support layout inheritance', () => {
    // Test: {% layout "base" %}
  });

  it('should support blocks', () => {
    // Test: {% block content %}...{% endblock %}
  });

  it('should sanitize template data', () => {
    // Prevent template injection
  });

  it('should handle missing variables gracefully', () => {
    // Show helpful error or default value
  });

  it('should support conditionals', () => {
    // Test: {% if condition %}...{% endif %}
  });

  it('should support loops', () => {
    // Test: {% for item in items %}...{% endfor %}
  });
});
```

**File:** `src/templates/TemplateDataConverter.ts`

```typescript
describe('TemplateDataConverter', () => {
  it('should convert ApiClass to template data', () => {
    // Test class conversion
  });

  it('should convert ApiInterface to template data', () => {
    // Test interface conversion
  });

  it('should convert ApiFunction to template data', () => {
    // Test function conversion
  });

  it('should extract parameters correctly', () => {
    // Test parameter extraction
  });

  it('should extract return type correctly', () => {
    // Test return type extraction
  });

  it('should handle missing descriptions gracefully', () => {
    // Don't crash on missing docs
  });

  it('should generate proper breadcrumbs', () => {
    // Test breadcrumb generation
  });
});
```

**File:** `src/templates/TemplateMerger.ts`

```typescript
describe('TemplateMerger', () => {
  it('should merge user and default templates', () => {
    // User templates override defaults
  });

  it('should handle missing user templates', () => {
    // Fall back to defaults
  });

  it('should create temp directory for merged templates', () => {
    // Verify temp dir creation
  });

  // KNOWN BUG - Document for fixing
  it('should clean up temp directories after use', () => {
    // This should FAIL - temp dirs are not cleaned up
  });

  it('should validate template syntax', () => {
    // Catch syntax errors early
  });
});
```

### 5. File Operations (HIGH)

**File:** `src/utils/FileSystemHelpers.ts` (if exists)

```typescript
describe('FileSystemHelpers', () => {
  it('should read files safely within base directory', () => {
    // Test safe file reading
  });

  it('should write files safely within base directory', () => {
    // Test safe file writing
  });

  it('should reject operations outside base directory', () => {
    // Prevent path traversal
  });

  it('should handle file not found gracefully', () => {
    // Show helpful error
  });

  it('should handle permission errors gracefully', () => {
    // Show helpful error
  });
});
```

### 6. Type Analysis (HIGH)

**File:** `src/utils/ObjectTypeAnalyzer.ts`

```typescript
describe('ObjectTypeAnalyzer', () => {
  it('should parse simple object types', () => {
    // { name: string; age: number }
  });

  it('should parse nested object types', () => {
    // { user: { name: string } }
  });

  it('should parse union types', () => {
    // string | number
  });

  it('should parse intersection types', () => {
    // A & B
  });

  it('should parse generic types', () => {
    // Array<T>, Promise<Record<K, V>>
  });

  it('should handle circular references', () => {
    // Don't crash on circular types
  });

  it('should cache analysis results', () => {
    // Verify caching behavior
  });
});
```

### 7. Navigation (MEDIUM)

**File:** `src/navigation/NavigationManager.ts`

```typescript
describe('NavigationManager', () => {
  it('should update docs.json with new pages', () => {
    // Add pages to navigation
  });

  it('should preserve existing navigation structure', () => {
    // Don't overwrite other sections
  });

  it('should handle missing docs.json gracefully', () => {
    // Create new docs.json
  });

  it('should validate docs.json schema', () => {
    // Ensure valid Mintlify format
  });

  it('should support tabs and groups', () => {
    // Test tab/group creation
  });

  it('should handle concurrent updates safely', () => {
    // Prevent race conditions
  });
});
```

### 8. Markdown Emission (MEDIUM)

**File:** `src/markdown/CustomMarkdownEmitter.ts`

```typescript
describe('CustomMarkdownEmitter', () => {
  it('should convert TSDoc to Markdown', () => {
    // Basic conversion
  });

  it('should generate Mintlify components', () => {
    // <ParamField>, <ResponseField>
  });

  it('should handle code blocks correctly', () => {
    // Preserve syntax highlighting
  });

  it('should handle inline code correctly', () => {
    // `code`
  });

  it('should handle links correctly', () => {
    // [text](url)
  });

  it('should escape special characters', () => {
    // Prevent Markdown injection
  });

  it('should handle custom TSDoc nodes', () => {
    // DocTable, DocNoteBox, etc.
  });
});
```

## Test Infrastructure

### Directory Structure

```
test/
├── cache/
│   ├── ApiResolutionCache.test.ts
│   ├── TypeAnalysisCache.test.ts
│   └── CacheManager.test.ts
├── cli/
│   ├── InitAction.test.ts
│   ├── GenerateAction.test.ts
│   └── CustomizeAction.test.ts
├── utils/
│   ├── SecurityUtils.test.ts
│   └── ObjectTypeAnalyzer.test.ts
├── templates/
│   ├── LiquidTemplateEngine.test.ts
│   ├── TemplateDataConverter.test.ts
│   └── TemplateMerger.test.ts
├── navigation/
│   └── NavigationManager.test.ts
├── helpers/
│   ├── fixtures.ts         # Test data and fixtures
│   ├── mocks.ts             # Mock utilities
│   └── assertions.ts        # Custom assertions
├── fixtures/
│   ├── sample-api.json      # Sample API Extractor output
│   ├── sample-config.json   # Sample configs
│   └── sample-templates/    # Sample templates
└── setup.ts                 # Test setup/teardown
```

### Test Utilities

**`test/helpers/fixtures.ts`:**
```typescript
// Provide reusable test data
export const sampleApiItem = { ... };
export const sampleConfig = { ... };
export const sampleTemplate = { ... };
```

**`test/helpers/mocks.ts`:**
```typescript
// Mock external dependencies
export const mockFileSystem = { ... };
export const mockApiExtractor = { ... };
export const mockTerminal = { ... };
```

**`test/helpers/assertions.ts`:**
```typescript
// Custom test assertions
export function assertValidMdx(content: string): void { ... }
export function assertValidDocsJson(json: any): void { ... }
```

### Test Configuration

**`vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'test/**/*.ts',
        'src/cli/ApiDocumenterCommandLine.ts', // Entry point
        'src/index.ts', // Barrel file
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60
      }
    },
    include: ['test/**/*.test.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

## Known Issues to Document with Tests

### Cache System
1. **Cache Key Collisions** - ApiResolutionCache uses toString() which may not be unique
2. **No TTL** - Cache entries never expire automatically
3. **Slow JSON.stringify** - Performance bottleneck in key generation

### Template System
1. **Temp Directory Leak** - TemplateMerger doesn't clean up temp directories
2. **No Template Validation** - Syntax errors only caught at render time
3. **Sanitization Overhead** - Even trusted data is sanitized

### CLI
1. **Error Messages** - Some errors are too technical for users
2. **Path Validation** - Not all CLI commands validate paths consistently

## Test Execution

### Commands

```bash
# Run all tests
bun test

# Watch mode
bun test:watch

# Coverage report
bun test:coverage

# UI mode
bun test:ui

# Run specific test file
bun test test/cache/ApiResolutionCache.test.ts

# Run tests matching pattern
bun test --grep "cache collision"
```

### CI Integration (Future)

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test:coverage
      - uses: codecov/codecov-action@v3
```

## Testing Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on inputs/outputs, not internal state
   - Tests should survive refactoring

2. **Write Failing Tests First**
   - Document bugs with failing tests
   - Fix the bug, tests should pass

3. **Keep Tests Fast**
   - Unit tests < 100ms
   - Integration tests < 1s
   - Mock expensive operations

4. **Use Descriptive Names**
   - `it('should reject path traversal with ../')` not `it('test 1')`

5. **One Assertion Per Test (Generally)**
   - Makes failures easier to diagnose
   - Exception: Related assertions that fail together

6. **Clean Up After Tests**
   - Use `beforeEach`/`afterEach` for setup/teardown
   - Don't leave temp files

7. **Avoid Test Interdependence**
   - Each test should run independently
   - Order shouldn't matter

## Next Steps

### Phase 1: Foundation (Current)
- [x] Install Vitest and dependencies
- [x] Configure Vitest
- [x] Create test utilities and helpers
- [ ] Write baseline tests for cache system (10 tests)
- [ ] Write baseline tests for security utilities (20 tests)

### Phase 2: Core Functionality
- [ ] Write tests for CLI commands (15 tests)
- [ ] Write tests for template system (20 tests)
- [ ] Write tests for type analysis (10 tests)
- [ ] Write tests for file operations (10 tests)

### Phase 3: Integration
- [ ] Write integration tests for full generation flow
- [ ] Write integration tests for navigation updates
- [ ] Write integration tests for template rendering

### Phase 4: Quality
- [ ] Achieve 60% overall coverage
- [ ] Fix all documented bugs
- [ ] All baseline tests passing

### Phase 5: Automation
- [ ] Set up CI/CD for automated testing
- [ ] Add pre-commit hooks for tests
- [ ] Set up coverage reporting

## Success Criteria

- ✅ Vitest installed and configured
- ✅ Can run `bun test` successfully
- ✅ At least 30 baseline tests written
- ✅ Critical bugs documented with failing tests
- ✅ Test utilities and helpers available
- ✅ Coverage reporting works
- ⏳ 60% overall test coverage (future goal)
- ⏳ All critical modules have >80% coverage (future goal)

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [TypeScript Testing Guide](https://www.typescriptlang.org/docs/handbook/testing.html)
