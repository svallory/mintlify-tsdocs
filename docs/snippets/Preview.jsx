/**
 * Preview Component
 *
 * A dual-tab component for displaying interactive component previews with copyable source code.
 * Works in Mintlify MDX files for documenting React components.
 *
 * Distributed with mint-tsdocs and automatically installed to docs/snippets/.
 *
 * Note: React, useState, and useEffect are globally available in Mintlify
 *
 * @version 1.0.0
 */

/**
 * Copy to clipboard utility
 */
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return 'success';
  } catch (err) {
    console.error('Failed to copy:', err);
    return 'error';
  }
};

/**
 * CopyToClipboardButton - Internal component for the copy button
 */
const CopyToClipboardButton = ({ textToCopy, tooltipColor = '#0D9373', onCopied, className = '' }) => {
  const [hidden, setHidden] = useState(true);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !navigator?.clipboard) {
      console.warn("The browser's Clipboard API is unavailable.");
      setDisabled(true);
    }
  }, []);

  if (!textToCopy || disabled) {
    return null;
  }

  return (
    <button
      aria-label="Copy code to clipboard"
      onClick={async () => {
        const result = await copyToClipboard(textToCopy);
        if (onCopied) {
          onCopied(result, textToCopy);
        }
        if (result === 'success') {
          setHidden(false);
          setTimeout(() => {
            setHidden(true);
          }, 2000);
        }
      }}
      className={`group relative ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 384 512"
        className="top-5 h-[1.15rem] fill-slate-500 hover:fill-slate-300 cursor-pointer"
      >
        <path d="M320 64H280h-9.6C263 27.5 230.7 0 192 0s-71 27.5-78.4 64H104 64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64zM80 112v24c0 13.3 10.7 24 24 24h88 88c13.3 0 24-10.7 24-24V112h16c8.8 0 16 7.2 16 16V448c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V128c0-8.8 7.2-16 16-16H80zm88-32a24 24 0 1 1 48 0 24 24 0 1 1 -48 0zM136 272a24 24 0 1 0 -48 0 24 24 0 1 0 48 0zm40-16c-8.8 0-16 7.2-16 16s7.2 16 16 16h96c8.8 0 16-7.2 16-16s-7.2-16-16-16H176zm0 96c-8.8 0-16 7.2-16 16s7.2 16 16 16h96c8.8 0 16-7.2 16-16s-7.2-16-16-16H176zm-64 40a24 24 0 1 0 0-48 24 24 0 1 0 0 48z" />
      </svg>
      <div
        className={`z-40 absolute bottom-full left-1/2 mb-3.5 pb-1 -translate-x-1/2 ${
          hidden ? 'invisible' : ''
        } group-hover:visible`}
      >
        <div
          className="relative whitespace-nowrap text-white text-xs leading-6 font-medium px-1.5 rounded-lg"
          style={{ background: tooltipColor }}
        >
          {hidden ? 'Copy' : 'Copied'}
          <div
            className="absolute border-solid"
            style={{
              top: '100%',
              left: '50%',
              marginLeft: '-6px',
              borderWidth: '6px',
              borderColor: `${tooltipColor} transparent transparent transparent`,
            }}
          />
        </div>
      </div>
    </button>
  );
}

/**
 * Preview - Dual-tab component with Preview and Code tabs
 *
 * @param {Object} props - Component properties
 * @param {string} props.code - JSX code as a string (required)
 * @param {React.ReactNode} props.children - Rendered component (required)
 * @param {string} [props.title] - Optional title for preview section
 * @param {string} [props.tooltipColor=#0D9373] - Tooltip background color
 * @param {Function} [props.onCopied] - Callback when code is copied
 * @param {string} [props.className] - Additional CSS classes
 * @param {'preview'|'code'} [props.defaultTab=preview] - Default active tab
 *
 * @example
 * <Preview code={`<TypeTree name="id" type="string" />`}>
 *   <TypeTree name="id" type="string" />
 * </Preview>
 */
export const Preview = ({
  code,
  children,
  title,
  tooltipColor = '#0D9373',
  onCopied,
  className = '',
  defaultTab = 'preview',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className={`not-prose my-6 gray-frame rounded-lg overflow-hidden ${className}`}>
      {/* Tab Header */}
      <div className="flex items-center border-b border-slate-500/30 bg-codeblock-tabs">
        <div className="flex text-xs leading-6">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === 'preview' ? 'text-primary' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Preview
            {activeTab === 'preview' && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{ backgroundColor: tooltipColor }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === 'code' ? 'text-primary' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Code
            {activeTab === 'code' && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{ backgroundColor: tooltipColor }}
              />
            )}
          </button>
        </div>
        <div className="flex-auto flex justify-end items-center px-4">
          <CopyToClipboardButton
            textToCopy={code}
            tooltipColor={tooltipColor}
            onCopied={onCopied}
            className="relative"
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="relative">
        {activeTab === 'preview' && (
          <div className="p-6 bg-white dark:bg-slate-950">
            {title && (
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                {title}
              </h4>
            )}
            <div className="prose dark:prose-dark max-w-none">{children}</div>
          </div>
        )}
        {activeTab === 'code' && (
          <div className="relative">
            <pre className="!my-0 !bg-transparent !shadow-none">
              <code className="language-jsx !text-sm">{code}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default Preview;
