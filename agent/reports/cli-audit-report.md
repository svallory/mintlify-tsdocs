# CLI Audit Report

**Date:** 2025-11-19
**Status:** Issues Found - Fixes Required

## Executive Summary

Comprehensive audit of all CLI commands revealed **4 critical issues** that need immediate attention:
1. Duplicate flag definitions causing conflicts
2. Version/verbose flag ambiguity
3. Missing positional argument support for init command
4. Documentation inconsistencies

---

## Commands Audited

✅ **init** - InitAction.ts
✅ **generate** - GenerateAction.ts
✅ **customize** - CustomizeAction.ts
✅ **show** - ShowAction.ts
✅ **help** - HelpAction.ts
✅ **version** - VersionAction.ts

---

## Critical Issues

### 1. 🔴 InitAction Duplicate Global Flags

**File:** `src/cli/InitAction.ts:65-74`

**Problem:**
InitAction defines its own `--verbose/-v` and `--debug` flags, which conflict with the global flags defined in ApiDocumenterCommandLine.ts.

**Code:**
```typescript
this._verboseParameter = this.defineFlagParameter({
  parameterLongName: '--verbose',
  parameterShortName: '-v',
  description: 'Show verbose output'
});

this._debugParameter = this.defineFlagParameter({
  parameterLongName: '--debug',
  description: 'Show debug output (implies --verbose)'
});
```

**Impact:**
- Flag conflicts cause unexpected behavior
- Global flags won't work correctly with init command
- Inconsistent behavior across commands

**Fix Required:**
- Remove lines 65-74 (local flag definitions)
- Remove lines 741-750 (local flag getters)
- Use `this._cliInstance.isVerbose` and `this._cliInstance.isDebug` directly

---

### 2. 🔴 Version Flag Conflicts with Verbose Flag

**Files:**
- `docs/cli-reference.mdx:237-238`
- `src/cli/ApiDocumenterCommandLine.ts:69`

**Problem:**
Documentation claims `-v` shows version, but `-v` is already the short form for `--verbose`.

**Documentation Says:**
```bash
mint-tsdocs --version
mint-tsdocs -v
```

**Reality:**
- `-v` is defined as short for `--verbose` (global flag)
- `--version` is listed as a known action, but doesn't have `-v` as a short form
- This creates ambiguity

**Impact:**
- User confusion when `-v` doesn't show version as documented
- Documentation doesn't match implementation

**Fix Required:**
- Remove `-v` from version documentation (only use `--version`)
- OR change verbose to have no short form (breaking change)
- Update cli-reference.mdx line 237 to remove `-v` option

---

### 3. 🟡 Init Command Missing Positional Argument Support

**Files:**
- `docs/cli-reference.mdx:46, 63`
- `src/cli/InitAction.ts:47-52`
- `src/cli/ApiDocumenterCommandLine.ts:100`

**Problem:**
Documentation says init supports positional PROJECT_DIR argument, but implementation only supports `--project-dir` flag.

**Documentation Says:**
```bash
mint-tsdocs init [PROJECT_DIR]
mint-tsdocs init ./packages/my-library
```

**Reality:**
- InitAction only supports `--project-dir` flag
- Positional argument handling in ApiDocumenterCommandLine only applies to `generate` command
- No remainder defined in InitAction

**Impact:**
- Commands documented don't work as expected
- Users will get errors when trying `mint-tsdocs init ./path`

**Fix Options:**

**Option A (Recommended):** Update documentation to remove positional argument
- Remove `[PROJECT_DIR]` from line 46
- Change example on line 63 to use `--project-dir` flag

**Option B:** Implement positional argument support
- Add remainder parameter to InitAction
- Handle positional arg same way GenerateAction does (lines 79-82, 106-118)
- Update ApiDocumenterCommandLine to handle init paths

---

### 4. 🟡 Customize Command Documentation Inconsistency

**Files:**
- `docs/cli-reference.mdx:137`
- `src/cli/CustomizeAction.ts:37-44, 62-84`

**Problem:**
Documentation says `-t` is required, but implementation allows interactive prompt if omitted.

**Documentation Says:**
```bash
mint-tsdocs customize -t TEMPLATE_DIR [OPTIONS]
```
"(required)" is implied by usage pattern.

**Reality:**
- If `-t` is not provided, CustomizeAction prompts interactively (lines 62-84)
- This is actually better UX than making it required

**Impact:**
- Minor documentation inconsistency
- Implementation is actually better than documented

**Fix Required:**
- Update cli-reference.mdx line 133 to show optional flag:
  ```bash
  mint-tsdocs customize [-t TEMPLATE_DIR] [OPTIONS]
  ```
