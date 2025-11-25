/**
 * Link Component
 *
 * Generic link component that routes to PageLink or RefLink based on kind prop.
 * This is a compatibility wrapper - prefer using PageLink or RefLink directly.
 *
 * @version 1.0.0
 * @deprecated Use PageLink or RefLink directly instead
 */

import { PageLink } from '/snippets/tsdocs/PageLink.jsx';
import { RefLink } from '/snippets/tsdocs/RefLink.jsx';

/**
 * Link - Generic link component (compatibility wrapper)
 * @param {import('./Link').LinkProps} props
 * @returns {JSX.Element}
 */
export const Link = ({ kind, target, children }) => {
  if (kind === 'ref') {
    return <RefLink target={target}>{children}</RefLink>;
  }

  return <PageLink target={target}>{children}</PageLink>;
};

export default Link;
