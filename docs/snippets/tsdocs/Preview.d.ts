/**
 * Preview Component
 *
 * A wrapper component that displays content with a title and styled border.
 * Useful for showing examples and demos in documentation.
 *
 * @version 1.1.0
 */
/**
 * Props for the Preview component.
 *
 * @example
 * ```tsx
 * <Preview title="Component Demo">
 *   <TypeTree name="config" type="object" />
 * </Preview>
 * ```
 */
export interface PreviewProps {
    /** The content to display inside the preview box */
    children: React.ReactNode;
    /** Title for the preview section */
    title?: string;
    /** Additional CSS classes to apply to the outer container */
    className?: string;
}
/**
 * Preview - Wrapper component for displaying examples and demos
 */
export declare const Preview: ({ children, title, className }: PreviewProps) => import("react").JSX.Element;
export default Preview;
//# sourceMappingURL=Preview.d.ts.map