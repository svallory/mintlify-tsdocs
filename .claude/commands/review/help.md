Help for review update commands.

## Overview

Commands for updating security review files to reflect the correct threat model for mint-tsdocs (local developer tool, not web application).

## Available Commands

### `/review/update-module <path>`
Update review files in a specific module folder.

**Example:**
```
/review/update-module agent/reports/review/cli
```

Updates all review files in the CLI module folder, removing security theater and keeping valuable technical analysis.

### `/review/update-all`
Update ALL module review folders at once.

Uses general-purpose agent to process all modules systematically. Good for batch updates.

### `/review/status`
Check which modules have been updated and what's pending.

Shows current progress from the review tracker.

## Quick Context

**What's happening:** Original security reviews assumed internet-facing web app threat model. Wrong for a local developer CLI tool.

**What to fix:**
- DELETE: XSS attack scenarios (user can't attack their own docs)
- DELETE: Exploit examples for user-controlled content
- KEEP: Real bugs (cache issues, race conditions)
- REFRAME: Security language → Reliability language

## Key Principles

1. **Exercise judgment** - Don't blindly delete everything
2. **Keep technical analysis** - Cache bugs, architecture issues are valuable
3. **Delete security theater** - XSS exploits, "malicious attacker" scenarios
4. **Focus on reliability** - Crashes, poor UX, bugs (not attackers)

## Instructions Location

Full instructions are in:
- `agent/reports/review/TASK_FOR_MODEL.md` - Main task
- `agent/reports/review/UPDATE_INSTRUCTIONS.md` - Detailed methodology
- `agent/reports/review/QUICK_REFERENCE.md` - Quick lookup table

## Need Help?

Read the instructions first, they have detailed examples of what to delete, keep, and reframe.
