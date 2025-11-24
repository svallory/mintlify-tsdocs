/**
 * Type definitions for PageLink component
 *
 * Provides compile-time type safety for documentation page links.
 * The target prop is validated against all valid PageIds at runtime.
 */

import type * as React from 'react';
import type { ValidPageId } from './ValidPages';

/**
 * PageId represents a documentation page identifier
 * Must match a page path in docs.json navigation
 *
 * @example
 * "introduction"
 * "installation"
 * "reference/mint-tsdocs.markdowndocumenter"
 * "components/type-tree"
 */
export type PageId = ValidPageId;

/**
 * Props for the PageLink component
 */
export interface PageLinkProps {
  /**
   * The documentation page identifier (PageId)
   * Must be a valid page that exists in docs.json navigation
   *
   * @example
   * "introduction"
   * "installation"
   * "reference/mint-tsdocs.markdowndocumenter"
   */
  target: PageId;

  /**
   * Optional children to render as link text
   * If not provided, the target will be used as the link text
   */
  children?: React.ReactNode;
}

/**
 * PageLink component - specialized for documentation page links
 *
 * @remarks
 * - Simpler than Link component (no kind attribute needed)
 * - Compile-time type safety ensures target is a valid page identifier
 * - Runtime validation highlights broken links with "broken-link" CSS class
 * - Gracefully handles SSR (validation only runs client-side)
 * - Automatically converts PageId to proper documentation path
 * - Handles both simple paths and paths with slashes
 * - Invalid links get title attribute with error message and CSS class for styling
 *
 * @example Simple page
 * <PageLink target="introduction">Introduction</PageLink>
 *
 * @example Page with path
 * <PageLink target="components/type-tree">TypeTree Component</PageLink>
 *
 * @example Reference page
 * <PageLink target="reference/mint-tsdocs.markdowndocumenter">MarkdownDocumenter</PageLink>
 */
export const PageLink: React.FC<PageLinkProps>;
