"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefLink = void 0;
const ValidRefs_1 = require("./ValidRefs");
// ============================================================================
// RefLink Component
// ============================================================================
/**
 * RefLink - Link component specifically for API references
 */
const RefLink = ({ target, children }) => {
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
    const isValid = typeof ValidRefs_1.VALID_REFS !== 'undefined' && ValidRefs_1.VALID_REFS.has(target);
    const className = !isValid ? 'tsdocs-reflink broken-link' : 'tsdocs-reflink';
    const title = !isValid ? `Broken API reference: ${target}` : undefined;
    return (<a href={path} className={className} title={title}>
      {linkText}
    </a>);
};
exports.RefLink = RefLink;
exports.default = exports.RefLink;
//# sourceMappingURL=RefLink.jsx.map