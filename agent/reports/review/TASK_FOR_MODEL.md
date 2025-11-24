# Task: Update Security Review Files

## Your Mission

Update all security review files in `/work/mintlify-tsdocs/agent/reports/review/` to reflect the correct threat model for mint-tsdocs.

## Context (Read This First)

mint-tsdocs is a **local developer CLI tool**, NOT a web application. The reviews were written assuming attackers and internet exposure, but that's wrong.

**Reality:**
- Developer runs tool on their own machine
- Processes their own TypeScript code
- Generates their own documentation site
- In future SaaS: Each user's repo → their own docs domain (no content mixing)

**This means:**
- XSS issues are non-issues (user can only "attack" their own docs)
- Most "security vulnerabilities" are actually just bugs or non-issues
- Focus should be on reliability and developer experience, not security theater

## What To Do

### 1. Read Instructions First
- Read `UPDATE_INSTRUCTIONS.md` completely
- Use `QUICK_REFERENCE.md` for quick lookups

### 2. Update Each Review File

**Files to update:** All `.md` files EXCEPT:
- `UPDATE_INSTRUCTIONS.md`
- `QUICK_REFERENCE.md`
- `TASK_FOR_MODEL.md`
- `Review Summary.md`
- `REVIEW_TRACKER.md`

### 3. For Each File:

#### A. DELETE Security Theater

Remove these sections entirely:
- "Attack Scenarios" for XSS/injection in user's own content
- Exploit code examples showing how to attack your own docs
- Detailed sanitization guides for user-controlled content
- "Malicious user" scenarios where user attacks themselves
- "Impact: Full system compromise" drama
- Security testing strategies for non-issues

**Example to DELETE:**
```markdown
## Attack Scenarios

### Scenario 1: Script Injection
```jsx
// Attacker input:
const maliciousTarget = "javascript:alert(document.cookie)";
// Results in:
<a href="javascript:alert(document.cookie)">Click me</a>
```
```

#### B. KEEP Good Technical Content

Preserve all valuable analysis:
- Cache bugs (broken keys, memory leaks)
- Architecture assessment
- Code quality issues
- Performance problems
- Real bugs that cause crashes
- Best practices violations

**Example to KEEP:**
```markdown
## Critical Issue: Broken Cache Key Generation

The cache key generation is fundamentally broken because it uses
`toString()` on arbitrary objects, which returns `[object Object]`
for most objects, causing cache key collisions.
```

#### C. REFRAME Real Issues

Change security language to reliability language:

**Before:**
```markdown
### CRITICAL: Command Injection (RCE)
Attacker can execute arbitrary code by providing malicious path.
Impact: Full system compromise, data exfiltration, ransomware.
```

**After:**
```markdown
### HIGH: Command Execution Bug
Command built with string interpolation instead of array syntax.
Could crash on unusual file paths with special characters.
Impact: Build failures, poor developer experience.
Fix: Use execFileSync with array syntax to avoid shell interpretation.
```

#### D. Add Context Section

At the top of each file, add:

```markdown
## ⚠️ Review Context Update

**Original review assumed:** Internet-facing web application threat model
**Actual context:** Local developer CLI tool processing trusted input

This review has been updated to reflect that mint-tsdocs:
- Runs on developer machines, not production servers
- Processes developer's own TypeScript code (trusted input)
- Generates docs for developer's own site (no cross-user content)
- Will expand to CI/CD and SaaS (those scenarios noted separately)

Many "critical security vulnerabilities" in the original review are actually non-issues or code quality concerns.
```

#### E. Update Final Assessment

Replace "NOT PRODUCTION READY - CRITICAL VULNERABILITIES" with balanced assessment:

