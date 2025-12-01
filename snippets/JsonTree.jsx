/**
 * JsonTree Component
 *
 * A beautiful, UX-focused component for displaying JSON structures.
 * Uses badges, type indicators, and visual hierarchy for optimal readability.
 *
 * Distributed with mint-tsdocs and automatically installed to docs/snippets/.
 *
 * @version 2.0.0
 */

/**
 * JsonTree - Beautiful JSON structure visualization with recursive rendering
 * @param {import('./JsonTree').JsonTreeProps} props
 * @returns {JSX.Element}
 */
export const JsonTree = ({
  data,
  title,
  name,
  value,
  depth = 0,
  maxDepth = 5,
  _isRoot = false
}) => {
  // Helper function for value colors
  const getValueColor = (type) => {
    switch (type) {
      case 'string': return '#22c55e';
      case 'number': return '#3b82f6';
      case 'boolean': return '#f59e0b';
      case 'null': return '#6b7280';
      default: return '#d4d4d4';
    }
  };

  // Handle root-level rendering (when data prop is provided)
  if (data !== undefined) {
    const isRootObject = typeof data === 'object' && data !== null;

    return (
      <div data-component="tsdocs-jsontree">
        {title && (
          <div style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            marginBottom: '12px',
            letterSpacing: '-0.01em'
          }}>
            {title}
          </div>
        )}
        <div>
          {isRootObject ? (
            Array.isArray(data) ? (
              data.map((item, i) => (
                <JsonTree
                  key={i}
                  name={`[${i}]`}
                  value={item}
                  depth={0}
                  maxDepth={maxDepth}
                />
              ))
            ) : (
              Object.entries(data).map(([key, val]) => (
                <JsonTree
                  key={key}
                  name={key}
                  value={val}
                  depth={0}
                  maxDepth={maxDepth}
                />
              ))
            )
          ) : (
            <JsonTree
              name="value"
              value={data}
              depth={0}
              maxDepth={maxDepth}
            />
          )}
        </div>
      </div>
    );
  }

  // Prevent infinite recursion
  if (depth >= maxDepth) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        paddingLeft: `${depth * 24}px`,
        paddingTop: '6px',
        paddingBottom: '6px',
        borderLeft: depth > 0 ? '2px solid rgba(100, 116, 139, 0.2)' : 'none',
        marginLeft: depth > 0 ? '8px' : '0'
      }}>
        <Badge color="blue">{name}</Badge>
        <span style={{
          fontSize: '0.8125rem',
          color: '#6b7280',
          fontStyle: 'italic'
        }}>
          (max depth reached)
        </span>
      </div>
    );
  }

  const indent = depth * 24;

  // Handle null values
  if (value === null) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        paddingLeft: `${indent}px`,
        paddingTop: '6px',
        paddingBottom: '6px',
        borderLeft: depth > 0 ? '2px solid rgba(100, 116, 139, 0.2)' : 'none',
        marginLeft: depth > 0 ? '8px' : '0'
      }}>
        <Badge color="blue">{name}</Badge>
        <span style={{
          fontSize: '0.8125rem',
          color: '#6b7280',
          fontFamily: 'ui-monospace, monospace',
          fontStyle: 'italic'
        }}>
          null
        </span>
      </div>
    );
  }

  const type = Array.isArray(value) ? 'array' : typeof value;

  // Handle objects
  if (type === 'object') {
    const entries = Object.entries(value);
    return (
      <div style={{
        paddingLeft: depth > 0 ? `${indent}px` : '0',
        borderLeft: depth > 0 ? '2px solid rgba(100, 116, 139, 0.2)' : 'none',
        marginLeft: depth > 0 ? '8px' : '0'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingTop: '8px',
          paddingBottom: '4px'
        }}>
          <Badge color="blue">{name}</Badge>
          <span style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            fontWeight: 500
          }}>
            object
          </span>
        </div>
        <div>
          {entries.map(([key, val]) => (
            <JsonTree
              key={key}
              name={key}
              value={val}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      </div>
    );
  }

  // Handle arrays
  if (type === 'array') {
    return (
      <div style={{
        paddingLeft: depth > 0 ? `${indent}px` : '0',
        borderLeft: depth > 0 ? '2px solid rgba(100, 116, 139, 0.2)' : 'none',
        marginLeft: depth > 0 ? '8px' : '0'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingTop: '8px',
          paddingBottom: '4px'
        }}>
          <Badge color="blue">{name}</Badge>
          <span style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            fontWeight: 500
          }}>
            array[{value.length}]
          </span>
        </div>
        <div>
          {value.map((item, i) => (
            <JsonTree
              key={i}
              name={`[${i}]`}
              value={item}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      </div>
    );
  }

  // Handle primitive values
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      paddingLeft: `${indent}px`,
      paddingTop: '6px',
      paddingBottom: '6px',
      borderLeft: depth > 0 ? '2px solid rgba(100, 116, 139, 0.2)' : 'none',
      marginLeft: depth > 0 ? '8px' : '0'
    }}>
      <Badge color="blue">{name}</Badge>
      <span style={{
        fontSize: '0.8125rem',
        color: getValueColor(type),
        fontFamily: 'ui-monospace, monospace',
        fontWeight: 500
      }}>
        {type === 'string' ? `"${value}"` : String(value)}
      </span>
    </div>
  );
};

/**
 * JsonTreeGroup - Simple wrapper for grouping multiple JsonTree components
 * @param {import('./JsonTree').JsonTreeGroupProps} props
 * @returns {JSX.Element}
 */
export const JsonTreeGroup = ({ title, children }) => {
  return (
    <div>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
};

export default JsonTree;
