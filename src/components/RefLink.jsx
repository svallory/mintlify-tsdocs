// @ts-nocheck
/**
 * RefLink Component
 *
 * A specialized link component for API references only.
 * Simpler API than Link component - no kind attribute needed.
 *
 * Type safety is provided at compile-time via TypeScript.
 * Runtime validation highlights broken links with "broken-link" CSS class.
 *
 * @version 1.1.0
 */

import { VALID_REFS } from './ValidRefs';

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

  // Runtime validation - only runs client-side
  // Gracefully handles SSR where VALID_REFS might not be available
  const isValid = typeof VALID_REFS !== 'undefined' && VALID_REFS.has(target);
  const className = isValid === false ? 'tsdocs-reflink broken-link' : 'tsdocs-reflink';
  const title = isValid === false ? `Broken API reference: ${target}` : undefined;

  return (
    <a href={path} className={className} title={title}>
      {linkText}
    </a>
  );
};
