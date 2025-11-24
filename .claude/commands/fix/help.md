Help for fixing code review issues.

## Overview

Commands for addressing REAL issues from code reviews while skipping security theater.

## The Process

1. **Set up tests first:** `/fix/setup-tests`
2. **Check what needs fixing:** `/fix/status`
3. **Fix issues:** `/review/fix-review-issues` or `/review/fix-module`
4. **Validate:** Check build passes, tracker updated

## Available Commands

### `/fix/setup-tests`
Set up testing infrastructure before making fixes.

**Why first:** Tests establish baseline and catch regressions during fixes.

**What it does:**
- Installs Vitest
- Creates test configuration
- Writes baseline tests (including tests that document bugs)
- Creates test plan

### `/fix/status`
Check progress of fixes.

Shows:
- How many issues fixed
- Build status
- What's next

### `/review/fix-review-issues <review-file>`
Fix all issues in a specific review file with critical thinking.

**Example:**
```
/review/fix-review-issues agent/reports/review/cache/ApiResolutionCache.ts.md
```

**What it does:**
- Reads the review file (one source file, may have multiple issues)
- Processes each issue with critical thinking
- Fixes the corresponding source file

**Process:**
1. Analyze with critical thinking
2. Make targeted fix
3. Validate build
4. Update tracker
5. Commit changes

**Stops if:** Build breaks

### `/review/fix-module <module-name>`
Fix all real issues in a module.

**Example:**
```
/review/fix-module cache
```

**Process:**
- Works through issues by priority
- Applies critical thinking to each
- Validates build after every fix
- Skips non-issues
- Updates tracker

**Stops if:** Any fix breaks build

## Critical Thinking Required

Every fix must answer:
1. **Is this real?** Or security theater for a local dev tool?
2. **What's the impact?** Crashes? Wrong output? Or nothing?
3. **Is the fix appropriate?** Reliability or over-engineering?
4. **Does build still pass?** MUST validate

## Examples

### Real Issue - FIX IT
```
Issue: cache-key-generation
Review: "CRITICAL: Security vulnerability"
Reality: Cache literally doesn't work. Data corruption.
Action: FIX with proper serialization
```

### Non-Issue - SKIP IT
```
Issue: xss-in-pagelink
Review: "CRITICAL: XSS injection"
Reality: User generates their own docs. No attack.
Action: SKIP and mark as non-issue
```

### Wrong Framing - FIX BUT REFRAME
```
Issue: command-injection
Review: "CRITICAL: Allows attacker RCE"
Reality: Crashes on paths with special chars
Action: FIX with array syntax (reliability, not security)
```

## Priority Order

1. **CRITICAL** (3 issues):
   - Broken cache system
   - Cache key generation
   - Global state corruption

2. **HIGH** (6 issues):
   - Command execution (crashes)
   - Path validation (file ops bugs)
   - Input validation (crashes)

3. **MEDIUM** (10 issues):
   - Code quality
   - Error handling
   - Performance

4. **SKIP** (40+ non-issues):
   - XSS in user content
   - Injection in user content
   - All "attacker" scenarios

## Validation Requirements

Every fix MUST:
- [ ] Pass build: `bun run build`
- [ ] Update tracker
- [ ] Include commit message
- [ ] Not break existing functionality

## Stopping and Resuming

Work is tracked in `agent/reports/review/FIX_TRACKER.md`.

Can stop anytime and resume by:
1. Check status: `/fix/status`
2. Continue where you left off
3. All progress is saved

## Need More Info?

- **Test Plan:** `docs/testing/TEST_PLAN.md` (after setup)
- **Fix Tracker:** `agent/reports/review/FIX_TRACKER.md`
- **Review Files:** `agent/reports/review/[module]/`

## Common Questions

**Q: Should I fix everything the review found?**
A: NO. Skip security theater. Fix actual bugs and reliability issues.

**Q: What if the build breaks?**
A: Stop immediately. Fix or revert. Update tracker. Don't continue.

**Q: How do I know if something is a real issue?**
A: Ask: Does it cause crashes or wrong output? If no, probably not real.

**Q: Can I fix multiple issues at once?**
A: Use `/review/fix-module` for batch. But it stops on first build failure.
