/**
 * Custom assertions and test helpers
 */

import { expect } from 'vitest';

/**
 * Assert that a string is valid MDX content
 */
export function assertValidMdx(content: string): void {
  expect(content).toBeTruthy();
  expect(typeof content).toBe('string');

  // MDX files should typically have frontmatter
  if (content.includes('---')) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    expect(frontmatterMatch).toBeTruthy();

    // Parse frontmatter as YAML (basic check)
    const frontmatter = frontmatterMatch![1];
    expect(frontmatter).toMatch(/title:/);
  }

  // Should not have dangerous patterns
  expect(content).not.toMatch(/javascript:/i);
  expect(content).not.toMatch(/<script/i);
}

/**
 * Assert that a JSON object is valid Mintlify docs.json structure
 */
export function assertValidDocsJson(json: any): void {
  expect(json).toBeTruthy();
  expect(typeof json).toBe('object');

  // Should have name and navigation
  expect(json).toHaveProperty('name');
  expect(json).toHaveProperty('navigation');
  expect(Array.isArray(json.navigation)).toBe(true);

  // Each navigation item should have required properties
  for (const item of json.navigation) {
    expect(item).toHaveProperty('group');
    expect(item).toHaveProperty('pages');
    expect(Array.isArray(item.pages)).toBe(true);
  }
}

/**
 * Assert that a file path is safe (no traversal)
 */
export function assertSafePath(path: string, basePath: string): void {
  expect(path).toBeTruthy();
  expect(path.startsWith(basePath)).toBe(true);
  expect(path).not.toMatch(/\.\./);
  expect(path).not.toMatch(/~\//);
}

/**
 * Assert that cache statistics are valid
 */
export function assertValidCacheStats(stats: any): void {
  expect(stats).toBeTruthy();
  expect(typeof stats).toBe('object');

  expect(stats).toHaveProperty('size');
  expect(stats).toHaveProperty('maxSize');
  expect(stats).toHaveProperty('hitRate');
  expect(stats).toHaveProperty('hitCount');
  expect(stats).toHaveProperty('missCount');
  expect(stats).toHaveProperty('enabled');

  expect(typeof stats.size).toBe('number');
  expect(typeof stats.maxSize).toBe('number');
  expect(typeof stats.hitRate).toBe('number');
  expect(typeof stats.hitCount).toBe('number');
  expect(typeof stats.missCount).toBe('number');
  expect(typeof stats.enabled).toBe('boolean');

  expect(stats.size).toBeGreaterThanOrEqual(0);
  expect(stats.maxSize).toBeGreaterThan(0);
  expect(stats.hitRate).toBeGreaterThanOrEqual(0);
  expect(stats.hitRate).toBeLessThanOrEqual(1);
}

/**
 * Assert that a string is properly sanitized for YAML
 */
export function assertSanitizedYaml(sanitized: string, original: string): void {
  expect(sanitized).toBeTruthy();
  expect(typeof sanitized).toBe('string');

  // If original had special chars, sanitized should escape them
  if (original.includes('"') || original.includes("'") || original.includes('\n')) {
    expect(sanitized).not.toBe(original);
  }
}

/**
 * Assert that a string is properly sanitized for JSX
 */
export function assertSanitizedJsx(sanitized: string): void {
  expect(sanitized).toBeTruthy();
  expect(typeof sanitized).toBe('string');

  // Should not contain unescaped HTML entities
  expect(sanitized).not.toMatch(/[<>](?!&[a-z]+;)/);
  expect(sanitized).not.toMatch(/javascript:/i);
  expect(sanitized).not.toMatch(/data:/i);
}

/**
 * Assert that an error has a specific message pattern
 */
export function assertErrorMessage(error: any, pattern: string | RegExp): void {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBeTruthy();

  if (typeof pattern === 'string') {
    expect(error.message).toContain(pattern);
  } else {
    expect(error.message).toMatch(pattern);
  }
}

/**
 * Assert that a value throws with a specific error
 */
export async function assertThrowsAsync(
  fn: () => Promise<any>,
  errorPattern?: string | RegExp
): Promise<void> {
  let error: any;

  try {
    await fn();
  } catch (e) {
    error = e;
  }

  expect(error).toBeTruthy();

  if (errorPattern) {
    assertErrorMessage(error, errorPattern);
  }
}

/**
 * Assert that a cache key is unique
 */
export function assertUniqueCacheKey(key1: string, key2: string): void {
  expect(key1).toBeTruthy();
  expect(key2).toBeTruthy();
  expect(key1).not.toBe(key2);
}

/**
 * Assert that a template data object is valid
 */
export function assertValidTemplateData(data: any): void {
  expect(data).toBeTruthy();
  expect(typeof data).toBe('object');

  // Should have apiItem
  expect(data).toHaveProperty('apiItem');
  expect(data.apiItem).toHaveProperty('name');
  expect(data.apiItem).toHaveProperty('kind');

  // Should have page metadata
  expect(data).toHaveProperty('page');
  expect(data.page).toHaveProperty('title');
}
