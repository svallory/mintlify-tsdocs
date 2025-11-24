Update security review files in a module folder to reflect correct threat model.

Arguments: $MODULE_PATH (path to module review folder, e.g., agent/reports/review/cli)

## Context

**mint-tsdocs** is a local developer CLI tool that generates Mintlify documentation from TypeScript code.

**Key Facts:**
- **Audience:** Library authors, CLI developers, open source maintainers
- **Environment:** Local dev machines (current), CI/CD (planned), SaaS backend (future)
- **Input:** Developer's own TypeScript code, config files, templates
- **Output:** MDX documentation for developer's own site
- **Threat Model:** Developer processes trusted inputs; no cross-user content mixing

**Original Review Problem:** Reviews assumed internet-facing web app with attackers. Wrong model.

**What Changed:**
- XSS issues → Non-issues (user can only "attack" their own docs)
- Template/config injection → Non-issues (user controls all inputs)
- Command injection → Still matters (crashes, reliability)
- Cache bugs → Still critical (functional failures)
- Path traversal → Medium (reliability, not security)

## Task

Use the **code-reviewer** agent to update review files in `$MODULE_PATH` following these instructions:

1. **Read Instructions First:**
   - Read `agent/reports/review/TASK_FOR_MODEL.md`
   - Use `agent/reports/review/QUICK_REFERENCE.md` for lookups
   - Read `agent/reports/review/UPDATE_INSTRUCTIONS.md` for methodology

2. **Exercise Critical Thinking:**
   - Don't blindly delete content - evaluate each section
   - Keep valuable technical analysis (cache bugs, architecture, performance)
   - Delete security theater (XSS exploits, attack scenarios for non-issues)
   - Question whether each issue makes sense for a local dev tool

3. **For Each Review File:**
   - Add context section explaining threat model correction
   - DELETE: Attack scenarios, exploit code, sanitization guides for user-controlled content
   - KEEP: Real bugs (cache issues, race conditions, code quality problems)
   - REFRAME: Real issues from "attacker" language to "reliability/crashes" language
   - Update severity ratings appropriately
   - Add balanced final assessment

4. **Update Tracker:**
   After completing module, update `agent/reports/review/REVIEW_TRACKER.md` with:
   - Module name and completion timestamp
   - Count of files updated
   - Summary of changes (e.g., "Removed 5 XSS scenarios, kept 3 real bugs")

## Examples of Changes

**DELETE (Security Theater):**
```markdown
## Attack Scenario: XSS via PageLink
Attacker provides: `<PageLink target="javascript:alert('xss')">`
Impact: Script injection, session hijacking, cookie theft
```

**KEEP (Real Bug):**
```markdown
## Critical: Broken Cache Key Generation
Using toString() on objects returns "[object Object]", causing
all cache entries to collide. Results in wrong data retrieval.
```

**REFRAME (Wrong Context):**
Before: "CRITICAL: Command Injection allows attacker RCE"
After: "HIGH: Command execution bug causes crashes on paths with special chars"

## Critical Thinking Required

Ask yourself for EACH issue:
- Is there actually an "attacker" here, or just the developer using their own tool?
- Does this issue cause actual bugs/crashes, or is it security theater?
- Would this matter in SaaS? (Note it, but don't over-prioritize for v1.x)
- Is the technical analysis valuable, even if the security framing is wrong?

## Validation

Before marking complete, verify:
- [ ] Context section added to each file
- [ ] Security theater deleted, not just reclassified
- [ ] Good technical analysis preserved
- [ ] Real bugs have correct severity (not everything is CRITICAL)
- [ ] Recommendations are actionable
- [ ] Tracker updated with module completion

## Agent Invocation

Use code-reviewer agent to systematically review and update files while maintaining code quality standards and exercising judgment about what to keep vs. delete.
