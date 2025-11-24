# Review Update Commands

Commands for updating security review files to reflect the correct threat model.

## Quick Start

```bash
# See available commands
/review/help

# Check current status
/review/status

# Update a specific module
/review/update-module agent/reports/review/components

# Update all modules
/review/update-all

# Validate updates
/review/validate
```

## The Problem

Original security reviews assumed an **internet-facing web application** with malicious attackers. This was the wrong threat model.

**Reality:** mint-tsdocs is a **local developer CLI tool** that:
- Runs on developer machines
- Processes developer's own TypeScript code
- Generates docs for developer's own site
- No cross-user content mixing (even in SaaS)

## What This Means

| Original Finding | Reality |
|-----------------|---------|
| "CRITICAL: XSS in PageLink" | Non-issue - user controls content |
| "CRITICAL: Template injection" | Non-issue - user chooses templates |
| "CRITICAL: Command injection RCE" | Real issue - but reliability, not attacker |
| "CRITICAL: Broken cache" | Real issue - causes failures |
| "HIGH: Path traversal" | Medium issue - file ops bug |

## Commands

### `/review/help`
Show this help and available commands.

### `/review/status`
Check which modules have been updated.

### `/review/update-module <path>`
Update a specific module's review files.

**Example:**
```
/review/update-module agent/reports/review/cli
```

### `/review/update-all`
Update all module folders at once.

### `/review/validate [path]`
Validate that updates were done correctly.

## Key Principles

When updating reviews:

1. **DELETE security theater:**
   - XSS attack scenarios
   - Exploit code for user's own content
   - "Malicious attacker" language

2. **KEEP technical analysis:**
   - Cache bugs (real issues!)
   - Architecture assessment
   - Performance problems
   - Code quality issues

3. **REFRAME real issues:**
   - "Attacker can inject" → "Could crash on unusual input"
   - "RCE vulnerability" → "Command execution bug"
   - "Security risk" → "Reliability issue"

4. **Exercise judgment:**
   - Don't blindly delete everything
   - Question each issue
   - Keep valuable analysis

## Instructions Location

Detailed instructions at:
- `agent/reports/review/TASK_FOR_MODEL.md`
- `agent/reports/review/UPDATE_INSTRUCTIONS.md`
- `agent/reports/review/QUICK_REFERENCE.md`

## Tracking

Progress tracked in:
- `agent/reports/review/REVIEW_TRACKER.md`

Validation reports in:
- `agent/reports/review/validation/`

## Example Workflow

```bash
# 1. Check status
/review/status

# 2. Update a module
/review/update-module agent/reports/review/components

# 3. Validate it worked
/review/validate agent/reports/review/components

# 4. Check updated status
/review/status

# 5. Continue with other modules...
```

## Need Help?

Read the instructions first - they have detailed examples and explanations of what to keep, delete, and reframe.
