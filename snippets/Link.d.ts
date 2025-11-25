/**
 * Type definitions for Link Component
 */

import * as React from 'react';

/**
 * Props for the Link component.
 *
 * @deprecated Use PageLink or RefLink directly instead
 */
export interface LinkProps {
  /** Type of link: 'page' for documentation pages, 'ref' for API references */
  kind: 'page' | 'ref';
  /** Link target (PageId or RefId depending on kind) */
  target: string;
  /** Link text content (defaults to target if not provided) */
  children?: React.ReactNode;
}

/**
 * Link - Generic link component (compatibility wrapper)
 * @deprecated Use PageLink or RefLink directly instead
 */
export const Link: React.FC<LinkProps>;

export default Link;
