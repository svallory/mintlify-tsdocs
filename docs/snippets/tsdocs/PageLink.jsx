/**
 * PageLink Component
 *
 * A specialized link component for documentation pages only.
 * Simpler API than Link component - no kind attribute needed.
 *
 * Type safety is provided at compile-time via TypeScript.
 * Runtime validation highlights broken links with "broken-link" CSS class.
 *
 * @version 1.2.1
 */

/**
 * PageLink - Link component specifically for documentation pages
 * @param {import('./PageLink').PageLinkProps} props
 * @returns {JSX.Element}
 */
export const PageLink = ({ target, children }) => {
  // Validate target prop
  if (!target || typeof target !== 'string') {
    console.error('PageLink: Invalid target prop. Expected non-empty string.');
    return <span className="tsdocs-pagelink broken-link" title="Invalid PageLink target" data-component="tsdocs-pagelink">Invalid Link</span>;
  }

  const linkText = children || target;

  // Generate path - prefix with / if not already there
  let path = target;
  if (!path.startsWith('/')) {
    path = `/${target}`;
  }

  // Runtime validation - only runs client-side
  // VALID_PAGES is set globally by ValidPages.jsx on window object
  const isValid = typeof window !== 'undefined' && window.VALID_PAGES && window.VALID_PAGES.has(target);
  const className = !isValid ? 'tsdocs-pagelink broken-link' : 'tsdocs-pagelink';
  const title = !isValid ? `Broken page link: ${target}` : undefined;

  return (
    <a href={path} className={className} title={title} data-component="tsdocs-pagelink">
      {linkText}
    </a>
  );
};

export default PageLink;
