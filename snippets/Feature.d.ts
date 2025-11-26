import type * as React from 'react';

/**
 * Props for the Feature component.
 */
export interface FeatureProps {
  /** Icon name for the feature header (optional). Uses Mintlify's Icon component. */
  icon?: string;
  /** The main title of the feature. Will be rendered inside a `<code>` tag. */
  title: string;
  /** A short description or subtitle for the feature. */
  subtitle: string;
  /** Content to display below the header. Can be any React nodes. */
  children?: React.ReactNode;
}

/**
 * Feature Component
 *
 * A simple component for showcasing product features with a header and custom content.
 * Displays a header with icon/title/subtitle, and renders any children below.
 *
 * @example
 * ```jsx
 * <Feature
 *   icon="rocket"
 *   title="My Feature"
 *   subtitle="An amazing feature for your product"
 * >
 *   <p>This feature will revolutionize your workflow.</p>
 *   <CardGroup cols={2}>
 *     <Card title="Fast" icon="zap">
 *       Lightning-fast performance
 *     </Card>
 *     <Card title="Secure" icon="shield">
 *       Enterprise-grade security
 *     </Card>
 *   </CardGroup>
 * </Feature>
 * ```
 */
export const Feature: React.FC<FeatureProps>;

export default Feature;