- Update line 137 to clarify it's optional

---

## Verification Matrix

| Command | Global --verbose | Global --debug | Global --quiet | Command-Specific Flags | Documented Correctly |
|---------|-----------------|----------------|----------------|----------------------|---------------------|
| init | ❌ Duplicate | ❌ Duplicate | ✅ | --yes, --skip-mintlify, --project-dir | ⚠️ Positional arg missing |
| generate | ✅ | ✅ | ✅ | --skip-extractor, --project-dir | ✅ |
| customize | ✅ | ✅ | ✅ | -t/--template-dir, --force | ⚠️ -t not truly required |
| show | ✅ | ✅ | ✅ | --target | ✅ |
| help | ✅ | ✅ | ✅ | none | ✅ |
| version | ✅ | ✅ | ✅ | none | ⚠️ -v conflicts with verbose |

---

## Recommendations

### High Priority (Immediate Action Required)

1. **Fix InitAction duplicate flags** - This is a bug that needs immediate fixing
2. **Fix version flag documentation** - Remove `-v` from version docs to avoid confusion

### Medium Priority (Should Fix Soon)

3. **Fix init positional argument** - Either implement it or update docs (recommend updating docs)
4. **Fix customize documentation** - Update docs to reflect that `-t` is optional

### Low Priority (Nice to Have)

5. **Add comprehensive flag tests** - Ensure all global flags work with all commands
6. **Standardize flag handling** - Document pattern for commands to use global flags

---

## Documentation Changes Required

### cli-reference.mdx

**Line 46:** Change
```bash
mint-tsdocs init [PROJECT_DIR] [OPTIONS]
```
To:
```bash
mint-tsdocs init [OPTIONS]
```

**Line 52:** Add clarification:
```
- `--project-dir PATH` - Project directory (default: current directory)
```

**Line 63:** Change
```bash
mint-tsdocs init ./packages/my-library
```
To:
```bash
mint-tsdocs init --project-dir ./packages/my-library
```

**Line 133:** Change
```bash
mint-tsdocs customize -t TEMPLATE_DIR [OPTIONS]
```
To:
```bash
mint-tsdocs customize [-t TEMPLATE_DIR] [OPTIONS]
```

**Line 137:** Add:
```
- `-t`, `--template-dir PATH` - Template directory path (if omitted, you'll be prompted)
```

**Line 237-238:** Remove `-v` shortcut, change to:
```bash
mint-tsdocs version
mint-tsdocs --version
```

---

## Code Changes Required

### src/cli/InitAction.ts

**Remove lines 65-74:**
```typescript
// DELETE THIS:
this._verboseParameter = this.defineFlagParameter({
  parameterLongName: '--verbose',
  parameterShortName: '-v',
  description: 'Show verbose output'
});

this._debugParameter = this.defineFlagParameter({
  parameterLongName: '--debug',
  description: 'Show debug output (implies --verbose)'
});
```

**Remove lines 741-750:**
```typescript
// DELETE THIS:
private get _isVerbose(): boolean {
  return this._verboseParameter.value || this._isDebug || this._cliInstance.isVerbose;
}

private get _isDebug(): boolean {
  return this._debugParameter.value || this._cliInstance.isDebug;
}
```

**Update all usages of `this._isVerbose` and `this._isDebug` to:**
```typescript
// Use these instead:
this._cliInstance.isVerbose
this._cliInstance.isDebug
```

**Lines to update:** 762, 768, 806

---

## Testing Checklist

After fixes are applied, verify:

- [ ] `mint-tsdocs init --verbose` works correctly
- [ ] `mint-tsdocs generate --verbose` works correctly
- [ ] `mint-tsdocs --version` shows version (not `mint-tsdocs -v`)
- [ ] `mint-tsdocs -v` shows verbose output, not version
- [ ] `mint-tsdocs init` prompts for all required info
- [ ] `mint-tsdocs init --project-dir ./path` works correctly
- [ ] `mint-tsdocs customize` prompts for template directory
- [ ] `mint-tsdocs customize -t ./templates` works without prompting
- [ ] All global flags work with all commands
- [ ] Documentation examples all work as shown

---

## Summary

**Total Issues:** 4
**Critical:** 2 (duplicate flags, version conflict)
**Important:** 2 (positional arg, documentation)

**Estimated Fix Time:** 2-3 hours
**Testing Time:** 1 hour

**Next Steps:**
1. Review and approve this report
2. Apply code fixes to InitAction.ts
3. Update cli-reference.mdx documentation
4. Run comprehensive testing
5. Update cheat-sheet.mdx if needed
