Address all real issues in a specific module with critical thinking.

Arguments: $MODULE_NAME (e.g., "cache", "cli", "components")

## Context

Fix all REAL issues in a module while skipping security theater.

**Module structure:**
```
agent/reports/review/cache/
  ├── ApiResolutionCache.ts.md    ← Review for src/cache/ApiResolutionCache.ts
  ├── CacheManager.ts.md           ← Review for src/cache/CacheManager.ts
  ├── TypeAnalysisCache.ts.md
  └── MODULE_REVIEW.md             ← Skip this (overall assessment)
```

**Approach:** Use **typescript-expert** agent to process each `*.ts.md` review file.

## Task

### 1. Find Review Files

List all review files in `agent/reports/review/$MODULE_NAME/`:
- Process: `*.ts.md` and `*.tsx.md` files (individual file reviews)
- Skip: `MODULE_REVIEW.md` (overall assessment)

### 2. Prioritize

Work in this order:
1. CRITICAL issues (cache bugs, functionality failures)
2. HIGH issues (crashes, validation)
3. MEDIUM issues (code quality)

Skip all NON-ISSUES.

### 3. Process Each Issue

For each issue in the module:

1. **Apply Critical Thinking:**
   - Is this real for a local dev tool?
   - What's the actual impact?
   - Is the fix appropriate?

2. **Address Issue:**
   - Use the same process as [/review:fix-review-issues](./fix-review-issues.md)
   - Make targeted changes
   - Validate build after EACH fix
   - Additionally, ensure that relevant tests are written or updated to achieve good coverage and assert that the module works as expected, preventing regressions.
   - Don't continue if build breaks

3. **Update Tracker:**
   - Mark issue as fixed/skipped
   - Note build status
   - Document any problems

4. **Commit:**
   - One commit per issue (or logical group)
   - Clear commit messages

### 4. Module Summary

After completing all issues in the module:

Create `agent/reports/review/fixes/[module]-fixes-summary.md`:

```markdown
# [Module] Fixes Summary

## Issues Addressed

### Critical Issues
1. [Issue] - Fixed: [Description]
2. [Issue] - Fixed: [Description]

### High Priority Issues
1. [Issue] - Fixed: [Description]
2. [Issue] - Fixed: [Description]

### Medium Priority Issues
1. [Issue] - Fixed: [Description]

### Non-Issues Skipped
1. [Issue] - Reason: [Why skipped]
2. [Issue] - Reason: [Why skipped]

## Build Status

- **Final Build:** ✅ Passing
- **Tests:** [Status]
- **Breaking Changes:** [Yes/No - List if yes]

## Files Modified

- [File 1] - [Changes]
- [File 2] - [Changes]

## Next Steps

- [Any follow-up needed]
```

### 5. Final Validation

Before completing:
- [ ] All CRITICAL issues addressed or marked non-issue
- [ ] All HIGH issues addressed or marked non-issue
- [ ] Build passes
- [ ] Module summary created
- [ ] Tracker updated

## Stop on Build Failure

If ANY fix breaks the build:
1. Stop immediately
2. Fix or revert the change
3. Update tracker with failure details
4. Do NOT continue to next issue

## Critical Thinking Examples

### Cache Module

**Issue:** "Broken cache key generation"
- **Analysis:** Real bug. Cache doesn't work at all.
- **Action:** FIX - Implement proper serialization
- **Priority:** CRITICAL

**Issue:** "Cache size DoS"
- **Analysis:** Not a DoS (local machine). But unbounded growth is bad.
- **Action:** FIX - Add size limits for good memory management
- **Priority:** MEDIUM

### CLI Module

**Issue:** "Command injection RCE"
- **Analysis:** Real bug (crashes on weird paths), wrong framing
- **Action:** FIX - Use array syntax
- **Priority:** HIGH

**Issue:** "Shell injection"
- **Analysis:** Same as above, different location
- **Action:** FIX
- **Priority:** HIGH

### Components Module

**Issue:** "XSS in PageLink"
- **Analysis:** Not a security issue. User controls content.
- **Action:** SKIP
- **Priority:** NONE

**Issue:** "TypeTree recursion"
- **Analysis:** Real bug. Could crash on circular refs.
- **Action:** FIX - Add depth limit
- **Priority:** MEDIUM

## Progress Tracking

The command should update tracker after each fix:

```markdown
### Cache Module

#### Critical Issues
- ✅ **Broken cache key generation** (ApiResolutionCache.ts)
  - Status: Fixed
  - Impact: Cache now works correctly
  - Complexity: High
  - Fix: Implemented proper object serialization
  - Build: ✅ Passing
  - Commit: abc123
```

## Output

Final summary:
```
Module: [name]
Issues Addressed: [count]
Issues Skipped: [count]
Build Status: [Pass/Fail]
Next Module: [suggestion]
```
