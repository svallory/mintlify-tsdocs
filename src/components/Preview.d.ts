/**
 * Preview component that wraps content with a title and border
 */

import type { ReactNode } from 'react';

export interface PreviewProps {
  /** The content to display */
  children: ReactNode;
  /** Title for the preview section (default: "Preview") */
  title?: string;
  /** Additional CSS classes */
  className?: string;
}

export const Preview: React.FC<PreviewProps>;
export default Preview;
