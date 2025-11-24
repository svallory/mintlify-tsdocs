Update ALL security review files to reflect correct threat model (local dev tool).

## Quick Context

**mint-tsdocs:** Local CLI tool (not web app) that generates docs from developer's own TypeScript code.

**Key Point:** Original reviews assumed attackers and internet exposure. Wrong. Developer controls all inputs and outputs.

**Impact:**
- Most "CRITICAL" security issues → Non-issues or code quality
- Real issues: Cache bugs, command execution, race conditions
- XSS/injection in user content → Delete these sections entirely

## Task

Use the **general-purpose** agent to update ALL module review folders:

1. **Read master instructions:**
   - `agent/reports/review/TASK_FOR_MODEL.md`
   - `agent/reports/review/UPDATE_INSTRUCTIONS.md`
   - `agent/reports/review/QUICK_REFERENCE.md`

2. **Update each module folder:**
   - `agent/reports/review/cache/`
   - `agent/reports/review/cli/`
   - `agent/reports/review/components/`
   - `agent/reports/review/config/`
   - `agent/reports/review/documenters/`
   - `agent/reports/review/errors/`
   - `agent/reports/review/markdown/`
   - `agent/reports/review/navigation/`
   - `agent/reports/review/nodes/`
   - `agent/reports/review/performance/`
   - `agent/reports/review/templates/`
   - `agent/reports/review/utils/`
   - `agent/reports/review/root/`

3. **For each module:**
   - Process all `.md` files (except TASK_FOR_MODEL, instructions, etc.)
   - DELETE security theater (XSS exploits, attack scenarios)
   - KEEP technical analysis (cache bugs, architecture)
   - REFRAME real issues (reliability not attackers)
   - Add context sections
   - Update tracker

4. **Exercise judgment:**
   - Don't blindly delete everything security-related
   - Cache bugs are REAL and CRITICAL
   - Command injection matters for crashes (not attacker scenarios)
   - Keep all good code quality analysis

5. **Update final tracker:**
   After all modules complete, update `agent/reports/review/REVIEW_TRACKER.md` with summary of all changes.

## Validation

Spot-check several files to ensure:
- Security theater deleted
- Technical analysis preserved
- Severity ratings realistic
- Language focuses on reliability/developer experience
- No "STOP PRODUCTION" drama

## Expected Outcome

Clean, actionable reviews focused on:
- Real bugs (cache system, race conditions)
- Code quality (TypeScript issues, best practices)
- Performance (bottlenecks, memory leaks)
- NOT security theater for local dev tool
