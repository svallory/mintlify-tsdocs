/**
 * Type definitions for Preview Component
 */

import * as React from 'react';

/**
 * Props for the Preview component.
 *
 * @example
 * ```tsx
 * <Preview title="Component Demo">
 *   <TypeTree open name="config" type="object" />
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
export const Preview: React.FC<PreviewProps>;

export default Preview;
