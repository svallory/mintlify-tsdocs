/**
 * RefLink Component
 *
 * A specialized link component for API references only.
 * Simpler API than Link component - no kind attribute needed.
 *
 * Type safety is provided at compile-time via TypeScript.
 * Runtime validation highlights broken links with "broken-link" CSS class.
 *
 * @version 1.2.1
 */

/**
 * RefLink - Link component specifically for API references
 * @param {import('./RefLink').RefLinkProps} props
 * @returns {JSX.Element}
 */
export const RefLink = ({ target, children }) => {
  // Validate target prop
  if (!target || typeof target !== 'string') {
    console.error('RefLink: Invalid target prop. Expected non-empty string.');
    return <span className="tsdocs-reflink broken-link" title="Invalid RefLink target" data-component="tsdocs-reflink">Invalid Link</span>;
  }

  const linkText = children || target;

  // Generate absolute path from RefId using global config (loaded via custom script)
  // Format: mint-tsdocs.MarkdownDocumenter.generateFiles -> /reference/mint-tsdocs/MarkdownDocumenter/generateFiles
  const path = typeof window !== 'undefined' && window.getRefPath
    ? window.getRefPath(target)
    : `./${target.split('.').filter(s => s.length > 0).join('/')}`; // Fallback for SSR

  // Runtime validation - only runs client-side
  // VALID_REFS is set globally by ValidRefs.jsx on window object
  const isValid = typeof window !== 'undefined' && window.VALID_REFS && window.VALID_REFS.has(target);
  const className = !isValid ? 'tsdocs-reflink broken-link' : 'tsdocs-reflink';
  const title = !isValid ? `Broken API reference: ${target}` : undefined;

  return (
    <a href={path} className={className} title={title} data-component="tsdocs-reflink">
      {linkText}
    </a>
  );
};

export default RefLink;
