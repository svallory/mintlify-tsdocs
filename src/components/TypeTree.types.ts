/**
 * TypeScript type definitions for the TypeTree component.
 * These types can be imported and used in your TypeScript/TSX files to ensure
 * type safety when working with TypeTree data structures.
 *
 * @packageDocumentation
 */

/**
 * Represents a single property in a TypeTree structure.
 * This interface supports recursive nesting through the `properties` field.
 *
 * @example
 * ```typescript
 * import type { TypeTreeProperty } from 'mint-tsdocs';
 *
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
 *
 * @public
 */
export interface TypeTreeProperty {
  /**
   * The name of the property or type being documented
   */
  name: string;

  /**
   * The TypeScript type annotation (e.g., `string`, `number`, `object`, `Array<string>`)
   */
  type: string;

  /**
   * Human-readable description of what this property represents
   */
  description?: string;

  /**
   * Whether this property is required. Displays a red "required" badge when `true`
   * @defaultValue false
   */
  required?: boolean;

  /**
   * Whether this property is deprecated. Displays an orange "deprecated" badge when `true`
   * @defaultValue false
   */
  deprecated?: boolean;

  /**
   * The default value for this property, if any. Displayed below the description
   */
  defaultValue?: string;

  /**
   * Array of nested properties for complex types.
   * Each item should follow the same TypeTreeProperty structure, enabling recursive nesting.
   */
  properties?: TypeTreeProperty[];

  /**
   * Internal property for tracking nesting depth.
   * Automatically managed by the component - don't set manually.
   * @internal
   */
  level?: number;
}

/**
 * Props for the TypeTree component.
 * Extends TypeTreeProperty to include all properties plus component-specific props.
 *
 * @example
 * ```tsx
 * import type { TypeTreeProps } from 'mint-tsdocs';
 *
 * const props: TypeTreeProps = {
 *   name: "config",
 *   type: "object",
 *   description: "Configuration settings",
 *   properties: [...]
 * };
 *
 * <TypeTree {...props} />
 * ```
 *
 * @public
 */
export type TypeTreeProps = TypeTreeProperty;

/**
 * Props for the TypeTreeGroup component.
 * Used to organize multiple related types under a common title.
 *
 * @example
 * ```tsx
 * import type { TypeTreeGroupProps } from 'mint-tsdocs';
 *
 * const groupProps: TypeTreeGroupProps = {
 *   title: "Request Parameters",
 *   children: [...]
 * };
 *
 * <TypeTreeGroup {...groupProps} />
 * ```
 *
 * @public
 */
export interface TypeTreeGroupProps {
  /**
   * The title displayed above the grouped types
   */
  title: string;

  /**
   * The TypeTree components to group together
   */
  children?: React.ReactNode;
}
