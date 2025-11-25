import { ApiParameterListMixin, type ApiItem } from '@microsoft/api-extractor-model';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';

export class Utilities {
  private static readonly _badFilenameCharsRegExp: RegExp = /[^a-z0-9_\-\.]/gi;

  /**
   * Normalize display name to remove parentheses from constructors
   * API Extractor returns "(constructor)" but we want to display "constructor"
   */
  public static normalizeDisplayName(displayName: string): string {
    if (!displayName) return displayName;

    // Remove parentheses from constructor names
    // Handle both standalone "(constructor)" and qualified names like "MyClass.(constructor)"
    return displayName.replace(/\(constructor\)/g, 'constructor');
  }

  /**
   * Generates a concise signature for a function.  Example: "getArea(width, height)"
   */
  public static getConciseSignature(apiItem: ApiItem): string {
    if (ApiParameterListMixin.isBaseClassOf(apiItem)) {
      return apiItem.displayName + '(' + apiItem.parameters.map((x) => x.name).join(', ') + ')';
    }
    return apiItem.displayName;
  }

  /**
   * Converts bad filename characters to underscores.
   * Sanitizes input for safe filesystem use without strict validation.
   *
   * This function is designed for API Extractor output (valid identifiers)
   * and applies minimal sanitization to ensure filesystem compatibility.
   */
  public static getSafeFilenameForName(name: string): string {
    if (!name || name.trim().length === 0) {
      throw new DocumentationError(
        'Filename cannot be empty',
        ErrorCode.INVALID_FILENAME,
        { resource: name, operation: 'getSafeFilenameForName' }
      );
    }

    // Sanitize: remove path characters and replace invalid chars with underscores
    const sanitized = name
      .replace(/\.{2,}/g, '')  // Remove multiple dots (..)
      .replace(/[~\/\\]/g, '') // Remove path traversal characters
      .replace(Utilities._badFilenameCharsRegExp, '_')
      .toLowerCase()
      .substring(0, 50); // Limit length for filesystem compatibility

    if (!sanitized || sanitized.length === 0) {
      throw new DocumentationError(
        `Cannot create safe filename from: "${name}"`,
        ErrorCode.INVALID_FILENAME,
        { resource: name, operation: 'getSafeFilenameForName' }
      );
    }

    return sanitized;
  }

  /**
   * Converts bad filename characters to underscores while preserving original casing.
   * Sanitizes input for safe filesystem use without strict validation.
   * Used for nested folder structure where case-sensitive names are desired.
   *
   * This function is designed for API Extractor output (valid identifiers)
   * and applies minimal sanitization to ensure filesystem compatibility.
   */
  public static getSafeFilenamePreservingCase(name: string): string {
    if (!name || name.trim().length === 0) {
      throw new DocumentationError(
        'Filename cannot be empty',
        ErrorCode.INVALID_FILENAME,
        { resource: name, operation: 'getSafeFilenamePreservingCase' }
      );
    }

    // Sanitize: remove path characters and replace invalid chars with underscores
    const sanitized = name
      .replace(/\.{2,}/g, '')  // Remove multiple dots (..)
      .replace(/[~\/\\]/g, '') // Remove path traversal characters
      .replace(Utilities._badFilenameCharsRegExp, '_')
      .substring(0, 50); // Limit length for filesystem compatibility

    if (!sanitized || sanitized.length === 0) {
      throw new DocumentationError(
        `Cannot create safe filename from: "${name}"`,
        ErrorCode.INVALID_FILENAME,
        { resource: name, operation: 'getSafeFilenamePreservingCase' }
      );
    }

    return sanitized;
  }
}
