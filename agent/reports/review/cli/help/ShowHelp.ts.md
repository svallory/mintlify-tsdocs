# Code Review: ShowHelp.ts

## ⚠️ IMPORTANT: Security Context

This review was conducted with an internet-facing web application threat model.

**Actual Context:** mint-tsdocs is a LOCAL DEVELOPER CLI TOOL that:
- Runs on developer machines (not production servers)
- Processes trusted input (developer's own TypeScript code)
- Has no untrusted user input or internet exposure
- Will evolve to CI/CD and potentially SaaS (future work)

**Impact on This Review:** Several "critical vulnerabilities" are actually non-issues for local developer tools.

---

**File**: `/work/mintlify-tsdocs/src/cli/help/ShowHelp.ts`
**Type**: Help text for `show` command
**Date**: 2025-11-23

## Overall Assessment

**Quality**: Good
**Accuracy**: Accurate
**Maintainability**: High

Clean, straightforward help for a utility command.

---

## Critical Issues

None.

---

## High Priority Issues

None.

---

## Medium Priority Issues

### 1. Default behavior ambiguity

**Line**: 13
**Says**: "Defaults to 'config' if no target is specified"

```typescript
'Displays the current mint-tsdocs configuration or documentation statistics. ' +
'Use "config" to view configuration settings or "stats" to view API coverage and quality metrics. ' +
'Defaults to "config" if no target is specified.'
```

**Verification** (`ShowAction.ts` lines 47-50):
```typescript
const target = (this.remainder && this.remainder.values.length > 0)
  ? this.remainder.values[0]
  : 'config';  // ✓ Correct default
```

**This is accurate!** No issue here, but worth noting the explicit default is well-documented.

---

### 2. Stats details missing

**Lines**: 32-34
**Says**: "Show documentation statistics"

```typescript
{
  description: 'Show documentation statistics',
  command: 'mint-tsdocs show stats'
}
```

**Implementation** (`ShowAction.ts` lines 139-291) shows extensive stats:
- API Surface Coverage (classes, interfaces, functions, etc.)
- Quality Metrics (examples, remarks)
- Generated Files (count, size)
- Coverage percentages with color coding

**Missing**: What kind of statistics? Coverage? Quality metrics?

**Suggestion**: Expand description: "Show documentation statistics (coverage, quality, file counts)"

---

### 3. Prerequisites for `stats` not documented

**Implementation** (`ShowAction.ts` lines 154-171):
```typescript
if (!FileSystem.exists(tsdocsDir)) {
  clack.log.error('No documentation has been generated yet.');
  clack.outro(
    'Run ' + Colorize.cyan('mint-tsdocs generate') + ' to generate documentation first'
  );
  return;
}
```

**The `stats` target requires docs to be generated first.**

**Missing**: Help doesn't mention this.

**Impact**: Users running `mint-tsdocs show stats` before generating docs will hit an error with no warning.

**Suggestion**: Add note: "Note: 'stats' requires documentation to be generated first"

---

## Suggestions

### 1. Could show what config displays

**Lines**: 27-29
**Example**: "Show current configuration (default)"

```typescript
{
  description: 'Show current configuration (default)',
  command: 'mint-tsdocs show'
}
```

**Implementation** (`ShowAction.ts` lines 74-127) displays:
- Project Settings (entry point, output folder, docs.json)
- Navigation (tab name, group name)
- README settings
- Templates (user dir, cache, strict mode)
- API Extractor config

**Suggestion**: Could mention what gets shown: "Show current configuration (paths, navigation, templates)"

Not critical, but adds context.

---

### 2. No mention of error handling for missing config

**Implementation** (`ShowAction.ts` lines 130-135):
```typescript
if (error instanceof DocumentationError && error.code === ErrorCode.CONFIG_NOT_FOUND) {
  clack.log.error('No mint-tsdocs configuration found.');
  clack.outro('Run ' + Colorize.cyan('mint-tsdocs init') + ' to create a configuration file');
}
```

**Both `config` and `stats` require config to exist.**

**Missing**: Help doesn't mention this prerequisite.

**Suggestion**: Add to description: "Requires mint-tsdocs.config.json (run 'init' first)"

---

### 3. Usage shows [TARGET] but doesn't explain it

**Line**: 14
**Says**: `mint-tsdocs show [TARGET]`

```typescript
usage: 'mint-tsdocs show [TARGET]',
```

**The options explain config/stats, so this is fine.** But could be more explicit:
```typescript
usage: 'mint-tsdocs show [config|stats]',
```

This makes it clearer what values TARGET accepts.

---

## Code Quality Notes

### What Works Well

1. **Clear examples** - Shows both targets with descriptions
2. **Default documented** - Makes it clear config is default
3. **Concise** - No unnecessary verbosity

### Implementation Matches

✓ Default to 'config' - accurate
✓ Available targets - accurate (config/stats)
✓ Error on invalid target - verified in code
⚠️ Missing prerequisite mentions (needs config file)
⚠️ Missing stats requirement (needs generated docs)

---

## Brutally Honest Assessment

This help text is **adequate but could use more context**.

**The Good:**
- Accurate about behavior
- Shows both use cases
- Documents default behavior

**The Bad:**
- Doesn't explain what you'll see from each command
- Doesn't mention prerequisites
- Minimal context about the value of each target

**The Reality:**
It's a utility command with simple help. Not much to screw up here, but also not much effort put into making it truly helpful.

**Would a user be confused?**
Probably not confused, but they might run `show stats` before generating docs and be surprised by the error.

---

## Recommendations

### Priority 1: Document prerequisites
- Both commands need config file
- `stats` needs docs to be generated

### Priority 2: Add context to stats description
Explain what statistics are shown (coverage, quality, etc.)

### Priority 3: Consider more specific usage string
Show `[config|stats]` instead of `[TARGET]` for clarity.

---

## Final Verdict

**Passes**: Yes - accurate and functional
**Ship-blocking issues**: None
**Technical debt**: Low - minor improvements would help

This is fine. Not great, not bad, just fine. It does the job without confusing anyone.
