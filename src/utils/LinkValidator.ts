/**
 * Utilities for validating and resolving link targets
 * @packageDocumentation
 */

import { ApiItem, ApiModel, ApiItemKind } from '@microsoft/api-extractor-model';
import { PackageName } from '@rushstack/node-core-library';

/**
 * Validation result for links
 */
export interface LinkValidation {
  /** Whether the link target is valid */
  isValid: boolean;
  /** The resolved path to the target (if valid) */
  path?: string;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Validates and resolves link targets for the Link component
 */
export class LinkValidator {
  private readonly _apiModel: ApiModel;
  private readonly _itemCache: Map<string, ApiItem | null>;
  private readonly _getFilenameForApiItem: (apiItem: ApiItem) => string;

  constructor(apiModel: ApiModel, getFilenameForApiItem: (apiItem: ApiItem) => string) {
    this._apiModel = apiModel;
    this._getFilenameForApiItem = getFilenameForApiItem;
    this._itemCache = new Map();
  }

  /**
   * Generate a RefId from an ApiItem
   * Format: "PackageName.ClassName.MemberName"
   */
  public getRefId(apiItem: ApiItem): string {
    const parts: string[] = [];
    let current: ApiItem | undefined = apiItem;

    // Build the path from the item up to the package
    while (current) {
      if (current.kind === ApiItemKind.Package) {
        const packageName = current.displayName || 'package';
        parts.unshift(PackageName.getUnscopedName(packageName));
        break;
      }
      // Skip EntryPoint and items without display names
      if (current.kind !== ApiItemKind.EntryPoint && current.displayName) {
        parts.unshift(current.displayName);
      }
      current = current.parent;
    }

    return parts.join('.');
  }

  /**
   * Validate a RefId and return validation result
   */
  public validateRefId(refId: string): LinkValidation {
    // Check cache first
    if (this._itemCache.has(refId)) {
      const cachedItem = this._itemCache.get(refId);
      if (cachedItem) {
        return {
          isValid: true,
          path: './' + this._getFilenameForApiItem(cachedItem)
        };
      } else {
        return {
          isValid: false,
          error: `API item not found: ${refId}`
        };
      }
    }

    // Try to find the API item
    const apiItem = this._findApiItemByRefId(refId);

    // Cache the result
    this._itemCache.set(refId, apiItem);

    if (apiItem) {
      return {
        isValid: true,
        path: './' + this._getFilenameForApiItem(apiItem)
      };
    }

    return {
      isValid: false,
      error: `API item not found: ${refId}`
    };
  }

  /**
   * Validate a PageId (documentation page path)
   * For now, we just validate the format - actual file existence would be checked at runtime
   */
  public validatePageId(pageId: string): LinkValidation {
    // Basic validation - must be a relative or absolute path
    if (!pageId || pageId.trim().length === 0) {
      return {
        isValid: false,
        error: 'PageId cannot be empty'
      };
    }

    // Should start with ./ or ../ or / for Mintlify
    if (!pageId.startsWith('./') && !pageId.startsWith('../') && !pageId.startsWith('/')) {
      return {
        isValid: false,
        error: 'PageId must start with ./, ../, or /'
      };
    }

    return {
      isValid: true,
      path: pageId
    };
  }

  /**
   * Find an ApiItem by its RefId
   */
  private _findApiItemByRefId(refId: string): ApiItem | null {
    const parts = refId.split('.');
    if (parts.length === 0) {
      return null;
    }

    // First part should be the package name
    const packageName = parts[0];

    // Find the package
    const pkg = this._findPackageByUnscopedName(packageName);
    if (!pkg) {
      return null;
    }

    // If only package name, return the package
    if (parts.length === 1) {
      return pkg;
    }

    // Navigate down the hierarchy
    let current: ApiItem = pkg;
    for (let i = 1; i < parts.length; i++) {
      const memberName = parts[i];
      const member = this._findMemberByName(current, memberName);
      if (!member) {
        return null;
      }
      current = member;
    }

    return current;
  }

  /**
   * Find a package by its unscoped name
   */
  private _findPackageByUnscopedName(unscopedName: string): ApiItem | null {
    for (const pkg of this._apiModel.packages) {
      const pkgUnscopedName = PackageName.getUnscopedName(pkg.displayName);
      if (pkgUnscopedName === unscopedName) {
        return pkg;
      }
    }
    return null;
  }

  /**
   * Find a member of an ApiItem by display name
   */
  private _findMemberByName(parent: ApiItem, memberName: string): ApiItem | null {
    for (const member of parent.members) {
      if (member.displayName === memberName) {
        return member;
      }
    }
    return null;
  }

  /**
   * Clear the validation cache
   */
  public clearCache(): void {
    this._itemCache.clear();
  }
}