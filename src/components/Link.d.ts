/**
 * Type definitions for Link component
 *
 * Provides compile-time type safety for link kind/target relationship.
 * Runtime validation ensures targets exist in the documentation.
 */

import React from 'react';

/**
 * RefId represents an API reference identifier
 * Format: "PackageName.ClassName.MemberName" or "PackageName.InterfaceName"
 *
 * @example
 * "mint-tsdocs.MarkdownDocumenter"
 * "mint-tsdocs.ApiModelError.(constructor)"
 */
export type RefId = string;

/**
 * PageId represents a documentation page identifier
 * Must be a relative or absolute path to a documentation page
 *
 * @example
 * "introduction"
 * "reference/index"
 * "/docs/guides/getting-started"
 */
export type PageId = string;

/**
 * LinkKind determines how the target is resolved
 * - 'ref': Target is a RefId pointing to an API item
 * - 'page': Target is a PageId pointing to a documentation page
 */
export type LinkKind = 'ref' | 'page';

/**
 * Conditional type for link target based on kind
 * Ensures the target type matches the specified kind
 */
export type LinkTarget<K extends LinkKind> =
  K extends 'ref' ? RefId :
  K extends 'page' ? PageId :
  never;

/**
 * Type-safe props for the Link component
 * The target type is automatically inferred based on the kind
 *
 * @example Type-safe ref link
 * <Link kind="ref" target="mint-tsdocs.MarkdownDocumenter">...</Link>
 *
 * @example Type-safe page link
 * <Link kind="page" target="introduction">...</Link>
 */
export type LinkProps<K extends LinkKind = LinkKind> = {
  /**
   * The kind of link (API reference or documentation page)
   */
  kind: K;

  /**
   * The target identifier (type-checked based on kind)
   * - When kind="ref": expects a RefId (API reference)
   * - When kind="page": expects a PageId (documentation page path)
   */
  target: LinkTarget<K>;

  /**
   * Optional children to render as link text
   * If not provided, the target will be used as the link text
   */
  children?: React.ReactNode;
};

/**
 * Validation result for a link target
 */
export interface LinkValidation {
  /**
   * Whether the target is valid
   */
  isValid: boolean;

  /**
   * The resolved path to the target (if valid)
   */
  path?: string;

  /**
   * Error message if the target is invalid
   */
  error?: string;
}

/**
 * Link component with compile-time and runtime validation
 *
 * @remarks
 * - Compile-time: TypeScript ensures target type matches kind
 * - Runtime: Validates target exists in ValidRefs (for kind="ref")
 *
 * @example
 * <Link kind="ref" target="mint-tsdocs.MarkdownDocumenter">Documenter</Link>
 * <Link kind="page" target="introduction">Intro</Link>
 */
export const Link: <K extends LinkKind>(props: LinkProps<K>) => React.ReactElement;
