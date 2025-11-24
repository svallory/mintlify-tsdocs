# Security Review: ApiDocumenterCommandLine.ts

## ⚠️ IMPORTANT: Security Context

This review was conducted with an internet-facing web application threat model.

**Actual Context:** mint-tsdocs is a LOCAL DEVELOPER CLI TOOL that:
- Runs on developer machines (not production servers)
- Processes trusted input (developer's own TypeScript code)
- Has no untrusted user input or internet exposure
- Will evolve to CI/CD and potentially SaaS (future work)

**Impact on This Review:** Several "critical vulnerabilities" are actually non-issues for local developer tools.

---

**Reviewed**: 2025-11-23
**Scope**: CLI command-line parsing, action registration, and related action files
**Severity Level**: Reliability & Robustness Assessment

---

## Executive Summary

The CLI layer currently presents **robustness and predictability issues**, particularly around unexpected command execution risks in `InitAction.ts`. While some utility functions for robust path handling exist (SecurityUtils), their application is inconsistent.

**Robustness Level**: MEDIUM
**Recommended Action**: Address fundamental issues to ensure predictable and reliable tool operation.

---

## HIGH PRIORITY ROBUSTNESS & PREDICTABILITY ISSUES

### 1. Unexpected Command Execution Risk - InitAction.ts (SEVERITY: HIGH - Reliability)

**Location**: `InitAction.ts:838-868` (`_runCommand` method)

```typescript
const proc = child_process.spawn(command, args, {
  cwd,
  stdio: useInherit ? 'inherit' : 'pipe',
  shell: true  // ⚠️ RELIABILITY RISK
});
```

**Issue**: `shell: true` enables shell interpretation of the command and arguments, meaning that if `command` or `args` contain shell metacharacters provided by user input, unintended system commands can be executed.

**Scenario for Unexpected Behavior**:
1. A user provides a specially crafted path when prompted for the docs directory (e.g., `'"; rm -rf /; #'`).
2. This input is eventually passed to `_runCommand`.
3. The command is executed with `shell: true`, causing the shell to interpret the semicolon as a command separator, leading to the execution of `rm -rf /` (or other unintended commands) on the user's system.

**Real Impact**: Accidental data loss, corruption of user files, or unintended system state changes, due to the tool executing commands beyond its intended scope.

**Why SecurityUtils.validateCliInput Doesn't Help**:
- Line 514: User input from `clack.text()` is NOT validated on this specific path.
- `relativeDocsDir` is computed via `path.relative()` without sufficient sanitization.
- `validateCliInput` checks for `;|&` but this particular code path BYPASSES it.

**Fix Required**:
```typescript
// REMOVE shell: true and pass arguments as an array
const proc = child_process.spawn(command, args, {
  cwd,
  stdio: useInherit ? 'inherit' : 'pipe',
  shell: false  // Use array-based args to prevent shell interpretation
});

// Also, VALIDATE cwd before use for robustness
const safeCwd = SecurityUtils.validateFilePath(process.cwd(), cwd);
```

---

### 2. Unintended NPX Command Execution - GenerateAction.ts (SEVERITY: MEDIUM - Reliability)

**Location**: `GenerateAction.ts:380`

```typescript
const tscCommand = `npx tsc --project ${resolvedTsconfigPath}`;
execSync(tscCommand, { cwd: projectDir, stdio: 'inherit' });
```

**Issues**:
1. String interpolation directly into a shell command, executed via `execSync`.
2. `resolvedTsconfigPath` could contain shell metacharacters provided via user input (e.g., in a config file).
3. `execSync` executes via shell by default, allowing interpretation of metacharacters.
4. `projectDir` as cwd is not validated before use.

**Scenario for Unexpected Behavior**:
If a user creates a project or configures a `tsconfig.json` path that includes shell metacharacters (e.g., `tsconfig'; echo pwned > /tmp/hacked;.json`), the `npx tsc` command could unintentionally execute additional commands, leading to unexpected system modifications.

**Fix Required**:
```typescript
const { execFileSync } = await import('child_process');
execFileSync('npx', ['tsc', '--project', resolvedTsconfigPath], {
  cwd: SecurityUtils.validateFilePath(originalCwd, projectDir), // Validate cwd for robustness
  stdio: 'inherit'
});
```

---

### 3. Incorrect Path Handling Risk - Multiple Locations (SEVERITY: MEDIUM)

**Location**: `GenerateAction.ts:109-118`, `InitAction.ts:78-79`

```typescript
// User-controlled projectDir without validation
projectDir = path.resolve(process.cwd(), this.remainder.values[0]);
```

**Issue**: User-provided paths are not consistently validated, which can allow the tool to operate outside the intended project directory.

**Unexpected Path Behavior Scenarios**:
```bash
# Accidental access to parent directories
mint-tsdocs generate ../../../../../../etc

# If combined with unvalidated output paths, could lead to writing to unintended locations.
```

**Current Defenses**: None. `SecurityUtils.validateFilePath` exists but is NOT used for `projectDir` validation.

**Fix Required**:
```typescript
// Validate project directory is within allowed workspace for predictable behavior
const allowedWorkspace = process.cwd();
projectDir = SecurityUtils.validateFilePath(
  allowedWorkspace,
  this.remainder.values[0]
);
```

---

### 4. Unexpected Configuration Modification Risk via JSON.parse - Multiple Files (SEVERITY: LOW - Code Quality)

**Location**:
- `InitAction.ts:158, 179, 246, 576, 784`
- `CustomizeAction.ts:213`
- `GenerateAction.ts:264`

```typescript
const packageJson = JSON.parse(FileSystem.readFile(packageJsonPath));
const config = JSON.parse(existingContent);
```

**Issue**: Direct `JSON.parse` without protection against property injection (often referred to as "prototype pollution" in a broader context).

**Scenario for Unexpected Behavior**:
If configuration files or other JSON inputs (which might originate from user input) contain properties like `__proto__`, `constructor`, or `prototype`, these could be inadvertently added to fundamental JavaScript objects.

**Real Impact**: Unpredictable tool behavior due to unexpected object properties or accidental configuration changes, leading to difficult-to-debug issues or incorrect processing.

**Note**: `SecurityUtils.validateJsonContent` checks for `__proto__` but:
1. NOT USED for package.json parsing
2. NOT USED for config file parsing
3. Only used in `GenerateAction.ts:539` for .api.json files

**Fix Required**:
```typescript
// Use secure JSON parsing with property filtering
const content = FileSystem.readFile(packageJsonPath);
// Consider adding SecurityUtils.validateJsonContent(content); before parsing for basic content checks
const packageJson = JSON.parse(content, (key, value) => {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    return undefined; // Filter out potentially problematic keys
  }
  return value;
});

// Or, for complete isolation, parse into a null-prototype object:
// const packageJson = Object.assign(Object.create(null), JSON.parse(content));
```

---

## ROBUSTNESS & DATA INTEGRITY ISSUES

### 5. Inconsistent Path Validation for File System Operations (SEVERITY: MEDIUM)

**Issue**: File operations use user input or derived paths without consistent validation, leading to unpredictable behavior.

**Examples**:

**InitAction.ts:686** - VS Code settings manipulation:
```typescript
FileSystem.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
```
- No validation ensures `settingsPath` is within the intended `.vscode` directory.
- Could lead to writing configuration files to unintended locations if `FileSystem` path handling has unexpected behavior.

**CustomizeAction.ts:166** - Template file writes:
```typescript
FileSystem.writeFile(destPath, finalContent);
```
- `entry` from `FileSystem.readFolderItemNames()` could potentially contain `..` or path separators, which might be used to construct `destPath` outside expected boundaries.
- No sanitization before constructing `destPath` to ensure it's within the intended target.

**Fix**: Validate ALL paths before file operations to ensure they reside within expected boundaries:
```typescript
const safePath = SecurityUtils.validateFilePath(expectedBaseDir, userPath);
FileSystem.writeFile(safePath, content);
```

---

### 6. Fragile `process.chdir` Usage - GenerateAction.ts (SEVERITY: MEDIUM)

**Location**: `GenerateAction.ts:126`

```typescript
process.chdir(projectDir);
```

**Issues**:
1. Changes global process state, potentially affecting all code and third-party libraries.
2. Restoration in `finally` block (line 240) could fail silently, leaving the process in an unexpected directory.
3. No validation of `projectDir` before `chdir` to ensure it's a valid and intended directory.
4. Introduces potential race conditions in concurrent or multi-threaded scenarios (though less common in Node.js CLIs, still a design concern).

**Unintended Working Directory Changes Scenario**:
If an error occurs after `process.chdir` but before the `finally` block can restore the original working directory, subsequent file operations or relative path resolutions could happen from an unintended location. This can lead to files being created/read/deleted in the wrong place, or other unexpected tool behavior.

**Fix**: Avoid `process.chdir` entirely. Instead, pass absolute `projectDir` paths to all relevant operations to ensure consistent behavior regardless of the current working directory.
```typescript
// Instead of changing cwd, pass projectDir to all operations
const absoluteConfigPath = path.join(projectDir, 'mint-tsdocs.config.json');
```

---

### 7. Missing Robustness Validation on User Prompts (SEVERITY: MEDIUM)

**Issue**: User input from `clack.text()` and `clack.confirm()` is often trusted without sufficient validation, leading to potential configuration issues or unexpected tool behavior.

**Examples**:

**InitAction.ts:146-151** - `tabName`:
```typescript
tabName = (await clack.text({
  message: 'Tab name in Mintlify navigation?',
  placeholder: 'Code Reference',
  defaultValue: 'Code Reference'
})) as string;
```
- No validation beyond basic type casting.
- Could contain characters that are invalid for file paths or YAML (e.g., path separators, control characters), leading to malformed `docs.json` entries or unexpected file system interactions.

**InitAction.ts:161-171** - `groupName`:
```typescript
groupName = (await clack.text({
  message: 'Group name for sidebar...',
  validate: (value) => {
    if (!value || value.trim() === '') {
      return 'Group name cannot be empty';
    }
    return undefined;
  }
})) as string;
```
- Only validates for non-empty string.
- No sanitization for characters that could break YAML formatting or act as path separators, potentially corrupting configuration files or leading to unpredictable navigation.

**Fix**: Validate and sanitize ALL user input according to its intended use (e.g., for filenames, display text, or configuration values) to ensure predictable tool behavior and data integrity.
```typescript
let tabName = await clack.text({ ... }) as string;
tabName = SecurityUtils.validateCliInput(tabName, 'Tab name'); // Or a more specific validation utility
tabName = SecurityUtils.sanitizeYamlText(tabName); // If intended for YAML
```

---

## MAINTAINABILITY & CODE QUALITY ISSUES

### 8. Hardcoded Action List - ApiDocumenterCommandLine.ts (SEVERITY: LOW)

**Location**: `ApiDocumenterCommandLine.ts:100`

```typescript
const knownActions = ['init', 'generate', 'customize', 'show', 'lint', 'help', 'version', '--help', '-h', '--version', '-v'];
```

**Issues**:
1. Hardcoded list must be manually updated when adding actions.
2. Can easily get out of sync with actual actions (lines 117-124).
3. Creates a maintenance burden and potential for subtle bugs if not updated consistently.

**Better Approach**:
```typescript
const knownActions = new Set([
  ...this.actions.map(a => a.actionName),
  '--help', '-h', '--version', '-v'
]);
```

---

### 9. Console Method Tampering - GenerateAction.ts (SEVERITY: LOW)

**Location**: `GenerateAction.ts:433-440`

```typescript
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = () => {};
console.error = () => {};
console.warn = () => {};
```

**Issues**:
1. Direct mutation of global `console` methods, which affects ALL code in the process, including third-party libraries.
2. If an exception occurs before the original console methods can be restored (line 481-484), the `console` can remain in a broken state for the remainder of the process.
3. Makes debugging harder by suppressing output, and can introduce unexpected behavior in other parts of the application that rely on console output.
4. Introduces potential race conditions if multiple operations attempt to tamper with the console concurrently.

**Better Approach**:
- Use API Extractor's message callback instead of suppressing `console` directly.
- Or use a scoped `console` wrapper that only redirects output for specific operations.
```

---

### 10. Insufficient Error Context (SEVERITY: LOW)

**Issue**: Error messages don't always include sufficient context, making debugging and understanding failures more difficult.

**Example**: `InitAction.ts:906-911`
```typescript
reject(
  new DocumentationError(
    `Failed to run: ${command} ${args.join(' ')}\n${stderr || stdout}`,
    ErrorCode.COMMAND_FAILED
  )
);
```

**Problem**:
- While the command is included in the error (good), important context like the `cwd` where it was executed, or more detailed process information, is missing.
- This lack of detail makes post-incident analysis and debugging harder for the user.

**Fix**: Add structured error context to provide more actionable information:
```typescript
new DocumentationError(
  `Failed to run: ${command}`,
  ErrorCode.COMMAND_FAILED,
  {
    command,
    args,
    cwd, // Include cwd for better context
    exitCode,
    data: { stderr, stdout }
  }
);
```

---

## ARCHITECTURAL DESIGN & CONSISTENCY ISSUES

### 11. Inconsistent Robustness Utility Usage (SEVERITY: MEDIUM)

**Issue**: `SecurityUtils` exists but is inconsistently applied across the codebase, leading to uneven robustness and predictability in handling various inputs and operations.

**Usage Analysis**:
- ✅ Used: `GenerateAction.ts` lines 514, 533, 534, 539 (for `.api.json` files – though as discussed, this specific usage might be unnecessary overhead).
- ❌ NOT used: `InitAction.ts` for ANY user input.
- ❌ NOT used: `CustomizeAction.ts` for template paths.
- ❌ NOT used: `GenerateAction.ts` for `projectDir`, `tsconfigPath`.
- ❌ NOT used: Any `JSON.parse` operations for config files that might contain user input.

**Root Cause**: Lack of a consistent enforcement mechanism means applying utility functions for robustness is optional and depends on individual developer diligence.

**Fix**:
1. Create wrapper functions that ALWAYS validate necessary inputs.
2. Use TypeScript branded types to enforce validation at compile time where appropriate.
3. Add linting rules to detect direct `FileSystem`/`child_process` usage without prior validation.

---

### 12. Overly Permissive Error Boundary (SEVERITY: LOW)

**Location**: `ErrorBoundary.ts:72-78`

```typescript
this.options = {
  continueOnError: options.continueOnError ?? true,  // ⚠️ Defaults to continue
  maxErrors: options.maxErrors ?? 10,
  logErrors: options.logErrors ?? true,
  errorLogPath: options.errorLogPath || '',
  includeStackTraces: options.includeStackTraces ?? false
};
```

**Issue**:
- `continueOnError: true` by default means that errors might be silently ignored, potentially masking deeper problems or leading to unexpected partial results.
- `maxErrors: 10` is an arbitrary limit; for certain critical operations, a single error might warrant immediate termination.
- This default behavior can hinder debugging by allowing the tool to continue processing after encountering an issue.

**Recommendation**: For operations where data integrity or predictable behavior is paramount, configure `ErrorBoundary` to fail fast and provide immediate feedback:
```typescript
const strictBoundary = new ErrorBoundary({
  continueOnError: false,  // Fail on the first error for critical operations
  maxErrors: 1,
  logErrors: true,
  includeStackTraces: true  // For better debugging context
});
```

---

### 13. Action Constructor Inconsistency (SEVERITY: LOW)

**Issue**: Action constructors have different signatures, leading to inconsistent object creation patterns.

**Analysis**:
- `InitAction`, `GenerateAction`: Take `DocumenterCli` instance.
- `CustomizeAction`, `ShowAction`, `LintAction`: Take no parameters, or do not consistently receive a reference to the main CLI parser.

**Location**: `ApiDocumenterCommandLine.ts:117-123`

```typescript
this.addAction(new InitAction(this));
this.addAction(new GenerateAction(this));
this.addAction(new CustomizeAction());  // No parent reference
```

**Impact**:
- Child actions may not have access to shared CLI properties (like verbose/debug flags) from the parent parser, leading to redundant code or inconsistent behavior.
- Inconsistent architecture makes the codebase harder to understand, review, and extend.
- Can lead to maintainability challenges as developers need to remember different instantiation patterns.

**Fix**: Standardize all actions to receive the parent parser (or a relevant subset of its properties) if they need to interact with global CLI state:
```typescript
export abstract class BaseAction extends CommandLineAction {
  constructor(protected readonly parser: DocumenterCli) {
    super({ ... });
  }

  get isVerbose(): boolean { return this.parser.isVerbose; }
  get isDebug(): boolean { return this.parser.isDebug; }
}
```

---

## CODE QUALITY & MAINTAINABILITY ISSUES

### 14. TypeScript Safety Violations

**Issue**: Excessive type assertions bypass TypeScript safety.

**Examples**:
- `InitAction.ts:150, 171, 282, 358, 386`: `as string` casts on clack responses
- No runtime validation that cast is correct
- Silent failures if clack API changes

**Better**:
```typescript
const response = await clack.text({ ... });
if (typeof response !== 'string') {
  throw new DocumentationError('Invalid input type', ErrorCode.VALIDATION_ERROR);
}
const tabName: string = response;
```

---

### 15. Duplicate Default Action Logic

**Location**: `ApiDocumenterCommandLine.ts:88-109`

**Issue**: Complex logic to handle default 'generate' action duplicated with positional arg handling.

**Problems**:
1. Lines 100-105: Hardcoded known actions list
2. Lines 103-104: Complex conditional for directory argument detection
3. Fragile - breaks if user has directory named "init" or "generate"

**Test Case That Breaks**:
```bash
# Create directory named "generate"
mkdir generate
cd generate

# This will fail unexpectedly
mint-tsdocs
# Tries to run: mint-tsdocs generate generate
```

---

### 16. Silent Error Swallowing

**Location**: `InitAction.ts:807-810`

```typescript
} catch (error) {
  // If we can't update package.json, just skip it
  return false;
}
```

**Issue**:
- Errors updating package.json are silently ignored
- Could hide permission issues, filesystem corruption
- User gets no feedback that automation failed

**Same Pattern**: `CustomizeAction.ts:228-231`

---

### 17. `process.exit` in Library Code (SEVERITY: MEDIUM)

**Locations**:
- `InitAction.ts:110, 154, 176, 301, 356, 390, 442, 479, 517`
- `CustomizeAction.ts:77`

**Issue**: The code directly calls `process.exit(0)` to terminate the application in response to user cancellation or certain conditions.

**Problems**:
1. Prevents any cleanup code (e.g., `finally` blocks, event listeners) from running, potentially leaving resources open or in an inconsistent state.
2. Bypasses `finally` blocks in calling code, which can hide errors or prevent necessary resource releases.
3. Makes unit testing impossible, as `process.exit` cannot be easily caught or mocked, leading to brittle tests or lack of testability for these scenarios.
4. Violates library best practices; libraries should throw exceptions or return error codes, allowing the calling application to decide how to handle termination.

**Fix**: Throw an exception instead, allowing the application's main entry point to catch it and handle graceful termination:
```typescript
if (clack.isCancel(shouldOverwrite) || !shouldOverwrite) {
  throw new DocumentationError(
    'Operation cancelled by user',
    ErrorCode.USER_CANCELLED
  );
}
```

---

## CONFIGURATION ROBUSTNESS

### 18. Schema Integrity of Configuration Files (SEVERITY: LOW)

**Location**: Multiple config file operations

**Issue**: Configuration files (e.g., `mint-tsdocs.config.json`) often include a `$schema` field that references external or local URLs:

```typescript
$schema: './node_modules/mint-tsdocs/lib/schemas/config.schema.json'
$schema: 'https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json'
```

**Potential Issues**:
1. If an external schema URL is unavailable or changes, it could lead to validation failures or unexpected behavior when parsing configuration.
2. Relying on external schemas without integrity checking (e.g., Subresource Integrity) could introduce unpredictability if the external resource is modified.
3. For local schema references, ensuring the path is always correct and accessible is important for robust operation.

**Recommendation**:
- Prefer local schema references.
- If external schemas are used, consider implementing integrity checks (e.g., SRI) or ensuring robust error handling if the schema cannot be retrieved.

---

## TESTING GAPS

### 19. No Robustness & Predictability Tests

**Observation**: There is no evidence of tests specifically focused on validating the tool's robustness and predictable behavior when encountering unexpected or non-standard inputs:
- No test cases for unexpected command execution due to unvalidated input.
- No test cases for incorrect path handling (e.g., attempting to operate outside project boundaries).
- No test cases for unpredictable configuration modification (e.g., due to property injection).
- No test cases for unexpected input behavior from user prompts.

**Recommendation**: Add a dedicated test suite to verify robust and predictable behavior:
```typescript
describe('Robustness & Predictability', () => {
  it('should prevent unexpected command execution with malicious input', async () => {
    const problematicPath = '\'; rm -rf /tmp/test; echo \'';
    await expect(
      initAction._runCommand('mint', ['new', problematicPath], '/tmp')
    ).rejects.toThrow(/validation error|unexpected input/);
  });

  it('should prevent incorrect path handling with parent directory traversal', async () => {
    const maliciousPath = '../../../../etc';
    await expect(
      generateAction.executeWithArgs([maliciousPath]) // Assuming generateAction handles projectDir
    ).rejects.toThrow(/invalid path|outside allowed boundaries/);
  });

  it('should prevent unexpected configuration modification via JSON input', async () => {
    const maliciousJson = '{ "__proto__": { "polluted": true } }';
    // Test that parsing this JSON does not modify Object.prototype
    const parsedConfig = JSON.parseWithRobustness(maliciousJson); // Assuming a robust JSON parser
    expect(({}).polluted).toBeUndefined();
    expect(parsedConfig.polluted).toBeUndefined();
  });
});
```

---

## SUMMARY & RECOMMENDATIONS

### High Priority Actions (Crucial for Robustness & Predictability)

1. **REMOVE `shell: true`** from all `child_process.spawn` calls where user input can affect command execution to prevent unintended commands.
2. **USE `execFileSync`** (or `spawn` with array arguments) instead of `execSync` with string commands when executing external processes to ensure predictable command execution.
3. **VALIDATE `projectDir`** and all other user-provided or derived paths using `SecurityUtils` (or similar robust validation) before any file system operations to prevent incorrect path handling.
4. **SANITIZE all user input** from `clack` prompts and configuration files before use in file paths, command arguments, or configuration values to ensure data integrity and predictable behavior.
5. **ADD property filtering** (e.g., for `__proto__`, `constructor`, `prototype`) to all `JSON.parse` calls that process user-provided or potentially user-influenced JSON to prevent unexpected configuration modifications.

### Medium Priority Actions (Improve Reliability & Maintainability)

6. Consistently validate all file paths before `FileSystem` operations to ensure operations occur in intended locations.
7. Eliminate `process.chdir` usage in favor of explicit absolute paths passed to functions to prevent unintended working directory changes.
8. Add comprehensive robustness and predictability test suite to cover scenarios of unexpected input.
9. Enforce consistent usage of `SecurityUtils` (or similar utility functions) via linting rules or wrapper functions to ensure uniform robustness.
10. Replace `process.exit` with throwing exceptions in library code to allow for proper cleanup and testability.

### Low Priority Actions (Enhance Code Quality & User Experience)

11. Standardize action constructors for better architectural consistency and maintainability.
12. Remove global `console` method tampering to improve debugging and predictability.
13. Improve error context for auditing and debugging, providing more actionable information.
14. Fix duplicate action detection logic to improve maintainability.

### Robustness & Predictability Score: 3/10

**Breakdown**:
- Unexpected Command Execution: 0/10 (critical risk to system state)
- Input Validation & Sanitization: 3/10 (inconsistent application)
- Path Handling: 4/10 (partial protection, inconsistent application)
- Configuration Integrity: 3/10 (vulnerable to unexpected modification)
- Error Handling & Predictability: 6/10 (ErrorBoundary exists but needs careful configuration)
- Architectural Consistency: 5/10 (utilities exist but are optional)

### Code Quality & Maintainability Score: 5/10

**Breakdown**:
- TypeScript Usage: 4/10 (excessive `any`, casts, runtime assumptions)
- Error Handling: 7/10 (ErrorBoundary is a good pattern, but its defaults/usage can be improved)
- Maintainability: 5/10 (inconsistent patterns, hardcoded values)
- Testing: 3/10 (lack of specific robustness tests)

---

## Conclusion

This is **NOT production-ready code for a robust CLI tool**. The risk of unintended command execution alone (e.g., via `InitAction.ts` `shell: true`) is a **critical concern**, as it can lead to accidental data loss or corruption of the user's system. The lack of consistent input validation and path handling throughout the codebase creates multiple avenues for unpredictable behavior.

The good news: `SecurityUtils` infrastructure exists, providing building blocks for robust validation. The bad news: its application is optional and inconsistently enforced.

**Address these high-priority issues to ensure the tool operates predictably and reliably for its users.**
