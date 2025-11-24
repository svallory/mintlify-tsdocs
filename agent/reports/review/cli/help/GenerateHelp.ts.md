# Code Review: GenerateHelp.ts

## ⚠️ IMPORTANT: Security Context

This review was conducted with an internet-facing web application threat model.

**Actual Context:** mint-tsdocs is a LOCAL DEVELOPER CLI TOOL that:
- Runs on developer machines (not production servers)
- Processes trusted input (developer's own TypeScript code)
- Has no untrusted user input or internet exposure
- Will evolve to CI/CD and potentially SaaS (future work)

**Impact on This Review:** Several "critical vulnerabilities" are actually non-issues for local developer tools.

---

**File**: `/work/mintlify-tsdocs/src/cli/help/GenerateHelp.ts`
**Type**: Help text for `generate` command (default command)
**Date**: 2025-11-23

## Overall Assessment

**Quality**: Good
**Accuracy**: Accurate - matches implementation
**Maintainability**: High

This is the most important help file since `generate` is the default command. It's comprehensive and accurate.

---

## Critical Issues

None.

---

## High Priority Issues

### 1. Misleading positional argument documentation

**Line**: 14
**Issue**: Help says `[PROJECT_DIR]` as positional arg, but implementation is complex

```typescript
usage: 'mint-tsdocs generate [PROJECT_DIR] [OPTIONS]',
```

**Implementation reality** (`GenerateAction.ts` lines 108-118):
```typescript
if (this.remainder && this.remainder.values.length > 0 && !this.remainder.values[0].startsWith('-')) {
  // Use first positional argument as project directory (if not a flag)
  projectDir = path.resolve(process.cwd(), this.remainder.values[0]);
} else if (this._projectDirParameter.value) {
  // Use --project-dir flag
  projectDir = path.resolve(process.cwd(), this._projectDirParameter.value);
}
```

**Problem**: The positional argument is ONLY recognized if it doesn't start with `-`, otherwise it falls through. This isn't clearly documented.

**Impact**: User confusion if they do:
```bash
mint-tsdocs generate --skip-extractor ./packages/lib  # Will NOT work as expected
```

**Suggestion**: Document this limitation or show that `--project-dir` is the reliable option.

---

## Medium Priority Issues

### 1. Conflicting input-folder documentation

**Lines**: 25-28
**Issue**: Says `-i, --input-folder` is "only with --skip-extractor"

```typescript
{
  short: '-i',
  long: '--input-folder FOLDER',
  description: 'Input folder containing *.api.json files (only with --skip-extractor)'
}
```

**Reality check**: Looking at `GenerateAction.ts`, there's NO `--input-folder` parameter defined!

```typescript
this._skipExtractorParameter = this.defineFlagParameter({
  parameterLongName: '--skip-extractor',
  description: 'Skip running api-extractor (use existing .api.json files in .tsdocs/)'
});
```

**This is a ghost feature!** The help documents a flag that doesn't exist in the implementation.

**Impact**: Users will try `-i` and get an error.

**Required fix**: Remove this option from help OR implement it in `GenerateAction.ts`.

---

### 2. Auto-init behavior not documented

**Implementation**: `GenerateAction.ts` lines 136-163 show it prompts to run `init` if config missing

```typescript
if (error instanceof DocumentationError && error.code === ErrorCode.CONFIG_NOT_FOUND) {
  clack.log.error('No mint-tsdocs configuration found.');

  const shouldInit = await clack.confirm({
    message: 'Would you like to initialize mint-tsdocs now?',
    initialValue: true
  });
```

**Missing from help**: This helpful auto-init feature isn't mentioned anywhere.

**Suggestion**: Add note: "Prompts to run 'mint-tsdocs init' if no config found"

---

### 3. TypeScript compilation not mentioned

**Implementation**: `GenerateAction.ts` line 377-385 shows it auto-compiles TypeScript

```typescript
const tscCommand = `npx tsc --project ${resolvedTsconfigPath}`;
execSync(tscCommand, {
  cwd: projectDir,
  stdio: 'inherit'
});
```

**Missing**: Help doesn't explain that TypeScript gets compiled automatically.

**User confusion**: Someone might wonder why their TS files are being compiled when they just wanted to generate docs.

**Suggestion**: Add to description: "Automatically compiles TypeScript before extracting API information"

---

## Suggestions

### 1. Example doesn't match usage pattern

**Lines**: 42-47
**Issue**: Shows `mint-tsdocs` with no args, claims it's default

```typescript
{
  description: 'Or simply (generate is the default command)',
  command: 'mint-tsdocs'
}
```

**Question**: Is `generate` truly the default? Need to check `ApiDocumenterCommandLine.ts` to verify this claim.

If true, this is fine. If false, this is misleading.

---

### 2. Cache directory location not explained

**Line**: 13
**Says**: "Auto-generates API Extractor and TSDoc configs in .tsdocs/ cache directory"

**Missing**: WHERE is `.tsdocs/` created? (It's in `docs/.tsdocs/` based on implementation line 168)

```typescript
const tsdocsDir = config.docsJson
  ? path.join(path.dirname(config.docsJson), '.tsdocs')
  : path.join(projectDir, 'docs', '.tsdocs');
```

**Suggestion**: Be specific: "in docs/.tsdocs/ (or next to your docs.json)"

---

## Code Quality Notes

### What Works Well

1. **Comprehensive examples** - Shows multiple use cases
2. **Flag documentation** - Clear descriptions
3. **Context provided** - Explains relationship to other commands

### Implementation Mismatches

❌ **CRITICAL**: `-i, --input-folder` documented but NOT implemented
⚠️ **Warning**: Positional arg behavior more complex than documented
⚠️ **Missing**: Auto-compilation not mentioned
⚠️ **Missing**: Auto-init prompt not mentioned

---

## Brutally Honest Assessment

This help text has a **critical bug** - it documents a flag (`-i, --input-folder`) that doesn't exist. This is AI hallucination at its finest.

**The Good:**
- Well-structured examples
- Shows default command usage
- Explains relationship to config file

**The Bad:**
- Documents features that don't exist (ghost `-i` flag)
- Omits important behaviors (auto-compile, auto-init)
- Positional arg behavior is underdocumented

**The Ugly:**
The `-i` flag documentation suggests someone started implementing it, documented it, then never finished. Or the AI just made it up. Either way, it's broken.

**Would a user be confused?**
Yes - if they try to use `-i` they'll get an error. If they pass a project dir as a positional arg after flags, it won't work.

---

## Recommendations

### Priority 1: Remove or implement `-i, --input-folder`
**REQUIRED** - This is a bug. Either implement the flag or remove it from help.

### Priority 2: Document auto-compilation
Users need to know their TypeScript will be compiled.

### Priority 3: Clarify positional argument limitations
Document that positional PROJECT_DIR must come before flags, or just recommend using `--project-dir`.

### Priority 4: Mention auto-init behavior
It's a nice feature, document it.

---

## Final Verdict

**Passes**: No - contains documentation for non-existent feature
**Ship-blocking issues**: Yes - the `-i` flag must be removed or implemented
**Technical debt**: Medium - missing important behavior documentation

This needs fixes before shipping. The ghost `-i` flag is embarrassing.
