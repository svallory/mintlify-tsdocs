# Quick Reference: Issue Reclassification

Use this as a quick lookup when updating review files.

## Complete Non-Issues (Mark as N/A and DELETE attack scenarios)

| Issue | Why It's Not a Problem | What to DELETE |
|-------|------------------------|----------------|
| XSS in PageLink/RefLink | Developer's own code → Developer's own docs. No attack vector. | All XSS attack scenarios, exploit code, sanitization guides |
| XSS in Generated MDX | Output consumed by developer. No other users. | Security testing strategies, "impact" sections |
| JSON Prototype Pollution | Developer controls all JSON files. Can already write malicious code. | Prototype pollution exploit examples |
| Template File Injection | Developer explicitly chooses templates. Same as running their code. | Template injection attack scenarios |
| README Content Injection | Developer's own README. They control it. | README injection examples |
| File Size DoS | Local resources, local machine. Developer notices immediately. | DoS attack scenarios |
| Resource Exhaustion DoS | No shared resources. Can't DoS yourself meaningfully. | Resource exhaustion exploits |
| Information Disclosure | Only shown on developer's terminal. No other users. | Data exfiltration scenarios |
| Symlink Attacks | Developer controls file system. Would attack themselves. | Symlink attack examples |
| Path Traversal in Config | Developer specifies config path. They choose what to load. | Config path traversal exploits |

## Still Critical

| Issue | New Priority | Why It Still Matters |
|-------|--------------|----------------------|
| Command/Shell Injection | **CRITICAL** | Can execute arbitrary code. Even on local machine, still dangerous. |
| Broken Cache System | **CRITICAL** | Causes actual functionality failures. Docs won't generate correctly. |
| Global State Corruption | **CRITICAL** | Silent failures. Unpredictable behavior. Bad developer experience. |

## Downgraded to High

| Issue | Old → New | Rationale |
|-------|-----------|-----------|
| Path Traversal (File Ops) | CRITICAL → **HIGH** | Defense-in-depth. Could access `.env` files. Worth fixing but not emergency. |
| Missing Input Validation | CRITICAL → **HIGH** | Prevents crashes. Good UX. Not security. |
| Race Conditions | HIGH → **HIGH** | Reliability issue. Can cause intermittent failures. |

## Downgraded to Medium

| Issue | Old → New | Rationale |
|-------|-----------|-----------|
| Inconsistent Error Handling | HIGH → **MEDIUM** | Code quality. Better debugging. |
| Debug Code in Production | HIGH → **MEDIUM** | Code quality. Should clean up. |
| Performance Bottlenecks | MEDIUM → **MEDIUM** | User experience on large codebases. |
| Cache Memory Leaks | HIGH → **MEDIUM** | Local machine. Developer notices and restarts. |

## Future Work (Critical for CI/CD/SaaS)

Mark these as "**Will become critical in CI/CD or SaaS deployment**":

- Command injection (RCE on shared infrastructure)
- Path traversal (access to other containers/users)
- Resource exhaustion (DoS the entire service)
- Information disclosure (could leak between users)

Mark these as "**STILL non-issues even in SaaS**":

- XSS issues (user generates their own docs, no content mixing)
- Prototype pollution (user's own config)
- Template injection (user's own templates)
- README injection (user's own README)

**Note:** XSS only matters for admin dashboards showing previews - narrow scope, platform UI concern only.

## Quick Severity Mapping

```
Original CRITICAL (Command Injection)     → CRITICAL ✓
Original CRITICAL (Cache System)          → CRITICAL ✓
Original CRITICAL (Global State)          → CRITICAL ✓
Original CRITICAL (Path Traversal)        → HIGH
Original CRITICAL (XSS)                   → NON-ISSUE
Original CRITICAL (Prototype Pollution)   → NON-ISSUE
Original CRITICAL (JSON Injection)        → NON-ISSUE
Original HIGH (Input Validation)          → HIGH
Original HIGH (Memory Leaks)              → MEDIUM
Original HIGH (Error Handling)            → MEDIUM
Original MEDIUM (Performance)             → MEDIUM
Original LOW (Code Quality)               → LOW
```

## Template Responses

### For Non-Issues:
```
**Context Adjustment:** This is NOT a security vulnerability in any deployment scenario because:
- User controls the input (their own TypeScript code, config, templates)
- User controls the output (their own documentation site)
- No cross-user content mixing (each user's repo → their own docs)
- Even in SaaS: User A's docs ≠ User B's docs (separate domains)

**Recommendation:** No action required for v1.x, v2.x (CI/CD), or v3.x (SaaS)

**Exception:** Admin dashboard previews only - sanitize in platform UI, not tool code
```

### For Downgraded Issues:
```
**Context Adjustment:** Still worth fixing, but lower urgency because:
- Local developer tool, not internet-facing
- No privilege boundaries to cross
- Defense-in-depth rather than critical vulnerability

**Actual Impact:** [Reliability / Code Quality / Developer Experience]

**Recommendation:** Fix in normal development cycle
```

### For Confirmed Critical:
```
**Assessment Confirmed:** This remains critical even for local developer tools because:
- [Actual risk even in trusted environment]

**Recommendation:** Fix immediately
```
