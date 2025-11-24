// @ts-nocheck
/**
 * PageLink Component
 *
 * A specialized link component for documentation pages only.
 * Simpler API than Link component - no kind attribute needed.
 *
 * Type safety is provided at compile-time via TypeScript.
 * No runtime validation to avoid server-side rendering issues.
 *
 * @version 1.0.0
 */

/**
 * PageLink - Link component specifically for documentation pages
 *
 * @param {Object} props - Component properties
 * @param {string} props.target - Documentation page identifier (PageId)
 * @param {*} [props.children] - Link text content (defaults to target if not provided)
 *
 * @example
 * <PageLink target="introduction">Introduction</PageLink>
 * <PageLink target="components/type-tree">TypeTree Component</PageLink>
 */
export const PageLink = ({ target, children }) => {
  const linkText = children || target;

  // Generate path - prefix with / if not already there
  let path = target;
  if (!path.startsWith('/')) {
    path = `/${target}`;
  }

  return (
    <a href={path} className="tsdocs-pagelink">
      {linkText}
    </a>
  );
};
