# Instructions: Update Review Files for Correct Context

## Background

The comprehensive code review in this folder was conducted without full context about mint-tsdocs' **actual runtime environment and threat model**. Many issues were flagged using an **internet-facing web application** security model, which doesn't apply here.

## Project Context (Critical to Understand)

### What mint-tsdocs Actually Is

**mint-tsdocs is a LOCAL DEVELOPER CLI TOOL** that:
- Runs on developer machines during documentation authoring
- Processes `.d.ts` files (TypeScript declarations) generated from the developer's own trusted source code
- Reads configuration files created/controlled by the developer
- Generates MDX documentation files that the developer commits to their repository
- Is NOT deployed to production servers
- Is NOT exposed to internet traffic
- Is NOT processing untrusted user input

**Input Sources:**
- TypeScript declaration files built from developer's own code
- Configuration files (`mint-tsdocs.config.json`) created by the developer
- Template files explicitly chosen by the developer
- README.md from the developer's own repository

**Threat Model:**
- Developer using the tool on their own machine
- Input is trusted (comes from developer's own codebase)
- No multi-tenancy, no privilege boundaries
- Developer already has full control over their machine

### Future Plans (Not Current Reality)

**Planned for v2.x+:**
- CI/CD integration (runs in build pipelines)
- Potential SaaS offering (multi-tenant environment)
- These scenarios WILL require enhanced security
- But they are NOT the current use case

## Your Task

Update each individual review file (not the summary) in this folder to reflect the correct threat model and priorities.

## Classification of Issues

### COMPLETE NON-ISSUES (Remove or Mark as N/A)

These are **not security vulnerabilities** in the current context:

1. **XSS in PageLink/RefLink Components**
   - Input comes from developer's own TypeScript code via API Extractor
   - Output is MDX files the developer controls
   - Developer would be "attacking" their own documentation from their own code
   - **No threat model where this matters**

2. **JSON Prototype Pollution from Config Parsing**
   - Config files (`mint-tsdocs.config.json`) are created/edited by the developer
   - If developer wants malicious config, they can just edit it directly
   - **No untrusted JSON being parsed**

3. **Template File Injection**
   - Developer explicitly chooses custom template directories (`customize` command)
   - They control what templates are used
   - **Same as letting developer run arbitrary code (which they already can)**

4. **Unvalidated README Content Processing**
   - README.md comes from developer's own repository
   - **Developer controls the input completely**

5. **File Size DoS / Resource Exhaustion**
   - Local machine, local resources
   - Developer would immediately notice if their own build hangs
   - No shared resources, no DoS vector
   - **Not a security issue for local tools**

6. **Information Disclosure in Error Messages**
   - Errors only shown on developer's own terminal
   - **No other users seeing sensitive information**

7. **Symlink Attacks**
   - Developer controls their own file system
   - No privilege boundary being crossed
   - **Would require developer to attack themselves**

### STILL VALID - CRITICAL PRIORITY

These remain **critical security/reliability issues**:

1. **Command/Shell Injection (RCE)**
   - Still critical even on dev machines
   - Could execute arbitrary code if developer uses the tool on untrusted input
   - **Fix: Remove `shell: true`, use array-based command execution**

2. **Broken Cache System**
   - Not security, but causes actual functionality failures
   - Cache key collisions lead to wrong data retrieval
   - **Fix: Proper cache key generation**

3. **Global State Corruption**
   - Singleton pattern silently ignores configuration
   - Causes unpredictable behavior during doc generation
   - **Fix: Proper singleton reset or remove pattern**

### STILL VALID - HIGH PRIORITY

These should be fixed for **reliability and developer safety**:

4. **Path Traversal in File Operations**
   - Could access CI secrets in `.env` files or other projects
   - Defense-in-depth measure
   - **Lower urgency than originally stated, but still worth fixing**

5. **Missing Input Validation**
   - Prevents crashes and unexpected behavior
   - Improves developer experience
   - **Not security, but quality issue**

6. **Race Conditions in File Operations**
   - Could cause intermittent failures
   - **Reliability issue, not security**

### STILL VALID - MEDIUM PRIORITY

Code quality improvements:

7. **Inconsistent Error Handling**
   - Improves debugging experience
   - **Code quality issue**

8. **Debug Code in Production**
   - Should be cleaned up
   - **Code quality issue**

9. **Performance Bottlenecks**
   - Affects user experience on large codebases
   - **Performance issue**

### DEPRIORITIZED (Future Work for CI/SaaS)

Mark these as "**Will become critical in CI/CD or SaaS deployment**":

- **Command injection** - RCE on shared infrastructure (CRITICAL for SaaS)
- **Path traversal** - Access to other containers/users (CRITICAL for SaaS)
- **Resource exhaustion** - DoS the entire service (CRITICAL for SaaS)
- **Information disclosure** - Could leak data between users (HIGH for SaaS)

Mark these as "**STILL non-issues even in CI/CD or SaaS**":

- **XSS vulnerabilities** - User controls their repo → generates their own docs site (no cross-user content mixing)
- **Template injection** - User explicitly chooses their own templates for their own docs
- **README injection** - User's own README going into their own docs
- **Prototype pollution from config** - User's own config files for their own docs generation

**Important Distinction:** In the planned SaaS model, each user connects their GitHub repo and gets docs published to their own subdomain/domain. User A cannot inject content into User B's documentation. The only narrow exception is if the platform builds an admin dashboard showing doc previews - sanitization needed there only.

## How to Update Each Review File

For each review file in this folder:

### 1. Update the Priority Section

Replace security severity ratings with context-appropriate priorities:

**Before:**
```
## Security Risk: CRITICAL 🔴
```

**After:**
```
## Security Risk: [ADJUSTED RATING] for Local Developer Tool

**Original Assessment:** CRITICAL 🔴
**Adjusted for Context:** [LOW/MEDIUM/HIGH/CRITICAL]

**Rationale:** This tool runs on developer machines processing trusted input from the developer's own codebase. [Explain adjustment]
```

### 2. Add Context Section at Top

Add this section right after the title:

```markdown
## ⚠️ IMPORTANT: Security Context

This review was conducted with an internet-facing web application threat model.

**Actual Context:** mint-tsdocs is a LOCAL DEVELOPER CLI TOOL that:
- Runs on developer machines (not production servers)
- Processes trusted input (developer's own TypeScript code)
- Has no untrusted user input or internet exposure
- Will evolve to CI/CD and potentially SaaS (future work)

**Impact on This Review:** [Explain how this changes the assessment]
```

### 3. Reclassify Each Issue

For each flagged issue:

**If it's a NON-ISSUE:**
```markdown
### [Issue Name] ~~CRITICAL~~ → **NON-ISSUE**

**Original Assessment:** [Original severity and description]

**Context Adjustment:** This is NOT a security vulnerability because:
- User controls the input (their own TypeScript/config/templates)
- User controls the output (their own documentation site)
- No cross-user content mixing in any deployment scenario

**Recommendation:** No action required for v1.x, v2.x (CI/CD), or v3.x (SaaS)

**Exception:** If building an admin dashboard that shows doc previews, sanitize content in the admin UI only. This is a narrow platform feature concern, not a core tool vulnerability.
```

**If it's STILL VALID but LOWER PRIORITY:**
```markdown
### [Issue Name] ~~CRITICAL~~ → **MEDIUM**

**Original Assessment:** [Original severity]

**Context Adjustment:** Still worth fixing, but lower priority because:
- [Reason for reduced urgency]

**Actual Impact:** [Reliability issue / Code quality / Defense-in-depth]

**Recommendation:** Fix in normal development cycle, not emergency.
```

**If it's STILL CRITICAL:**
```markdown
### [Issue Name] **CRITICAL** ✓ (Confirmed)

**Assessment:** This remains critical even for local developer tools because:
- [Reason 1]
- [Reason 2]

**Recommendation:** Fix immediately.
```

### 4. Update Recommendations Section

Replace "STOP PRODUCTION" language with appropriate recommendations:

**Before:**
```
## Immediate Actions Required 🛑

1. STOP ALL PRODUCTION DEPLOYMENTS
2. Emergency security patch
```

**After:**
```
## Recommended Actions (Adjusted for Local Tool Context)

**Immediate (Critical for Reliability):**
1. [Actual critical issues]

**High Priority (Developer Safety):**
2. [Important but not emergency]

**Medium Priority (Code Quality):**
3. [Improvements for maintainability]

**Future Work (CI/CD/SaaS):**
4. [Security features for hosted scenarios]
```

### 5. Update Final Assessment

Replace alarming language with balanced assessment:

**Before:**
```
**STOP ALL PRODUCTION USE - CRITICAL SECURITY VULNERABILITIES**
```

**After:**
```
**Balanced Assessment for Local Developer Tool:**

**Good:** [Strengths]
**Needs Work:** [Actual issues - reliability, performance, code quality]
**Future Security Hardening:** [What's needed for CI/CD/SaaS]

**Status:** Safe for current use case (local developer tool), needs reliability fixes before CI/CD integration.
```

## Example: Full Before/After

### Before:
```markdown
# CLI Module Review

## Security Risk: CRITICAL 🔴

### XSS Vulnerability in User Input

User-provided paths are not sanitized before being inserted into shell commands.

**Impact:** Arbitrary code execution

**Recommendation:** IMMEDIATE FIX REQUIRED
```

### After:
```markdown
# CLI Module Review

## ⚠️ IMPORTANT: Security Context

This review was conducted with an internet-facing web application threat model.

**Actual Context:** mint-tsdocs is a LOCAL DEVELOPER CLI TOOL that runs on developer machines processing their own trusted TypeScript code.

**Impact on This Review:** Several "critical vulnerabilities" are actually non-issues for local developer tools.

---

## Security Risk: MEDIUM for Local Developer Tool

**Original Assessment:** CRITICAL 🔴
**Adjusted for Context:** MEDIUM 🟡

**Rationale:** This tool processes developer-controlled inputs on local machines. True security issues remain (command injection), but many web-application concerns don't apply.

---

### Path Injection in Shell Commands ~~CRITICAL~~ → **HIGH**

**Original Assessment:** Critical security vulnerability allowing arbitrary code execution

**Context Adjustment:** Still important for defense-in-depth, but:
- Developer already has full control over their machine
- Input comes from developer's own config files
- Any malicious npm dependency could use postinstall scripts instead

**Actual Impact:** Defense-in-depth measure; prevents accidental issues with unusual paths

**Recommendation:** Fix during normal development cycle (not emergency)
```

## Key Principles

1. **Be Honest:** Don't claim something is secure if it's not, but also don't claim something is vulnerable if it's not
2. **Context Matters:** Web app security rules don't apply to local CLI tools
3. **Defense in Depth:** Some things are still worth fixing even if not strictly "vulnerable"
4. **Future Planning:** Note what will matter when expanding to CI/CD/SaaS
5. **Developer Experience:** Frame issues in terms of reliability, crashes, and poor UX

## Output Requirements

- Update ALL review files in this folder (except this instruction file and the summary)
- Maintain the original structure and formatting for sections you keep
- **DELETE security theater content** that doesn't apply (see below)
- **KEEP good technical analysis** of real bugs and architecture
- **REFRAME real issues** with correct context (reliability, not attacker scenarios)

### Content to DELETE Completely

Remove these sections entirely as they're based on false threat models:

1. **"Attack Scenarios" sections** - Detailed exploit write-ups for XSS/injection in user's own content
2. **"Exploit" code examples** - Showing how to "attack" your own documentation
3. **"Security testing" strategies** - For validating XSS protection in own docs
4. **"Impact: Full system compromise"** - Over-dramatic security language
5. **Detailed sanitization guides** - For content the user controls anyway
6. **"Malicious user" attack vectors** - Where "attacker" is the developer themselves

### Content to KEEP

Preserve all good technical analysis:

1. **Cache bugs** - Broken cache key generation, memory leaks, performance issues
2. **Race conditions** - File operation timing issues
3. **Architecture assessment** - Design patterns, modularity, coupling
4. **Code quality** - TypeScript issues, anti-patterns, best practices
5. **Performance problems** - Bottlenecks, inefficiencies
6. **Real bugs** - Things that cause crashes or incorrect behavior

### Content to REFRAME

Keep these issues but change the framing:

**Before:** "CRITICAL - Command Injection allows attacker to achieve RCE"
**After:** "HIGH - Command execution with unescaped paths could crash on unusual file names. Use array syntax to prevent shell interpretation."

**Before:** "XSS vulnerability enables script injection attacks"
**After:** "N/A - User controls input and output. Not a security issue."

**Before:** "Path traversal could expose sensitive system files to attacker"
**After:** "MEDIUM - Path validation bugs could cause file operations to fail or access unexpected directories. Add proper path canonicalization."

## Validation Checklist

For each updated review file, verify:

- [ ] Context section added at the top
- [ ] Each issue has been reclassified with rationale
- [ ] Severity ratings reflect local developer tool threat model
- [ ] Original analysis is preserved
- [ ] Recommendations are practical and appropriately prioritized
- [ ] Future CI/CD/SaaS considerations are noted where relevant
- [ ] No "STOP PRODUCTION" language (we're not in production)
- [ ] Balanced final assessment
