"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeTreeGroup = exports.TypeTree = void 0;
// ============================================================================
// TypeTree Component
// ============================================================================
/**
 * TypeTree - Recursive expandable type documentation component
 */
const TypeTree = ({ name, type, description, required = false, deprecated = false, properties = [], defaultValue, level = 0, maxDepth = 10 }) => {
    // Prevent infinite recursion from circular references
    if (level >= maxDepth) {
        console.warn(`TypeTree: Maximum depth (${maxDepth}) exceeded for ${name}. Preventing infinite recursion.`);
        return (<ResponseField name={name} type={type} required={required} deprecated={deprecated} default={defaultValue}>
        {description}
        <div style={{ fontStyle: 'italic', opacity: 0.7 }}>
          (Maximum nesting depth reached)
        </div>
      </ResponseField>);
    }
    const hasNested = properties && properties.length > 0;
    return (<ResponseField name={name} type={type} required={required} deprecated={deprecated} default={defaultValue}>
      {description}
      {hasNested && (<Expandable title="props" key={`${name}-${level}`} defaultOpen={false}>
          {properties.map((prop, idx) => {
                // Use stable key: combine name with index for uniqueness
                // Better than pure index, though ideally each prop would have a unique ID
                const key = prop.name ? `${prop.name}-${idx}` : `prop-${idx}`;
                return (<exports.TypeTree key={key} name={prop.name} type={prop.type} description={prop.description} required={prop.required} deprecated={prop.deprecated} properties={prop.properties} defaultValue={prop.defaultValue} level={level + 1} maxDepth={maxDepth}/>);
            })}
        </Expandable>)}
    </ResponseField>);
};
exports.TypeTree = TypeTree;
// ============================================================================
// TypeTreeGroup Component
// ============================================================================
/**
 * TypeTreeGroup - Simple wrapper for grouping multiple TypeTree components
 */
const TypeTreeGroup = ({ title, children }) => {
    return (<div>
      {title && <h3>{title}</h3>}
      {children}
    </div>);
};
exports.TypeTreeGroup = TypeTreeGroup;
exports.default = exports.TypeTree;
//# sourceMappingURL=TypeTree.jsx.map