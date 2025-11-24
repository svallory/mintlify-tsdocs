/**
 * TypeTree Component - Type definitions
 *
 * A recursive, expandable component for documenting complex type structures.
 */

import type { ReactNode } from 'react';

export interface TypeProperty {
  /** Property/field name */
  name: string;
  /** Type annotation (e.g., "string", "object", "Array<string>") */
  type: string;
  /** Human-readable description */
  description?: string;
  /** Whether this field is required */
  required?: boolean;
  /** Whether this field is deprecated */
  deprecated?: boolean;
  /** Nested properties for objects/arrays */
  properties?: TypeProperty[];
  /** Default value if any */
  defaultValue?: string;
}

export interface TypeTreeProps extends TypeProperty {
  /** Current nesting level (used internally) */
  level?: number;
}

export interface TypeTreeGroupProps {
  /** Optional group title */
  title?: string;
  /** TypeTree components */
  children: ReactNode;
}

export const TypeTree: React.FC<TypeTreeProps>;
export const TypeTreeGroup: React.FC<TypeTreeGroupProps>;
export default TypeTree;
