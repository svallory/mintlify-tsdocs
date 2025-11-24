/**
 * RefLink Component
 *
 * A specialized link component for API references only.
 * Simpler API than Link component - no kind attribute needed.
 *
 * Type safety is provided at compile-time via TypeScript.
 * Runtime validation highlights broken links with "broken-link" CSS class.
 *
 * @version 1.2.0
 */

import { VALID_REFS } from './ValidRefs';

// ============================================================================
// Type Definitions
// ============================================================================

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

// ============================================================================
// RefLink Component
// ============================================================================

/**
 * RefLink - Link component specifically for API references
 */
export const RefLink = ({ target, children }: RefLinkProps) => {
  // Validate target prop
  if (!target || typeof target !== 'string') {
    console.error('RefLink: Invalid target prop. Expected non-empty string.');
    return <span className="tsdocs-reflink broken-link" title="Invalid RefLink target">Invalid Link</span>;
  }

  const linkText = children || target;

  // Generate path from RefId with proper handling of empty segments
  // Format: mint-tsdocs.MarkdownDocumenter.generateFiles -> ./mint-tsdocs/MarkdownDocumenter/generateFiles
  // Filter out empty segments to avoid double slashes from patterns like "api..item"
  const segments = target.split('.').filter(segment => segment.length > 0);
  const path = segments.length > 0 ? `./${segments.join('/')}` : './invalid';

  // Runtime validation - only runs client-side
  // Gracefully handles SSR where VALID_REFS might not be available
  const isValid = typeof VALID_REFS !== 'undefined' && VALID_REFS.has(target);
  const className = !isValid ? 'tsdocs-reflink broken-link' : 'tsdocs-reflink';
  const title = !isValid ? `Broken API reference: ${target}` : undefined;

  return (
    <a href={path} className={className} title={title}>
      {linkText}
    </a>
  );
};

export default RefLink;
