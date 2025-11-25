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
/**
 * RefLink - Link component specifically for API references
 */
export declare const RefLink: ({ target, children }: RefLinkProps) => import("react").JSX.Element;
export default RefLink;
//# sourceMappingURL=RefLink.d.ts.map