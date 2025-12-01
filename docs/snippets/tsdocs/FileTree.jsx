/**
 * FileTree Component
 *
 * A static component for displaying hierarchical file structures with visual icons and descriptions.
 * Renders a tree view of files and folders using Lucide icons.
 *
 * Distributed with mint-tsdocs and automatically installed to docs/snippets/.
 * Uses Mintlify's native Icon component for consistent styling.
 *
 * @version 3.0.0
 */

/**
 * FileTree - Static hierarchical file structure visualization with Lucide icons
 * @param {import('./FileTree').FileTreeProps} props
 * @returns {JSX.Element}
 */
export const FileTree = ({
  structure,
  item,
  title,
  level = 0,
  maxDepth = 10,
  showIcons = true
}) => {
  // Helper to get Lucide icon for file types
  const getFileIcon = (fileName, hasChildren) => {
    if (hasChildren) {
      return 'folder-open';
    }

    // if (fileName.endsWith('.json')) return 'file-code';
    // if (fileName.endsWith('.jsonl')) return 'file-stack';
    // if (fileName.endsWith('.ts')) return 'file-code';
    // if (fileName.endsWith('.js')) return 'file-code';
    // if (fileName.endsWith('.md')) return 'file-text';
    // if (fileName.endsWith('.css')) return 'file-code';
    // if (fileName.endsWith('.html')) return 'file-code';
    // if (fileName.endsWith('.py')) return 'file-code';
    // if (fileName.endsWith('.java')) return 'file-code';
    // if (fileName.endsWith('.cpp') || fileName.endsWith('.c')) return 'file-code';
    // if (fileName.endsWith('.go')) return 'file-code';
    // if (fileName.endsWith('.rs')) return 'file-code';
    // if (fileName.endsWith('.vue')) return 'file-code';
    // if (fileName.endsWith('.jsx') || fileName.endsWith('.tsx')) return 'file-code';
    // if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) return 'file-code';
    // if (fileName.endsWith('.xml')) return 'file-code';
    // if (fileName.endsWith('.sql')) return 'file-code';
    // if (fileName.endsWith('.sh') || fileName.endsWith('.bash')) return 'file-terminal';
    // if (fileName.endsWith('.dockerfile')) return 'file-code';
    // if (fileName.endsWith('.gitignore')) return 'file-code';
    // if (fileName.endsWith('.lock')) return 'file-lock';
    // if (fileName.endsWith('.txt')) return 'file-text';
    // if (fileName.endsWith('.pdf')) return 'file-text';
    // if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) return 'file-text';
    // if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) return 'file-spreadsheet';
    // if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.gif') || fileName.endsWith('.svg')) return 'file-image';
    // if (fileName.endsWith('.mp3') || fileName.endsWith('.wav') || fileName.endsWith('.flac')) return 'file-music';
    // if (fileName.endsWith('.mp4') || fileName.endsWith('.avi') || fileName.endsWith('.mov')) return 'file-video-camera';
    // if (fileName.endsWith('.zip') || fileName.endsWith('.tar') || fileName.endsWith('.gz') || fileName.endsWith('.rar')) return 'file-archive';
    
    return 'file';
  };

  // Handle root-level rendering (when structure prop is provided)
  if (structure !== undefined) {
    return (
      <div
        data-component="tsdocs-filetree"
        className="code-block mt-5 mb-8 not-prose rounded-2xl relative group
                   text-gray-950 bg-gray-50 dark:bg-white/5 dark:text-gray-50
                   border border-gray-950/10 dark:border-white/10
                   p-0.5">
        {title && (
          <div className="flex text-gray-400 text-xs rounded-t-[14px] leading-6 font-medium pl-4 pr-2.5 py-1">
            <div className="flex-none flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
              {title}
            </div>
          </div>
        )}
        <div className={`prose prose-sm dark:prose-invert w-0 min-w-full max-w-full py-3.5 px-4 bg-white dark:bg-codeblock overflow-x-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-black/15 hover:scrollbar-thumb-black/20 dark:scrollbar-thumb-white/20 dark:hover:scrollbar-thumb-white/25 rounded-xt`}
             style={{
               fontFamily: 'ui-monospace, SFMono-Regular, monospace',
               fontSize: '0.875rem'
             }}>
          {structure.map((fileItem, index) => {
            // Skip invalid items to prevent errors
            if (!fileItem || !fileItem.name) return null;
            return (
              <FileTree
                key={index}
                item={fileItem}
                level={0}
                maxDepth={maxDepth}
                showIcons={showIcons}
                />
            );
          })}
        </div>
      </div>
    );
  }

  // Handle undefined item (prevents errors in recursive calls)
  if (!item) {
    return null;
  }

  // Prevent infinite recursion
  if (level >= maxDepth) {
    return (
      <div style={{
        paddingLeft: `${level * 20}px`,
        paddingTop: '4px',
        paddingBottom: '4px',
        color: '#6b7280',
        fontStyle: 'italic'
      }}>
        {showIcons && <Icon icon="AlertTriangle" />} (max depth reached)
      </div>
    );
  }

  const hasChildren = item.children != null && item.children.length > 0;
  const indent = level * 20;

  // Render folder with expandable children
  if (hasChildren) {
    return (
      <div style={{
        position: 'relative',
        paddingLeft: `${indent}px`
      }}>
        {/* Vertical guide line for nested items */}
        {level > 0 && (
          <div style={{
            position: 'absolute',
            left: `${indent - 12}px`,
            top: '20px',
            bottom: '0',
            width: '1px',
            backgroundColor: 'rgba(156, 163, 175, 0.2)', // subtle gray line
            borderLeft: '1px solid rgba(156, 163, 175, 0.1)'
          }} />
        )}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingTop: '4px',
          paddingBottom: '4px'
        }}>
          {showIcons && (
            <Icon icon={getFileIcon(item.name, true)} />
          )}
          <span style={{ fontWeight: 500 }}>
            {item.name}
          </span>
          {item.description && (
            <span style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              marginLeft: '8px'
            }}>
              {item.description}
            </span>
          )}
          {item.badge && (
            <Badge color={item.badge.color || 'blue'}>
              {item.badge.text}
            </Badge>
          )}
        </div>
        {/* Static rendering of children - no Expandable component */}
        {item.children && item.children.map((child, i) => {
          // Use stable key: combine name with index for uniqueness
          const key = child.name ? `${child.name}-${i}` : `child-${i}`;
          return (
            <FileTree
              key={key}
              item={child}
              level={level + 1}
              maxDepth={maxDepth}
              showIcons={showIcons}
            />
          );
        })}
      </div>
    );
  }

  // Render file (leaf node)
  return (
    <div style={{
      position: 'relative',
      paddingLeft: `${indent}px`,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      paddingTop: '4px',
      paddingBottom: '4px'
    }}>
      {/* Vertical guide line for nested items */}
      {level > 0 && (
        <div style={{
          position: 'absolute',
          left: `${indent - 12}px`,
          top: '0',
          bottom: '0',
          width: '1px',
          backgroundColor: 'rgba(156, 163, 175, 0.2)', // subtle gray line
          borderLeft: '1px solid rgba(156, 163, 175, 0.1)'
        }} />
      )}
      {showIcons && (
        <Icon icon={getFileIcon(item.name, false)} />
      )}
      <span>
        {item.name}
      </span>
      {item.description && (
        <span style={{
          fontSize: '0.75rem',
          color: '#94a3b8',
          marginLeft: '8px'
        }}>
          {item.description}
        </span>
      )}
      {item.badge && (
        <Badge color={item.badge.color || 'blue'}>
          {item.badge.text}
        </Badge>
      )}
    </div>
  );
};

/**
 * FileTreeGroup - Simple wrapper for grouping multiple FileTree components
 * @param {import('./FileTree').FileTreeGroupProps} props
 * @returns {JSX.Element}
 */
export const FileTreeGroup = ({ title, children }) => {
  return (
    <div>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
};

export default FileTree;