```markdown
## Final Assessment

**Technical Quality:** [B/C/D] - [Brief summary of code quality]
**Reliability:** [HIGH/MEDIUM/LOW] - [Real bugs that need fixing]
**Production Ready:** [YES with fixes / NO - needs work]

**Issues to Fix:**
1. [Actual bug #1]
2. [Actual bug #2]

**Non-Issues (Can Ignore):**
1. [XSS concerns - user controls content]
2. [Injection concerns - user's own input/output]
```

## Examples

### Example 1: XSS Issue (Complete Non-Issue)

**Original:**
```markdown
## CRITICAL: XSS Vulnerability in PageLink

Unsanitized target prop enables script injection.

**Attack Vector:**
`<PageLink target="javascript:alert('xss')">Click</PageLink>`

**Impact:** Script injection, cookie theft, session hijacking

**Fix:** Sanitize all href attributes before rendering
```

**Updated:**
```markdown
## ~~CRITICAL~~ → NON-ISSUE: XSS Concerns in PageLink

**Original Assessment:** XSS vulnerability in href attributes

**Context Adjustment:** This is NOT a security issue because:
- Developer's TypeScript code generates the PageLink components
- Generated docs are viewed by developer or their users
- User would be "attacking" their own documentation
- No cross-user content mixing in any deployment scenario

**Recommendation:** No action required. This is normal behavior for a documentation generator.
```

### Example 2: Command Injection (Real Issue, Wrong Framing)

**Original:**
```markdown
## CRITICAL: Command Injection Enables RCE

String interpolation in shell command allows arbitrary code execution.

**Attack Vector:**
mint-tsdocs generate "./project; rm -rf / #"

**Impact:**
- Full system compromise
- Data exfiltration
- Ransomware deployment

**Fix:** Use execFileSync with array syntax
```

**Updated:**
```markdown
## HIGH: Command Execution Bug

**Issue:** Using string interpolation instead of array syntax for shell commands.

**Impact:**
- Tool could crash on paths with special characters
- Poor error messages when paths contain spaces or quotes
- Unexpected behavior with unusual file names

**Why This Matters:** Even though users control the input (their own project paths), proper command escaping prevents crashes and improves reliability.

**Fix:**
```typescript
// Replace execSync with string:
execSync(`npx tsc --project ${path}`)

// With execFileSync and array:
execFileSync('npx', ['tsc', '--project', path])
```

**Priority:** HIGH - Prevents crashes and improves developer experience
```

### Example 3: Cache Bug (Keep Everything)

**Original:**
```markdown
## CRITICAL: Broken Cache Key Generation

The cache uses `toString()` on arbitrary objects, which returns
`[object Object]` for most objects, causing all cache entries
to collide and overwrite each other.

**Impact:** Cache completely non-functional, severe performance degradation

**Fix:** Implement proper object serialization for cache keys
```

**Updated:**
```markdown
## CRITICAL: Broken Cache Key Generation

**Status:** Confirmed critical bug - affects all deployments

The cache uses `toString()` on arbitrary objects, which returns
`[object Object]` for most objects, causing all cache entries
to collide and overwrite each other.

**Impact:**
- Cache completely non-functional
- Severe performance degradation on large projects
- Incorrect documentation output due to wrong cache hits

**Fix:** Implement proper object serialization for cache keys

**Priority:** CRITICAL - Causes documentation generation failures
```

## Validation Before Finishing

For each updated file, check:

- [ ] Context section added at top
- [ ] XSS/injection attack scenarios deleted
- [ ] "Malicious attacker" language removed or reframed
- [ ] Good technical analysis preserved
- [ ] Real bugs kept with correct priority
- [ ] Final assessment is balanced
- [ ] No "STOP PRODUCTION" drama
- [ ] Language focuses on reliability and developer experience

## Your Output

Update the files in place. Maintain markdown formatting. Be thorough and consistent.

**Success looks like:**
- All security theater deleted
- All good technical content preserved
- Issues properly prioritized for a local dev tool
- Clear, actionable recommendations
- No misleading "critical security vulnerability" language for non-issues
