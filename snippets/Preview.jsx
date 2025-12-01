/**
 * Preview Component
 *
 * A wrapper component that displays content with a title and styled border.
 * Useful for showing examples and demos in documentation.
 *
 * @version 1.1.0
 */

// ============================================================================
// Preview Component
// ============================================================================

/**
 * Preview - Wrapper component for displaying examples and demos
 * @param {import('./Preview').PreviewProps} props
 * @returns {JSX.Element}
 */
export const Preview = ({ children, title = "Preview", className }) => {
  const outerClasses = [
    "code-block mt-5 mb-8 not-prose rounded-2xl relative group",
    "text-gray-950 bg-gray-50 dark:bg-white/5 dark:text-gray-50",
    "border border-gray-950/10 dark:border-white/10",
    "p-0.5",
    className
  ].filter(Boolean).join(" ");

  return (
    <div className={outerClasses} data-component="tsdocs-preview">
      {/* Header */}
      <div className="flex text-gray-400 text-xs rounded-t-[14px] leading-6 font-medium pl-4 pr-2.5 py-1">
        <div className="flex-none flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
          {title}
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-sm dark:prose-invert w-0 min-w-full max-w-full py-3.5 px-4 rounded-b-xt bg-white dark:bg-codeblock overflow-x-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-black/15 hover:scrollbar-thumb-black/20 dark:scrollbar-thumb-white/20 dark:hover:scrollbar-thumb-white/25">
        {children}
      </div>
    </div>
  );
};

export default Preview;
