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
/**
 * Props for the PageLink component.
 *
 * @example
 * ```tsx
 * <PageLink target="introduction">Introduction</PageLink>
 * <PageLink target="components/type-tree">TypeTree Component</PageLink>
 * ```
 */
export interface PageLinkProps {
    /** Documentation page identifier (PageId) - path relative to docs root */
    target: string;
    /** Link text content (defaults to target if not provided) */
    children?: React.ReactNode;
}
/**
 * PageLink - Link component specifically for documentation pages
 */
export declare const PageLink: ({ target, children }: PageLinkProps) => import("react").JSX.Element;
export default PageLink;
//# sourceMappingURL=PageLink.d.ts.map