# Fix Commands

Commands for addressing code review issues with critical thinking.

## Quick Start

```bash
# 1. Set up tests first (IMPORTANT!)
/fix/setup-tests

# 2. Check what needs fixing
/fix/status

# 3. Fix issues
/review/fix-review-issues agent/reports/review/cache/ApiResolutionCache.ts.md  # One file
/review/fix-module cache                                                # Whole module

# 4. Check progress
/fix/status
```

## The Problem

Original reviews assumed internet-facing web app. Wrong threat model.

**After correction:**
- **3 CRITICAL** issues (cache bugs, functionality)
- **6 HIGH** issues (crashes, file ops)
- **10 MEDIUM** issues (code quality)
- **40+ NON-ISSUES** (XSS, injection in user's own content)

## Commands

| Command | Purpose |
|---------|---------|
| `/fix/setup-tests` | Set up testing infrastructure FIRST |
| `/fix/status` | Check fix progress |
| `/review/fix-review-issues <review-file>` | Fix all issues in ONE review file |
| `/review/fix-module <name>` | Fix all review files in a module |
| `/fix/help` | Show detailed help |

## Critical Thinking Required

Before fixing anything:

### Ask These Questions:
1. **Is this real?** Or security theater?
2. **What's the impact?** Crashes? Wrong output? Nothing?
3. **Is the fix appropriate?** Reliability or over-engineering?
4. **Will build pass?** MUST validate after every fix

### Examples:

**Real Issue:**
```
Issue: Broken cache key generation
Impact: Cache doesn't work. Data corruption.
Action: FIX IT
```

**Non-Issue:**
```
Issue: XSS in PageLink component
Reality: User controls content. No attack.
Action: SKIP IT
```

**Wrong Framing:**
```
Issue: Command injection RCE
Reality: Crashes on unusual paths
Action: FIX (reliability, not security)
```

## Process

### For Each Fix:
1. Analyze with critical thinking
2. Make minimal, targeted changes
3. **Validate build:** `bun run build`
4. Update tracker
5. Commit with clear message

### Stop If:
- Build breaks
- Tests fail (when they exist)
- Functionality is broken

## Priority Order

Fix in this order:

1. **CRITICAL** - Cache bugs, broken functionality
2. **HIGH** - Crashes, validation issues
3. **MEDIUM** - Code quality, error handling
4. **SKIP** - XSS, injection in user content

## Tracking

Progress tracked in:
- `agent/reports/review/FIX_TRACKER.md` - Main tracker
- `agent/reports/review/fixes/` - Per-module summaries

## Validation

Every fix MUST:
- ✅ Pass build
- ✅ Update tracker
- ✅ Include commit
- ✅ Not break functionality

## Resumable

Work is saved in tracker. Can stop and resume anytime:
```bash
/fix/status    # See where you left off
```

## Testing

**IMPORTANT:** Run `/fix/setup-tests` BEFORE fixing issues.

Tests provide:
- Baseline to catch regressions
- Documentation of current bugs
- Safety net during refactoring

## Files

- `setup-tests` - Set up testing infrastructure
- `address-issue` - Fix one issue with critical thinking
- `address-module` - Fix all issues in a module
- `status` - Check progress
- `help.md` - Detailed help
- `README.md` - This file

## Agent Used

All fix commands use **typescript-expert** agent for:
- TypeScript expertise
- Critical thinking about fixes
- Build validation
- Code quality

## Key Principle

**FIX REAL ISSUES, SKIP SECURITY THEATER**

Focus on:
- ✅ Reliability (prevent crashes)
- ✅ Correctness (fix bugs)
- ✅ Code quality (improve maintainability)

Skip:
- ❌ Security for user's own content
- ❌ "Attacker" scenarios for local tools
- ❌ Over-engineering for non-existent threats
