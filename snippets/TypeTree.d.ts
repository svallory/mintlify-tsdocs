/**
 * Type definitions for TypeTree Component
 */

import * as React from 'react';

/**
 * Common TypeScript primitive and structural types.
 * Using a union of common types provides better autocompletion.
 * The `string` type is included as a fallback for more complex or custom types.
 */
export type TypeAnnotation =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'function'
  | 'null'
  | 'undefined'
  | 'any'
  | 'unknown'
  | 'never'
  | 'void'
  | string;

/**
 * Represents a single property in a TypeTree structure.
 * This interface supports recursive nesting through the `properties` field.
 *
 * @example
 * ```tsx
 * const databaseConfig: TypeTreeProperty = {
 *   name: "database",
 *   type: "object",
 *   description: "Database configuration",
 *   required: true,
 *   properties: [
 *     { name: "host", type: "string", required: true },
 *     { name: "port", type: "number", defaultValue: "5432" }
 *   ]
 * };
 * ```
 */
export interface TypeTreeProperty {
  /** The name of the property or type being documented */
  name: string;
  /** The TypeScript type annotation (e.g., `string`, `number`, `object`, `Array<string>`) */
  type: TypeAnnotation;
  /** Human-readable description of what this property represents */
  description?: string;
  /** Whether this property is required. Displays a red "required" badge when `true` */
  required?: boolean;
  /** Whether this property is deprecated. Displays an orange "deprecated" badge when `true` */
  deprecated?: boolean;
  /** The default value for this property, if any. Displayed below the description */
  defaultValue?: string;
  /** Array of nested properties for complex types */
  properties?: TypeTreeProperty[];
}

/**
 * Props for the TypeTree component.
 *
 * @example
 * ```tsx
 * <TypeTree open
 *   name="config"
 *   type="object"
 *   description="Configuration settings"
 *   required={true}
 *   properties={[
 *     { name: "host", type: "string", description: "Database host", required: true },
 *     { name: "port", type: "number", description: "Port number", defaultValue: "5432" },
 *     {
 *       name: "ssl",
 *       type: "object",
 *       description: "SSL configuration",
 *       properties: [
 *         { name: "enabled", type: "boolean", required: true },
 *         { name: "cert", type: "string" }
 *       ]
 *     }
 *   ]}
 * />
 * ```
 */
export interface TypeTreeProps extends TypeTreeProperty {
  /** Current nesting level (used internally) */
  level?: number;
  /** Maximum recursion depth to prevent stack overflow */
  maxDepth?: number;
}

/**
 * Props for the TypeTreeGroup component.
 *
 * @example
 * ```tsx
 * <TypeTreeGroup open title="Parameters">
 *   <TypeTree open name="id" type="string" required />
 *   <TypeTree open name="name" type="string" />
 * </TypeTreeGroup>
 * ```
 */
export interface TypeTreeGroupProps {
  /** Optional group title */
  title?: string;
  /** TypeTree components */
  children: React.ReactNode;
}

/**
 * TypeTree - Recursive expandable type documentation component
 */
export const TypeTree: React.FC<TypeTree openProps>;

/**
 * TypeTreeGroup - Simple wrapper for grouping multiple TypeTree components
 */
export const TypeTreeGroup: React.FC<TypeTreeGroup openProps>;

export default TypeTree;
