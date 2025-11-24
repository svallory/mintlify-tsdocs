/**
 * TypeTree Component
 *
 * A recursive, expandable component for documenting complex type structures.
 * Works for TypeScript types, JSON schemas, API parameters, return types, or any structured data.
 *
 * Distributed with mint-tsdocs and automatically installed to docs/snippets/.
 * Uses Mintlify's native ResponseField and Expandable components for consistent styling.
 *
 * @version 2.1.0
 */

// ============================================================================
// Type Definitions
// ============================================================================

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
 * <TypeTree
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
 * <TypeTreeGroup title="Parameters">
 *   <TypeTree name="id" type="string" required />
 *   <TypeTree name="name" type="string" />
 * </TypeTreeGroup>
 * ```
 */
export interface TypeTreeGroupProps {
  /** Optional group title */
  title?: string;
  /** TypeTree components */
  children: JSX.Element | JSX.Element[];
}

// ============================================================================
// TypeTree Component
// ============================================================================

/**
 * TypeTree - Recursive expandable type documentation component
 */
export const TypeTree = ({
  name,
  type,
  description,
  required = false,
  deprecated = false,
  properties = [],
  defaultValue,
  level = 0,
  maxDepth = 10
}: TypeTreeProps) => {
  // Prevent infinite recursion from circular references
  if (level >= maxDepth) {
    console.warn(`TypeTree: Maximum depth (${maxDepth}) exceeded for ${name}. Preventing infinite recursion.`);
    return (
      <ResponseField
        name={name}
        type={type}
        required={required}
        deprecated={deprecated}
        default={defaultValue}
      >
        {description}
        <div style={{ fontStyle: 'italic', opacity: 0.7 }}>
          (Maximum nesting depth reached)
        </div>
      </ResponseField>
    );
  }

  const hasNested = properties && properties.length > 0;

  return (
    <ResponseField
      name={name}
      type={type}
      required={required}
      deprecated={deprecated}
      default={defaultValue}
    >
      {description}
      {hasNested && (
        <Expandable title="props" key={`${name}-${level}`} defaultOpen={false}>
          {properties.map((prop, idx) => {
            // Use stable key: combine name with index for uniqueness
            // Better than pure index, though ideally each prop would have a unique ID
            const key = prop.name ? `${prop.name}-${idx}` : `prop-${idx}`;
            return (
              <TypeTree
                key={key}
                name={prop.name}
                type={prop.type}
                description={prop.description}
                required={prop.required}
                deprecated={prop.deprecated}
                properties={prop.properties}
                defaultValue={prop.defaultValue}
                level={level + 1}
                maxDepth={maxDepth}
              />
            );
          })}
        </Expandable>
      )}
    </ResponseField>
  );
};

// ============================================================================
// TypeTreeGroup Component
// ============================================================================

/**
 * TypeTreeGroup - Simple wrapper for grouping multiple TypeTree components
 */
export const TypeTreeGroup = ({ title, children }: TypeTreeGroupProps) => {
  return (
    <div>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
};

export default TypeTree;
