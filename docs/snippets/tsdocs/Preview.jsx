import { clsx } from "clsx";

/**
 * Preview component that wraps content with a title and border
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The content to display
 * @param {string} [props.title="Preview"] - Title for the preview section
 * @param {string} [props.className] - Additional CSS classes
 *
 * @example
 * <Preview title="Component Demo">
 *   <TypeTree name="config" type="object" />
 * </Preview>
 */
export function Preview({ children, title = "Preview", className }) {
  return (
    <div
      className={clsx(
        "code-block mt-5 mb-8 not-prose rounded-2xl relative group",
        "text-gray-950 bg-gray-50 dark:bg-white/5 dark:text-gray-50",
        "border border-gray-950/10 dark:border-white/10",
        "p-0.5",
        className
      )}
    >
      {/* Header */}
      <div
        className={clsx(
          "flex text-gray-400 text-xs rounded-t-[14px] leading-6 font-medium",
          "pl-4 pr-2.5 py-1"
        )}
      >
        <div className="flex-none flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
          {title}
        </div>
      </div>

      {/* Content */}
      <div
        className={clsx(
          "w-0 min-w-full max-w-full py-3.5 px-4",
          "rounded-b-2xl bg-white dark:bg-codeblock",
          "overflow-x-auto",
          "scrollbar-thin scrollbar-thumb-rounded",
          "scrollbar-thumb-black/15 hover:scrollbar-thumb-black/20",
          "dark:scrollbar-thumb-white/20 dark:hover:scrollbar-thumb-white/25"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default Preview;
