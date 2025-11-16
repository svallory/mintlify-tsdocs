import { clsx } from 'clsx';
import React, { ReactNode, useState } from 'react';

import { CopyToClipboardButton } from '../Code/CopyToClipboardButton';
import { CopyToClipboardResult } from '../utils/copyToClipboard';

export interface PreviewProps {
  /**
   * The JSX code as a string to display in the Code tab and copy
   */
  code: string;

  /**
   * The rendered component to display in the Preview tab
   */
  children: ReactNode;

  /**
   * Optional title for the preview section
   */
  title?: string;

  /**
   * Background color for the tooltip
   */
  tooltipColor?: string;

  /**
   * Callback when code is copied
   */
  onCopied?: (result: CopyToClipboardResult, textToCopy?: string) => void;

  /**
   * Class name for the container
   */
  className?: string;

  /**
   * Default active tab: 'preview' or 'code'
   */
  defaultTab?: 'preview' | 'code';
}

/**
 * Preview component with two tabs: Preview and Code
 * Both tabs show a copy button - Preview copies the code, Code shows syntax highlighted code
 *
 * @example
 * <Preview code={`<TypeTree name="config" type="object" />`}>
 *   <TypeTree name="config" type="object" />
 * </Preview>
 */
export function Preview({
  code,
  children,
  title,
  tooltipColor = '#0D9373',
  onCopied,
  className,
  defaultTab = 'preview',
}: PreviewProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>(defaultTab);

  return (
    <div className={clsx('not-prose my-6 gray-frame rounded-lg overflow-hidden', className)}>
      {/* Tab Header */}
      <div className="flex items-center border-b border-slate-500/30 bg-codeblock-tabs">
        <div className="flex text-xs leading-6">
          <button
            onClick={() => setActiveTab('preview')}
            className={clsx(
              'px-4 py-2 font-medium transition-colors relative',
              activeTab === 'preview'
                ? 'text-primary'
                : 'text-slate-400 hover:text-slate-300'
            )}
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
            className={clsx(
              'px-4 py-2 font-medium transition-colors relative',
              activeTab === 'code'
                ? 'text-primary'
                : 'text-slate-400 hover:text-slate-300'
            )}
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
            <div className="prose dark:prose-dark max-w-none">
              {children}
            </div>
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
}

export default Preview;
