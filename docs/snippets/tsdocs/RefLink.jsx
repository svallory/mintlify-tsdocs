// @ts-nocheck
/**
 * RefLink Component
 *
 * A specialized link component for API references only.
 * Simpler API than Link component - no kind attribute needed.
 *
 * Type safety is provided at compile-time via TypeScript.
 * No runtime validation to avoid server-side rendering issues.
 *
 * @version 1.0.0
 */

/**
 * RefLink - Link component specifically for API references
 *
 * @param {Object} props - Component properties
 * @param {string} props.target - API reference identifier (RefId)
 * @param {*} [props.children] - Link text content (defaults to target if not provided)
 *
 * @example
 * <RefLink target="mint-tsdocs.MarkdownDocumenter">MarkdownDocumenter</RefLink>
 * <RefLink target="mint-tsdocs.MarkdownDocumenter.generateFiles">Generate Files</RefLink>
 */
export const RefLink = ({ target, children }) => {
  const linkText = children || target;

  // Generate path from RefId
  // Format: mint-tsdocs.MarkdownDocumenter.generateFiles -> ./mint-tsdocs/MarkdownDocumenter/generateFiles
  const path = `./${target.split('.').join('/')}`;

  return (
    <a href={path} className="tsdocs-reflink">
      {linkText}
    </a>
  );
};
