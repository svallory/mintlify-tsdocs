/**
 * PageLink Component
 *
 * A specialized link component for documentation pages only.
 * Simpler API than Link component - no kind attribute needed.
 *
 * Type safety is provided at compile-time via TypeScript.
 * Runtime validation highlights broken links with "broken-link" CSS class.
 *
 * @version 1.2.0
 */

import { VALID_PAGES } from '/snippets/tsdocs/ValidPages.jsx';

// ============================================================================
// PageLink Component
// ============================================================================

/**
 * PageLink - Link component specifically for documentation pages
 * @param {import('./PageLink').PageLinkProps} props
 * @returns {JSX.Element}
 */
export const PageLink = ({ target, children }) => {
  // Validate target prop
  if (!target || typeof target !== 'string') {
    console.error('PageLink: Invalid target prop. Expected non-empty string.');
    return <span className="tsdocs-pagelink broken-link" title="Invalid PageLink target">Invalid Link</span>;
  }

  const linkText = children || target;

  // Generate path - prefix with / if not already there
  let path = target;
  if (!path.startsWith('/')) {
    path = `/${target}`;
  }

  // Runtime validation - only runs client-side
  // Gracefully handles SSR where VALID_PAGES might not be available
  const isValid = typeof VALID_PAGES !== 'undefined' && VALID_PAGES.has(target);
  const className = !isValid ? 'tsdocs-pagelink broken-link' : 'tsdocs-pagelink';
  const title = !isValid ? `Broken page link: ${target}` : undefined;

  return (
    <a href={path} className={className} title={title}>
      {linkText}
    </a>
  );
};

export default PageLink;
