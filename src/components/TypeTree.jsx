// @ts-nocheck
/**
 * TypeTree Component
 *
 * A recursive, expandable component for documenting complex type structures.
 * Works for TypeScript types, JSON schemas, API parameters, return types, or any structured data.
 *
 * Distributed with mint-tsdocs and automatically installed to docs/snippets/.
 * Uses Mintlify's native ResponseField and Expandable components for consistent styling.
 *
 * @version 2.0.0
 */

/**
 * TypeTree - Recursive expandable type documentation component
 *
 * @param {Object} props - Component properties
 * @param {string} props.name - Property/field name
 * @param {string} props.type - Type annotation (e.g., "string", "object", "Array<string>")
 * @param {string} [props.description] - Human-readable description
 * @param {boolean} [props.required=false] - Whether this field is required
 * @param {boolean} [props.deprecated=false] - Whether this field is deprecated
 * @param {Array<Object>} [props.properties=[]] - Nested properties for objects/arrays
 * @param {string} [props.defaultValue] - Default value if any
 * @param {number} [props.level=0] - Current nesting level (used internally)
 * @param {number} [props.maxDepth=10] - Maximum recursion depth to prevent stack overflow
 *
 * @example
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
 *       type="object",
 *       description: "SSL configuration",
 *       properties: [
 *         { name: "enabled", type: "boolean", required: true },
 *         { name: "cert", type: "string" }
 *       ]
 *     }
 *   ]}
 * />
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
}) => {
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
        // NOTE: There's currently a bug in the Expandable component
        //       it will NOT update the title on open/close if defaultOpen is true
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

/**
 * TypeTreeGroup - Simple wrapper for grouping multiple TypeTree components
 *
 * @param {Object} props - Component properties
 * @param {string} [props.title] - Optional group title
 * @param {React.ReactNode} props.children - TypeTree components
 *
 * @example
 * <TypeTreeGroup title="Parameters">
 *   <TypeTree name="id" type="string" required />
 *   <TypeTree name="name" type="string" />
 * </TypeTreeGroup>
 */
export const TypeTreeGroup = ({ title, children }) => {
  return (
    <div>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
};

export default TypeTree;
