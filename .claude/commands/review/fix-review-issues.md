Address a specific code review issue with critical thinking and build validation.

Arguments: $REVIEW_FILE (path to review file, e.g., "agent/reports/review/cache/ApiResolutionCache.ts.md")

## Context

**mint-tsdocs:** Local developer CLI tool (NOT web app) generating docs from TypeScript.

**Threat Model:** Developer processes trusted inputs. Focus on RELIABILITY and CRASHES, not attackers.

**After Review Correction:**
- CRITICAL: 3 issues (cache bugs, command execution)
- HIGH: ~6 issues (path handling, validation)
- MEDIUM: ~10 issues (code quality)
- NON-ISSUES: ~40+ (XSS, injection in user content)

## Task

Use the **typescript-expert** agent to address the specified issue following this process:

### 1. CRITICAL THINKING FIRST

Before making ANY changes, analyze:

**Is this a real issue?**
- Does it cause actual bugs/crashes?
- Or is it security theater for a local dev tool?

**What's the appropriate fix?**
- Reliability improvement (prevent crashes on edge cases)
- Code quality (better error messages, cleaner code)
- Performance (optimization)
- NOT: Security hardening for non-existent attackers

**Example Analysis:**
```
Issue: "CRITICAL: Command Injection RCE"

Critical Thinking:
- Real problem: Using string interpolation in commands
- Could crash on paths with spaces/special chars
- NOT about attackers - about reliability
- Fix: Use execFileSync with array syntax
- Priority: HIGH (reliability), not CRITICAL (security)
```

### 2. Read the Review

Read the specified review file.

The file reviews ONE source file and may contain multiple issues. For each issue:

Extract:
- Technical description (what's wrong)
- Location in source code (line numbers)
- Suggested fix (if appropriate for local tool)

**IGNORE:**
- "Attack scenarios" sections
- "Malicious user" language
- "System compromise" impacts
- Sanitization recommendations for user-controlled content

**Process all issues in the review file** unless they're non-issues.

### 3. Examine the Code

Read the actual source file and understand:
- Current implementation
- Why the review flagged it
- What the real impact is
- Whether it needs fixing

### 4. Apply Fix (If Justified)

**Only fix if:**
- It improves reliability
- It prevents crashes
- It improves code quality
- It fixes actual bugs

**Don't fix if:**
- It's security theater (XSS in own docs)
- It's over-engineering for current use case
- The review was wrong about the threat model

**When fixing:**
- Make minimal, targeted changes
- Preserve existing functionality
- Add comments explaining the fix
- Update types if needed

### 5. Validate the Fix

**MUST do:**
```bash
# Build must pass
bun run build

# If build fails, fix it or revert
# Do NOT leave the project broken
```

Should do (if tests exist):
```bash
bun test
```
Additionally, ensure that relevant tests are written or updated to achieve good coverage and assert that the module works as expected, preventing regressions.

**Manual validation:**
- Does the tool still work?
- Can it generate docs?
- Are error messages clear?

### 6. Update Tracker

Update `agent/reports/review/FIX_TRACKER.md`:

```markdown
### [Date] - [Module] - [Issue]
- **Fix:** [Concise description of changes]
- **Build Status:** ✅ Pass / ❌ Fail
- **Test Status:** ✅ Pass / ⏭️ No tests / ❌ Fail
- **Files Changed:** [List of files]
- **Notes:** [Any observations or follow-up needed]
```

Update the issue status:
- ⏳ Pending → 🔄 In Progress
- 🔄 In Progress → ✅ Fixed & Tested

### 7. Commit Changes

Create a commit with:

**Format:**
```
fix: [concise description]

Issue: [Issue ID from review]
Module: [Module name]

Changes:
- [Change 1]
- [Change 2]

Impact: [How this improves reliability/quality]

Build: Passing
Tests: [Passing/N/A]
```

## Examples

### Example 1: Real Issue

**Issue:** cache-key-generation
**Review Says:** "CRITICAL: Cache collisions cause security vulnerabilities"
**Critical Thinking:** Not security, but cache literally doesn't work. Data corruption.
**Action:** FIX IT - use proper object serialization
**Priority:** CRITICAL (functionality broken)

### Example 2: Non-Issue

**Issue:** xss-in-pagelink
**Review Says:** "CRITICAL: XSS allows script injection"
**Critical Thinking:** User's TypeScript generates their own docs. No attack vector.
**Action:** SKIP - Mark as non-issue in tracker
**Priority:** NONE

### Example 3: Reframe

**Issue:** cli-command-execution
**Review Says:** "CRITICAL: Command injection enables RCE"
**Critical Thinking:** Real problem (crashes on weird paths), wrong framing (not attacker)
**Action:** FIX IT - use array syntax to prevent shell interpretation
**Priority:** HIGH (reliability)

## Critical Thinking Questions

Before making changes:

1. **Does this issue exist in our threat model?**
   - Developer machine, trusted inputs
   - No attackers, no cross-user content

2. **What's the actual impact?**
   - Crashes? (HIGH priority)
   - Wrong output? (HIGH priority)
   - Performance? (MEDIUM priority)
   - User experience? (MEDIUM priority)
   - Security theater? (SKIP)

3. **Is the suggested fix appropriate?**
   - Does it improve reliability?
   - Or does it add unnecessary complexity?
   - Will it maintain functionality?

4. **Will this break anything?**
   - Build must pass
   - Existing functionality preserved
   - No breaking changes to API

## Validation Checklist

Before completing:
- [ ] Analyzed with critical thinking
- [ ] Fix is justified (not security theater)
- [ ] Code changes are minimal and focused
- [ ] Build passes: `bun run build`
- [ ] Manually validated tool still works
- [ ] Tracker updated with fix details
- [ ] Commit created with clear message

## If Build Fails

DO NOT leave the project broken:
1. Analyze the failure
2. Fix the build issue
3. Or revert the changes
4. Update tracker with failure notes
5. Mark issue as ❌ Failed with details

## Output

Summary of what was done:
```
Issue: [ID]
Status: [Fixed/Skipped/Failed]
Reason: [Why this decision was made]
Changes: [List of files modified]
Build: [Pass/Fail]
Next: [What should be addressed next]
```
