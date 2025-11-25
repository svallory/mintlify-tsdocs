/**
 * Type definitions for RefLink Component
 */

import * as React from 'react';

/**
 * Props for the RefLink component.
 *
 * @example
 * ```tsx
 * <RefLink target="mint-tsdocs.MarkdownDocumenter">MarkdownDocumenter</RefLink>
 * <RefLink target="mint-tsdocs.MarkdownDocumenter.generateFiles">Generate Files</RefLink>
 * ```
 */
export interface RefLinkProps {
  /** API reference identifier (RefId) - dot-separated path to API item */
  target: string;
  /** Link text content (defaults to target if not provided) */
  children?: React.ReactNode;
}

/**
 * RefLink - Link component specifically for API references
 */
export const RefLink: React.FC<RefLinkProps>;

export default RefLink;
