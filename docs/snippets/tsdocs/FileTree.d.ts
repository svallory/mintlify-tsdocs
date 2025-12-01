/**
 * Type definitions for FileTree Component
 */

import * as React from 'react';

/**
 * Badge configuration for file/directory items
 */
export interface FileTreeBadge {
  /** Badge text content */
  text: string;
  /** Badge color (Mintlify Badge color prop) */
  color?: string;
}

/**
 * Represents a single file or directory in the file tree
 */
export interface FileTreeItem {
  /** Name of the file or directory */
  name: string;
  /** Optional description shown next to the name */
  description?: string;
  /** Optional badge configuration */
  badge?: FileTreeBadge;
  /** Child items for directories (recursive) */
  children?: FileTreeItem[];
}

/**
 * Props for the FileTree component
 *
 * @example
 * ```tsx
 * <FileTree
 *   title="OpenDocs File Structure"
 *   structure={[
 *     {
 *       name: "opendocs.json",
 *       description: "Main file with project organization",
 *       badge: { text: "Collection", color: "blue" }
 *     },
 *     {
 *       name: "projects/",
 *       children: [
 *         {
 *           name: "auth-service.json",
 *           description: "Project metadata"
 *         },
 *         {
 *           name: "auth-service.jsonl",
 *           description: "Project DocItems (JSONL format)",
 *           badge: { text: "JSONL", color: "green" }
 *         }
 *       ]
 *     }
 *   ]}
 * />
 * ```
 */
export interface FileTreeProps {
  /** Hierarchical structure of files and directories (root level) */
  structure?: FileTreeItem[];
  /** Optional title for the file tree */
  title?: string;
  /** Single item (used internally for recursion) */
  item?: FileTreeItem;
  /** Current nesting level (used internally for recursion) */
  level?: number;
  /** Maximum depth to prevent infinite recursion */
  maxDepth?: number;
  /** Whether to show file/folder icons */
  showIcons?: boolean;
}

/**
 * Props for FileTreeGroup component
 */
export interface FileTreeGroupProps {
  /** Optional title for the group */
  title?: string;
  /** Child FileTree components */
  children: React.ReactNode;
}

/**
 * FileTree - Hierarchical file structure visualization component with self-recursion
 */
export const FileTree: React.FC<FileTreeProps>;

/**
 * FileTreeGroup - Simple wrapper for grouping multiple FileTree components
 */
export const FileTreeGroup: React.FC<FileTreeGroupProps>;

export default FileTree;
