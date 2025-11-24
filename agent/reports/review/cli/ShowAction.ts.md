# Code Review: ShowAction.ts

## ⚠️ IMPORTANT: Security Context

This review was conducted with an internet-facing web application threat model.

**Actual Context:** mint-tsdocs is a LOCAL DEVELOPER CLI TOOL that:
- Runs on developer machines (not production servers)
- Processes trusted input (developer's own TypeScript code)
- Has no untrusted user input or internet exposure
- Will evolve to CI/CD and potentially SaaS (future work)

**Impact on This Review:** Several "critical vulnerabilities" are actually non-issues for local developer tools.

---

**File:** `/work/mintlify-tsdocs/src/cli/ShowAction.ts`
**Reviewed:** 2025-11-23
**Reliability Priority:** HIGH - Contains several high-priority reliability issues and code quality concerns that need immediate attention.

---

## Executive Summary

**Overall Grade: B+** - Well-structured action with good patterns, but contains several high-priority reliability issues and code quality concerns that need attention.

**Reliability Risk: HIGH for Local Developer Tool**

**Original Assessment:** MEDIUM (due to misaligned web application threat model)
**Adjusted for Context:** HIGH (due to critical runtime crash, hardcoded path assumptions, and path validation gaps that impact core functionality and developer experience)

**Production Readiness: NEEDS IMPROVEMENTS** - High-priority reliability issues must be addressed to ensure the command is functional and stable.

---

## CRITICAL

None found.

---

## HIGH PRIORITY

### 1. Hardcoded path assumptions break configurability

**Lines 71, 148**

```typescript
const tsdocsDir = path.join(projectDir, 'docs', '.tsdocs');
```

**Issues:**
- Assumes `.tsdocs` cache directory is always at `docs/.tsdocs`
- Ignores the actual config's `outputFolder` setting
- If user sets `outputFolder: "./api-docs"`, this will look in the wrong place
- Hardcoded `docs/` path duplicated in two methods
- No way to override this location

**Impact:** Command fails silently or shows wrong data when users customize paths.

**Recommendation:**
```typescript
// Derive from config instead of hardcoding
const outputDir = path.isAbsolute(config.outputFolder)
  ? config.outputFolder
  : path.join(projectDir, config.outputFolder);
const tsdocsDir = path.join(path.dirname(outputDir), '.tsdocs');

// Or better: add to config
const tsdocsDir = config.cacheDir || path.join(projectDir, 'docs', '.tsdocs');
```

---


### 2. Command-line argument parsing bypasses framework

**Lines 41-50**

```typescript
// Check if --help was requested (check process.argv since ts-command-line intercepts it)
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  ShowHelp.showHelp();
  return;
}

// Get target from remainder args (default to 'config' if not provided)
const target = (this.remainder && this.remainder.values.length > 0)
  ? this.remainder.values[0]
  : 'config';
```

**Issues:**
- Manually parsing `process.argv` instead of using the command-line framework
- `ts-command-line` already handles `--help`, this creates duplicate logic
- The `remainder` property is accessed but never defined with `defineCommandLineRemainder()`
- Will cause runtime error: `Cannot read properties of undefined (reading 'values')`
- Comment admits this is a workaround ("check process.argv since ts-command-line intercepts it")

**Impact:** Runtime crashes when accessing undefined `this.remainder`.

**Recommendation:**
```typescript
// In constructor, define the remainder properly
private readonly _targetRemainder: CommandLineRemainder;

public constructor() {
  super({ /* ... */ });

  this._targetRemainder = this.defineCommandLineRemainder({
    description: 'Target to show (config or stats)'
  });
}

// In onExecuteAsync
const target = this._targetRemainder.values[0] || 'config';
```

---


### 3. No input validation on target argument

**Lines 48-64**

```typescript
const target = (this.remainder && this.remainder.values.length > 0)
  ? this.remainder.values[0]
  : 'config';

switch (target.toLowerCase()) {
  case 'config':
    await this._showConfig();
    break;
  case 'stats':
    await this._showStats();
    break;
  default:
    throw new DocumentationError(
      `Unknown show target: "${target}". Use "config" or "stats".`,
      ErrorCode.INVALID_CONFIGURATION
    );
}
```

**Issues:**
- `target` is taken directly from user input
- No validation of length or content before use
- While `switch` handles unknown values, it throws an error that includes the raw input
- If `target` is a huge string or contains control characters, the error message could be messy

**Recommendation:**
```typescript
const target = (this.remainder?.values[0] || 'config').toLowerCase();

if (target !== 'config' && target !== 'stats') {
  // Sanitize input in error message
  const safeTarget = target.replace(/[^a-z0-9]/g, '').slice(0, 20);
  throw new DocumentationError(
    `Unknown target: "${safeTarget}"...`, 
    ErrorCode.INVALID_INPUT
  );
}
```

---

## SUGGESTIONS

### 4. No path traversal protection for API files

**Lines 163-179**

```typescript
const files = FileSystem.readFolderItemNames(tsdocsDir);
const apiJsonFiles = files.filter((file: string) => file.endsWith('.api.json'));

for (const apiJsonFile of apiJsonFiles) {
  const apiJsonPath = path.join(tsdocsDir, apiJsonFile);
  apiModel.loadPackage(apiJsonPath);
}
```

**Issues:**
- `readFolderItemNames` returns all entries, including symlinks
- No validation that `apiJsonFile` is a valid filename (could contain `..` if filesystem allows)
- `apiModel.loadPackage` might be vulnerable to malicious file content (though trusted source)

**Recommendation:**
```typescript
const files = FileSystem.readFolderItemNames(tsdocsDir);
const apiJsonFiles = files.filter((file: string) => {
  return file.endsWith('.api.json') && !file.includes('..') && !file.includes('/');
});
```

---

### 5. Synchronous file I/O in async method

**Lines 163, 178**

```typescript
const files = FileSystem.readFolderItemNames(tsdocsDir);
// ...
apiModel.loadPackage(apiJsonPath);
```

**Issues:**
- `readFolderItemNames` is synchronous
- `loadPackage` is synchronous (and potentially slow for large files)
- Blocks the event loop

**Recommendation:**
- Use async versions if available in `FileSystem`
- Or wrap in `Promise.resolve()` if strictly necessary, though for a CLI this is low priority

---

## SECURITY SUMMARY

| Risk                           | Severity | Description                                                                         |
|--------------------------------|----------|-------------------------------------------------------------------------------------|
| Runtime Crash                  | HIGH     | Accessing undefined `this.remainder` will crash the tool.                           |
| Path Traversal                 | LOW      | Theoretical risk if `.tsdocs` directory contains malicious filenames.               |
| Input Validation               | LOW      | Unsanitized input in error message.                                                 |

---

## VERDICT

**Overall Quality: 6/10 (Focus on Reliability)**

This action has a critical bug (undefined `this.remainder`) that will likely cause it to crash at runtime. It also makes incorrect assumptions about file paths that will break for users with custom configurations.

**High Priority Improvements (SHOULD FIX):**
1. **Fix `this.remainder` definition**: Define it in the constructor so it's available at runtime.
2. **Fix hardcoded paths**: Use the configuration to find the `.tsdocs` directory.
3. **Remove manual `process.argv` parsing**: Rely on the framework.

**Medium Priority Improvements (COULD FIX):**
1. **Add input sanitization**: For the target argument.
2. **Add path validation**: For API model loading.

**Low Priority Improvements (NICE TO HAVE):**
1. **Async I/O**: For better performance on large projects.