Set up testing infrastructure and create test plan for mint-tsdocs.

## Context

mint-tsdocs currently has NO tests, despite CLAUDE.md claiming they exist. Before addressing code review issues, we need:
1. Testing infrastructure (Jest/Vitest + test utilities)
2. Test plan covering critical functionality
3. Baseline tests to prevent regressions during fixes

## Task

Use the **typescript-expert** agent to:

### 1. Assess Testing Needs

Analyze the codebase and determine:
- What test framework is most appropriate (Vitest recommended for TypeScript)
- What needs testing most urgently:
  - Cache system (currently broken)
  - File operations (path handling)
  - Command execution (CLI)
  - Template rendering
  - Type analysis
- What can be tested in isolation vs requires integration tests

### 2. Create Test Plan

Create `docs/testing/TEST_PLAN.md` with:

```markdown
# Test Plan for mint-tsdocs

## Testing Strategy

### Unit Tests (Priority)
- Cache key generation
- Path validation functions
- Template data conversion
- Type analysis

### Integration Tests (Secondary)
- Full documentation generation flow
- CLI command execution
- Navigation generation

### End-to-End Tests (Future)
- Generate docs for real TypeScript projects
- Verify MDX output correctness

## Test Coverage Goals

- Critical functions: 80%
- Cache system: 90%
- Overall: 60%

## Test Cases by Module

### Cache Module
1. Cache key generation produces unique keys
2. Cache size limits enforced
3. Cache eviction works correctly
4. No cache collisions

### CLI Module
1. Commands parse arguments correctly
2. File operations validate paths
3. Builds complete successfully
4. Error messages are helpful

### Templates Module
1. Template rendering produces valid MDX
2. Custom templates override defaults
3. Template data conversion is correct

[Continue for each module...]
```

### 3. Set Up Testing Infrastructure

1. **Install test dependencies:**
   ```bash
   bun add -D vitest @vitest/ui happy-dom
   bun add -D @types/node
   ```

2. **Create vitest.config.ts:**
   ```typescript
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: {
       globals: true,
       environment: 'node',
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html'],
       },
     },
   });
   ```

3. **Add test scripts to package.json:**
   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest",
     "test:coverage": "vitest run --coverage",
     "test:ui": "vitest --ui"
   }
   ```

4. **Create test utilities:**
   - `test/helpers/fixtures.ts` - Test fixtures
   - `test/helpers/mocks.ts` - Mock utilities
   - `test/setup.ts` - Test setup

### 4. Write Baseline Tests

Create these critical tests first:

**`src/cache/__tests__/ApiResolutionCache.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { ApiResolutionCache } from '../ApiResolutionCache';

describe('ApiResolutionCache', () => {
  it('should generate unique cache keys for different objects', () => {
    // Test the broken cache key generation
    // This test should FAIL initially (documenting the bug)
  });

  it('should not have cache collisions', () => {
    // This should also fail initially
  });
});
```

**`src/utils/__tests__/SecurityUtils.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { SecurityUtils } from '../SecurityUtils';

describe('SecurityUtils', () => {
  it('should validate file paths correctly', () => {
    // Test path traversal prevention
  });

  it('should sanitize CLI input', () => {
    // Test input validation
  });
});
```

### 5. Document Testing Approach

Update CLAUDE.md to remove incorrect test information and add:

```markdown
## Testing

**Status:** Testing infrastructure being set up (v0.1.0)

### Running Tests
\`\`\`bash
bun test              # Run all tests
bun test:watch        # Watch mode
bun test:coverage     # Coverage report
\`\`\`

### Test Strategy
- Unit tests for critical functions
- Integration tests for CLI commands
- Baseline tests document current bugs before fixing
```

## Critical Thinking Required

Ask yourself:
- What parts of the codebase are most critical to test?
- Should we write tests that PASS or tests that FAIL (documenting bugs)?
- Do we need integration tests now, or can we start with unit tests?
- What's the minimum viable test suite to enable safe refactoring?

## Validation

Before completing:
- [ ] Test framework installed and configured
- [ ] Can run `bun test` (even if tests fail)
- [ ] Test plan document created
- [ ] At least 5-10 baseline tests written
- [ ] Tests document current behavior (bugs included)
- [ ] CLAUDE.md updated with correct test info

## Output

After completion, save summary to:
- `docs/testing/TEST_SETUP_SUMMARY.md`

Include:
- What was set up
- What tests were written
- What's documented as broken (expected test failures)
- Next steps for comprehensive testing
