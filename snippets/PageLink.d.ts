/**
 * Type definitions for PageLink Component
 */

import * as React from 'react';

/**
 * Props for the PageLink component.
 *
 * @example
 * ```tsx
 * <PageLink target="introduction">Introduction</PageLink>
 * <PageLink target="components/type-tree">TypeTree Component</PageLink>
 * ```
 */
export interface PageLinkProps {
  /** Documentation page identifier (PageId) - path relative to docs root */
  target: string;
  /** Link text content (defaults to target if not provided) */
  children?: React.ReactNode;
}

/**
 * PageLink - Link component specifically for documentation pages
 */
export const PageLink: React.FC<PageLinkProps>;

export default PageLink;
