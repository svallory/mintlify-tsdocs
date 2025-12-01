/**
 * Props for JsonTree component
 */
export interface JsonTreeProps {
  /** The JSON data to display (root level) */
  data?: any;
  /** Optional title for the root visualization */
  title?: string;
  /** Property name (used internally for recursion) */
  name?: string;
  /** Property value (used internally for recursion) */
  value?: any;
  /** Current nesting depth (used internally for recursion) */
  depth?: number;
  /** Maximum depth to prevent excessive rendering (default: 5) */
  maxDepth?: number;
  /** Internal flag for root rendering */
  _isRoot?: boolean;
}

/**
 * Props for JsonTreeGroup component
 */
export interface JsonTreeGroupProps {
  /** Optional title for the group */
  title?: string;
  /** Child JsonTree components */
  children: React.ReactNode;
}

/**
 * JsonTree - Beautiful JSON structure visualization with badges and type indicators
 */
export const JsonTree: React.FC<JsonTreeProps>;

/**
 * JsonTreeGroup - Simple wrapper for grouping multiple JsonTree components
 */
export const JsonTreeGroup: React.FC<JsonTreeGroupProps>;

export default JsonTree;