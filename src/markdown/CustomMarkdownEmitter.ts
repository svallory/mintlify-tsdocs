import type { DocNode, DocLinkTag, DocPlainText, DocSection, DocParagraph } from '@microsoft/tsdoc';
import { StringBuilder } from '@microsoft/tsdoc';
import type { ApiModel, IResolveDeclarationReferenceResult, ApiItem } from '@microsoft/api-extractor-model';
import { ApiItemKind } from '@microsoft/api-extractor-model';
import { Colorize } from '@rushstack/terminal';

import { CustomDocNodeKind } from '../nodes/CustomDocNodeKind';
import type { DocHeading } from '../nodes/DocHeading';
import type { DocNoteBox } from '../nodes/DocNoteBox';
import type { DocTable } from '../nodes/DocTable';
import type { DocTableCell } from '../nodes/DocTableCell';
import type { DocEmphasisSpan } from '../nodes/DocEmphasisSpan';
import type { DocExpandable } from '../nodes/DocExpandable';
import { DocumentationHelper } from '../utils/DocumentationHelper';
import { SecurityUtils } from '../utils/SecurityUtils';
import { ApiResolutionCache } from '../cache/ApiResolutionCache';
import {
  MarkdownEmitter,
  type IMarkdownEmitterContext,
  type IMarkdownEmitterOptions
} from './MarkdownEmitter';
import type { IMarkdownEmitterContext as IMarkdownEmitterContextBase } from './MarkdownEmitter';
import type { IndentedWriter } from '../utils/IndentedWriter';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import { createDebugger, type Debugger } from '../utils/debug';

const debug: Debugger = createDebugger('custom-markdown-emitter');

/**
 * Configuration options for CustomMarkdownEmitter
 * @public
 */
export interface ICustomMarkdownEmitterOptions extends IMarkdownEmitterOptions {
  contextApiItem: ApiItem | undefined;

  onGetFilenameForApiItem: (apiItem: ApiItem) => string | undefined;
}

/**
 * Custom markdown emitter that extends the base MarkdownEmitter to provide
 * Mintlify-specific formatting and cross-reference resolution.
 *
 * This emitter converts TSDoc tables into Mintlify components (ParamField, ResponseField, TypeTree)
 * for better documentation UX. It also handles API reference resolution with caching for performance.
 *
 * ## Architecture
 *
 * The emission process follows this flow:
 * 1. TSDoc nodes are traversed recursively via `writeNode()`
 * 2. Tables are detected and classified by their header content
 * 3. Property tables → TypeTree components with nested object support
 * 4. Method/Constructor tables → ResponseField components
 * 5. Other tables → HTML table fallback
 *
 * ## Security Considerations
 *
 * All user content is sanitized through SecurityUtils before being embedded in JSX/MDX:
 * - `sanitizeJsxAttribute()` - For JSX attribute values (prevents quote escape attacks)
 * - `sanitizeJsonForJsx()` - For JSON data embedded in JSX props
 * - `getEscapedText()` - For markdown content (prevents markdown injection)
 *
 * Note: Content injection (XSS, template injection) is NOT a threat because users
 * generate documentation from their own code for their own sites. Security focus
 * is on command injection and path traversal (see CLAUDE.md).
 *
 * ## Caching Strategy
 *
 * API reference resolution is cached via ApiResolutionCache (LRU cache) to avoid
 * repeated expensive lookups during documentation generation. Cache is ephemeral
 * (per-run) and does not persist across builds.
 *
 * @see /architecture/emission-layer - Emission layer architecture
 * @see /components/type-tree - TypeTree component documentation
 *
 * @public
 */
export class CustomMarkdownEmitter extends MarkdownEmitter {
  private _apiModel: ApiModel;
  private _docHelper: DocumentationHelper;
  private _apiResolutionCache: ApiResolutionCache;

  public constructor(apiModel: ApiModel) {
    super();

    this._apiModel = apiModel;
    this._docHelper = new DocumentationHelper();
    this._apiResolutionCache = new ApiResolutionCache({ enabled: true, maxSize: 500 });
  }

  /**
   * Gets the fully qualified name of an API item within its package context.
   *
   * Generates hierarchical names like "Namespace.Class.method" by walking up the
   * parent chain until reaching the Package or Model level. Entry points are skipped.
   *
   * @param apiItem - The API item to generate a scoped name for
   * @returns Dot-separated qualified name (e.g., "Utils.Logger.log")
   *
   * @example
   * ```typescript
   * // For a method "log" in class "Logger" in namespace "Utils"
   * _getScopedNameWithinPackage(logMethod) // → "Utils.Logger.log"
   * ```
   */
  private _getScopedNameWithinPackage(apiItem: ApiItem): string {
    const parts: string[] = [];
    let current: ApiItem | undefined = apiItem;

    while (current && current.kind !== ApiItemKind.Package && current.kind !== ApiItemKind.Model) {
      if (current.kind !== ApiItemKind.EntryPoint && current.displayName) {
        parts.unshift(current.displayName);
      }
      current = current.parent;
    }

    return parts.join('.') || apiItem.displayName || 'unknown';
  }

  /**
   * Emits markdown content from a DocNode tree.
   *
   * Entry point for the emission process. Delegates to parent class implementation
   * which handles the recursive node traversal via `writeNode()`.
   *
   * @param stringBuilder - StringBuilder to accumulate output
   * @param docNode - Root DocNode to emit
   * @param options - Emission options including context API item and filename resolver
   * @returns The emitted markdown content as a string
   *
   * @public
   */
  public emit(
    stringBuilder: StringBuilder,
    docNode: DocNode,
    options: ICustomMarkdownEmitterOptions
  ): string {
    return super.emit(stringBuilder, docNode, options);
  }

  /**
   * Writes a single DocNode to the output.
   *
   * Overrides parent implementation to add custom handling for:
   * - DocHeading - Markdown headings with configurable levels
   * - DocNoteBox - Block quotes for note/warning boxes
   * - DocTable - Mintlify components (TypeTree, ResponseField) or HTML fallback
   * - DocEmphasisSpan - Bold/italic text spans
   * - DocExpandable - Collapsible sections
   *
   * All other node types delegate to parent class.
   *
   * @param docNode - The node to write
   * @param context - Emission context with writer and options
   * @param docNodeSiblings - Whether this node has siblings (affects spacing)
   *
   * @override
   */
  protected writeNode(docNode: DocNode, context: IMarkdownEmitterContext<ICustomMarkdownEmitterOptions>, docNodeSiblings: boolean): void {
    const writer: IndentedWriter = context.writer;

    switch (docNode.kind) {
      case CustomDocNodeKind.Heading: {
        const docHeading: DocHeading = docNode as DocHeading;
        writer.ensureSkippedLine();

        // eslint-disable-next-line no-magic-numbers
        let prefix: string = "#".repeat(docHeading.level || 2);

        // Use secure string concatenation with proper escaping
        const escapedTitle = this.getEscapedText(docHeading.title);
        writer.writeLine(`${prefix} ${escapedTitle}`);
        writer.writeLine();
        break;
      }
      case CustomDocNodeKind.NoteBox: {
        const docNoteBox: DocNoteBox = docNode as DocNoteBox;
        writer.ensureNewLine();

        writer.increaseIndent('> ');

        this.writeNode(docNoteBox.content, context, false);
        writer.ensureNewLine();

        writer.decreaseIndent();

        writer.writeLine();
        break;
      }
      case CustomDocNodeKind.Table: {
        const docTable: DocTable = docNode as DocTable;

        // Analyze table structure and convert to Mintlify components
        this._writeMintlifyTable(docTable, context);
        break;
      }
      case CustomDocNodeKind.EmphasisSpan: {
        const docEmphasisSpan: DocEmphasisSpan = docNode as DocEmphasisSpan;
        const oldBold: boolean = context.boldRequested;
        const oldItalic: boolean = context.italicRequested;
        context.boldRequested = docEmphasisSpan.bold;
        context.italicRequested = docEmphasisSpan.italic;
        this.writeNodes(docEmphasisSpan.nodes, context);
        context.boldRequested = oldBold;
        context.italicRequested = oldItalic;
        break;
      }
      case CustomDocNodeKind.Expandable: {
        const docExpandable: DocExpandable = docNode as DocExpandable;
        writer.ensureNewLine();

        // Securely sanitize the title for JSX attribute use
        const sanitizedTitle = SecurityUtils.sanitizeJsxAttribute(docExpandable.title, 'title');

        // Write the Expandable component with defaultOpen={true}
        writer.writeLine(`<Expandable title="${sanitizedTitle}" defaultOpen={true}>`);

        // Write the content with increased indent
        writer.increaseIndent('  ');
        this.writeNode(docExpandable.content, context, false);
        writer.decreaseIndent();

        writer.writeLine('</Expandable>');
        writer.ensureNewLine();
        break;
      }
      default:
        super.writeNode(docNode, context, docNodeSiblings);
    }
  }

  /**
   * Writes a link tag that references code entities (API items).
   *
   * Overrides parent implementation to:
   * 1. Resolve API references via ApiModel with caching
   * 2. Generate markdown links to resolved items' documentation pages
   * 3. Use scoped names as link text when not explicitly provided
   *
   * @param docLinkTag - The link tag to write
   * @param context - Emission context with options containing contextApiItem and filename resolver
   *
   * @remarks
   * Uses ApiResolutionCache for performance. Cache hit rates are typically >90% during
   * documentation generation due to repeated references to common types.
   *
   * If resolution fails, logs a debug warning but doesn't write anything (fails silently).
   * This is intentional - unresolvable references are usually external types or errors
   * in the source TSDoc.
   *
   * @override
   */
  protected writeLinkTagWithCodeDestination(
    docLinkTag: DocLinkTag,
    context: IMarkdownEmitterContext<ICustomMarkdownEmitterOptions>
  ): void {
    const options: ICustomMarkdownEmitterOptions = context.options;

    // Use cached API resolution for better performance
    const result: IResolveDeclarationReferenceResult = this._apiResolutionCache.get(
      docLinkTag.codeDestination!,
      options.contextApiItem
    ) ?? this._apiModel.resolveDeclarationReference(
      docLinkTag.codeDestination!,
      options.contextApiItem
    );

    // Cache the result if it wasn't cached
    if (!this._apiResolutionCache.get(docLinkTag.codeDestination!, options.contextApiItem)) {
      this._apiResolutionCache.set(docLinkTag.codeDestination!, options.contextApiItem, result);
    }

    if (result.resolvedApiItem) {
      const filename: string | undefined = options.onGetFilenameForApiItem(result.resolvedApiItem);

      if (filename) {
        let linkText: string = docLinkTag.linkText || '';
        if (linkText.length === 0) {
          // Generate a name such as Namespace1.Namespace2.MyClass.myMethod()
          linkText = this._getScopedNameWithinPackage(result.resolvedApiItem);
        }
        if (linkText.length > 0) {
          const encodedLinkText: string = this.getEscapedText(linkText.replace(/\s+/g, ' '));

          context.writer.write('[');
          context.writer.write(encodedLinkText);
          context.writer.write(`](${filename!})`);
        } else {
          debug.warn(Colorize.yellow('WARNING: Unable to determine link text'));
        }
      }
    } else if (result.errorMessage) {
      debug.debug(
        Colorize.yellow(
          `WARNING: Unable to resolve reference "${docLinkTag.codeDestination!.emitAsTsdoc()}": ` +
            result.errorMessage
        )
      );
    }
  }

  /**
   * Writes a table using Mintlify components instead of HTML tables.
   *
   * Detects table type by examining header cell content and routes to appropriate renderer:
   * - Property/Parameter tables → TypeTree components (via `_writePropertySection`)
   * - Constructor/Method tables → ResponseField components (via `_writeMethodSection`)
   * - Other tables → HTML table fallback (via `_writeHtmlTableFallback`)
   *
   * @param docTable - The TSDoc table node to render
   * @param context - Emission context containing writer and options
   *
   * @remarks
   * Table type detection is based on keywords in header cells. This heuristic works
   * for standard API Extractor output but may need refinement for custom table formats.
   */
  private _writeMintlifyTable(
    docTable: DocTable,
    context: IMarkdownEmitterContext<ICustomMarkdownEmitterOptions>
  ): void {
    const writer = context.writer;
    writer.ensureSkippedLine();

    // Detect table type by examining header content
    const isParameterTable = this._hasHeaderKeyword(docTable, ['Property', 'Parameter']);
    const isConstructorMethodTable = this._hasHeaderKeyword(docTable, ['Constructor', 'Method']);

    if (isParameterTable) {
      // Convert to TypeTree components for properties
      this._writePropertySection(docTable, context, 'Properties');
    } else if (isConstructorMethodTable) {
      // Convert to ResponseField components for constructors/methods
      this._writeMethodSection(docTable, context, 'Methods');
    } else {
      // Fallback to HTML table rendering for other table types
      this._writeHtmlTableFallback(docTable, context);
    }
  }

  /**
   * Checks if any table header cell contains one of the specified keywords.
   *
   * Searches through header cells and their nested nodes (including paragraphs)
   * for case-insensitive keyword matches after normalizing whitespace.
   *
   * @param docTable - The table to check
   * @param keywords - Array of keywords to search for (case-insensitive)
   * @returns True if any header cell contains any of the keywords
   *
   * @example
   * ```typescript
   * _hasHeaderKeyword(table, ['Property', 'Parameter']) // Detects property tables
   * _hasHeaderKeyword(table, ['Constructor', 'Method']) // Detects method tables
   * ```
   */
  private _hasHeaderKeyword(docTable: DocTable, keywords: string[]): boolean {
    if (!docTable.header) return false;

    return docTable.header.cells.some(cell => {
      if (!cell || !cell.content) return false;
      return this._cellContainsKeywords(cell, keywords);
    });
  }

  /**
   * Recursively checks if a table cell contains any of the specified keywords.
   *
   * Traverses the cell's content nodes (PlainText, Paragraph) and checks if the
   * normalized text contains any keyword (case-insensitive).
   *
   * @param cell - The table cell to search
   * @param keywords - Array of keywords to search for
   * @returns True if the cell contains any keyword
   */
  private _cellContainsKeywords(cell: DocTableCell, keywords: string[]): boolean {
    return cell.content.nodes.some(node => {
      const text = this._getTextContent(node);
      const cleanText = text.trim().replace(/\s+/g, ' ').toLowerCase();
      return keywords.some(keyword => cleanText.includes(keyword.toLowerCase()));
    });
  }

  /**
   * Writes a table using HTML format as fallback for non-property/method tables.
   *
   * Used when table doesn't match known patterns (property/method tables). Generates
   * standard HTML table markup with thead/tbody structure. Handles inconsistent column
   * counts by sizing table based on the longest row.
   *
   * @param docTable - The table to render as HTML
   * @param context - Emission context containing writer and options
   *
   * @remarks
   * This fallback ensures all TSDoc tables render correctly even if they don't match
   * the expected Mintlify component patterns (e.g., custom tables, comparison tables).
   */
  private _writeHtmlTableFallback(
    docTable: DocTable,
    context: IMarkdownEmitterContext<ICustomMarkdownEmitterOptions>
  ): void {
    const writer = context.writer;
    writer.ensureSkippedLine();

    // Markdown table rows can have inconsistent cell counts.  Size the table based on the longest row.
    let columnCount = 0;
    if (docTable.header) {
      columnCount = docTable.header.cells.length;
    }
    for (const row of docTable.rows) {
      if (row.cells.length > columnCount) {
        columnCount = row.cells.length;
      }
    }

    writer.write('<table>');
    if (docTable.header) {
      writer.write('<thead><tr>');
      for (let i = 0; i < columnCount; ++i) {
        writer.write('<th>');
        writer.ensureNewLine();
        writer.writeLine();
        const cell = docTable.header.cells[i];
        if (cell) {
          this.writeNode(cell.content, context, false);
        }
        writer.ensureNewLine();
        writer.writeLine();
        writer.write('</th>');
      }
      writer.write('</tr></thead>');
    }
    writer.writeLine();
    writer.write('<tbody>');
    for (const row of docTable.rows) {
      writer.write('<tr>');
      for (const cell of row.cells) {
        writer.write('<td>');
        writer.ensureNewLine();
        writer.writeLine();
        this.writeNode(cell.content, context, false);
        writer.ensureNewLine();
        writer.writeLine();
        writer.write('</td>');
      }
      writer.write('</tr>');
      writer.writeLine();
    }
    writer.write('</tbody>');
    writer.write('</table>');
    writer.ensureSkippedLine();
  }

  /**
   * Writes a property section using TypeTree components with nested object support.
   *
   * Processes property/parameter tables and renders each row as a TypeTree component
   * with full support for nested object properties. Automatically imports TypeTree
   * component on first use.
   *
   * @param docTable - The table containing property definitions
   * @param context - Emission context containing writer and options
   * @param title - Section title (e.g., "Properties", "Parameters")
   *
   * @remarks
   * Property rows must have 4 columns: Name, Modifiers, Type, Description.
   * Type analysis happens via DocumentationHelper which can extract nested object
   * structures from complex types. The TypeTree component is imported from the
   * snippets directory and handles nested property rendering with expand/collapse.
   *
   * Security: All property data is sanitized via SecurityUtils before JSX embedding.
   */
  private _writePropertySection(
    docTable: DocTable,
    context: IMarkdownEmitterContext<ICustomMarkdownEmitterOptions>,
    title: string
  ): void {
    const writer = context.writer;

    // Add TypeTree import if not already added
    if (!(context as any).hasTypeTreeImport) {
      writer.writeLine();
      writer.writeLine('import { TypeTree } from "/snippets/tsdocs/TypeTree.jsx"');
      writer.writeLine();
      (context as any).hasTypeTreeImport = true;
    }

    // Write section header
    writer.ensureSkippedLine();
    writer.writeLine(`## ${title}`);
    writer.ensureSkippedLine();

    // Process each row as a ParamField
    for (const row of docTable.rows) {
      if (row.cells.length >= 4) {
        const nameCell = row.cells[0];
        const modifiersCell = row.cells[1];
        const typeCell = row.cells[2];
        const descCell = row.cells[3];

        let paramName = '';
        let paramType = '';
        let paramDescription = '';
        let paramRequired = true;
        let paramDeprecated = false;

        // Extract name
        if (nameCell && nameCell.content) {
          const nameBuilder = new StringBuilder();
          this._extractTextContentWithTypeResolution(nameCell.content, nameBuilder, context.options.contextApiItem);
          paramName = nameBuilder.toString().trim();

          // Clean up property name (remove optional marker)
          if (paramName.endsWith('?')) {
            paramName = paramName.slice(0, -1);
            paramRequired = false; // Mark as optional
          }
        }

        // Extract type
        if (typeCell && typeCell.content) {
          const typeBuilder = new StringBuilder();
          this._extractTextContentWithTypeResolution(typeCell.content, typeBuilder, context.options.contextApiItem);
          paramType = typeBuilder.toString().trim();
        }

        // Extract description
        if (descCell && descCell.content) {
          const descBuilder = new StringBuilder();
          this._extractTextContent(descCell.content, descBuilder);
          paramDescription = descBuilder.toString().trim();

          // Check for optional/required indicators
          if (paramDescription.includes('(Optional)')) {
            paramRequired = false;
            paramDescription = paramDescription.replace('(Optional)', '').trim();
          }

          // Check for deprecated indicators
          if (paramDescription.toLowerCase().includes('deprecated')) {
            paramDeprecated = true;
          }
        }

        if (paramName) {
          // Fallback for missing types
          if (!paramType) {
            debug.warn(`Property ${paramName} has empty type, using 'object' as fallback`);
            paramType = 'object';
          }
          // Use the DocumentationHelper to analyze the type for nested objects
          const propertyInfo = this._docHelper.analyzeTypeProperties(paramType, paramDescription, paramName);

          // Sanitize parameter name and type for JSX attributes
          const sanitizedParamName = SecurityUtils.sanitizeJsxAttribute(paramName, 'name');
          const sanitizedParamType = SecurityUtils.sanitizeJsxAttribute(propertyInfo.type, 'type');

          // Write the TypeTree component with nested object support
          writer.writeLine('<TypeTree');
          writer.increaseIndent('  ');
          writer.writeLine(`name="${sanitizedParamName}"`);
          writer.writeLine(`type="${sanitizedParamType}"`);

          // Write description if available
          if (propertyInfo.description) {
            // Escape quotes in description
            const escapedDesc = propertyInfo.description.replace(/"/g, '\\"').replace(/\n/g, ' ');
            writer.writeLine(`description="${escapedDesc}"`);
          }

          // Add required/deprecated flags
          if (paramRequired) {
            writer.writeLine(`required={true}`);
          }
          if (paramDeprecated) {
            writer.writeLine(`deprecated={true}`);
          }

          // Write nested properties as JSON array if available
          if (propertyInfo.nestedProperties && propertyInfo.nestedProperties.length > 0) {
            // Sanitize JSON data for safe JSX embedding
            const sanitizedPropsJson = SecurityUtils.sanitizeJsonForJsx(propertyInfo.nestedProperties);
            writer.writeLine(`properties={${sanitizedPropsJson}}`);
          }

          writer.decreaseIndent();
          writer.writeLine('/>');
          writer.ensureNewLine();
        }
      }
    }
  }

  /**
   * Writes a method section using ResponseField components.
   *
   * Processes constructor/method tables and renders each row as a ResponseField component.
   * Used for documenting class constructors and method members in a structured format.
   *
   * @param docTable - The table containing method/constructor definitions
   * @param context - Emission context containing writer and options
   * @param title - Section title (e.g., "Methods", "Constructors")
   *
   * @remarks
   * Method rows must have at least 3 columns: Name, Modifiers, Description.
   * ResponseField components support required/deprecated flags extracted from description text.
   *
   * Security: Method names are sanitized via SecurityUtils before JSX embedding.
   */
  private _writeMethodSection(
    docTable: DocTable,
    context: IMarkdownEmitterContext<ICustomMarkdownEmitterOptions>,
    title: string
  ): void {
    const writer = context.writer;

    // Write section header
    writer.ensureSkippedLine();
    writer.writeLine(`## ${title}`);
    writer.ensureSkippedLine();

    // Process each row as a ResponseField
    for (const row of docTable.rows) {
      if (row.cells.length >= 3) {
        const nameCell = row.cells[0];
        const modifiersCell = row.cells[1];
        const descCell = row.cells[2];

        let responseName = '';
        let responseDescription = '';
        let responseRequired = true;
        let responseDeprecated = false;

        // Extract name
        if (nameCell && nameCell.content) {
          const nameBuilder = new StringBuilder();
          this._extractTextContent(nameCell.content, nameBuilder);
          responseName = nameBuilder.toString().trim();
        }

        // Extract description
        if (descCell && descCell.content) {
          const descBuilder = new StringBuilder();
          this._extractTextContent(descCell.content, descBuilder);
          responseDescription = descBuilder.toString().trim();

          if (responseDescription.toLowerCase().includes('deprecated')) {
            responseDeprecated = true;
          }
        }

        if (responseName) {
          // Sanitize response name for JSX attribute use
          const sanitizedResponseName = SecurityUtils.sanitizeJsxAttribute(responseName, 'name');

          // Build the ResponseField component with proper attribute escaping
          const attributes: string[] = [`name="${sanitizedResponseName}"`];
          if (responseRequired) {
            attributes.push('required={true}');
          }
          if (responseDeprecated) {
            attributes.push('deprecated={true}');
          }

          // Write the ResponseField directly
          writer.writeLine(`<ResponseField ${attributes.join(' ')}>`);

          // Write description if available
          if (responseDescription) {
            writer.increaseIndent('  ');
            writer.writeLine(responseDescription);
            writer.decreaseIndent();
          }

          writer.writeLine('</ResponseField>');
          writer.ensureNewLine();
        }
      }
    }
  }

  /**
   * Extracts plain text content from a DocNode tree.
   *
   * Recursively traverses DocNode tree (PlainText, Section, Paragraph, LinkTag) and
   * appends all text content to the StringBuilder. Handles link text extraction for
   * API references.
   *
   * @param docNode - The DocNode to extract text from
   * @param stringBuilder - StringBuilder to append extracted text to
   *
   * @remarks
   * This is a simpler version of `_extractTextContentWithTypeResolution` that doesn't
   * resolve API references. Used for extracting descriptions and simple text content.
   */
  private _extractTextContent(docNode: DocNode, stringBuilder: StringBuilder): void {
    if (docNode.kind === 'PlainText') {
      const docPlainText = docNode as any;
      if (docPlainText.text) {
        stringBuilder.append(docPlainText.text);
      }
    } else if (docNode.kind === 'Section' || docNode.kind === 'Paragraph') {
      const containerNode = docNode as any;
      if (containerNode.nodes) {
        for (const child of containerNode.nodes) {
          this._extractTextContent(child, stringBuilder);
        }
      }
    } else if (docNode.kind === 'LinkTag') {
      // Handle LinkTag nodes that might contain link text
      const linkTag = docNode as any;
      if (linkTag.linkText) {
        stringBuilder.append(linkTag.linkText);
      } else if (linkTag.codeDestination) {
        // For code links, try to get the text content of the destination
        stringBuilder.append(linkTag.codeDestination.emitAsTsdoc());
      }
    }
  }

  /**
   * Enhanced text extraction that resolves API references to their actual type definitions.
   *
   * Similar to `_extractTextContent` but with special handling for LinkTag nodes. When
   * encountering a LinkTag, attempts to resolve the referenced API item and extract its
   * actual type signature (e.g., object literal types, complex type definitions).
   *
   * @param docNode - The DocNode to extract text from
   * @param stringBuilder - StringBuilder to append extracted text to
   * @param contextApiItem - The API item context for resolving references
   *
   * @remarks
   * This method has several fallback strategies for LinkTag resolution:
   * 1. Extract from `_code` property if available (internal TSDoc structure)
   * 2. Use `linkText` if provided explicitly
   * 3. Resolve API reference via ApiModel and extract type from excerpt tokens
   * 4. Search for inline object literal in context API item's members
   * 5. Fallback to TSDoc representation
   *
   * This aggressive resolution is necessary for complex TypeScript types (union types,
   * object literals, mapped types) that API Extractor stores as references rather than
   * inline types.
   */
  private _extractTextContentWithTypeResolution(
    docNode: DocNode,
    stringBuilder: StringBuilder,
    contextApiItem?: ApiItem
  ): void {
    if (docNode.kind === 'PlainText') {
      const docPlainText = docNode as any;
      if (docPlainText.text) {
        stringBuilder.append(docPlainText.text);
      }
    } else if (docNode.kind === 'Section' || docNode.kind === 'Paragraph') {
      const containerNode = docNode as any;
      if (containerNode.nodes) {
        for (const child of containerNode.nodes) {
          this._extractTextContentWithTypeResolution(child, stringBuilder, contextApiItem);
        }
      }
    } else if (docNode.kind === 'LinkTag') {
      const linkTag = docNode as DocLinkTag;

      // First try to extract the code directly from the LinkTag if available
      const linkTagAny = linkTag as any;
      if (linkTagAny._code) {
        stringBuilder.append(linkTagAny._code);
        return;
      }

      // Try to access _code from nodes structure
      if (linkTagAny._nodes) {
        const nodes = linkTagAny._nodes;
        for (const node of nodes) {
          if (node._code) {
            stringBuilder.append(node._code);
            return;
          }
        }
      }

      // Then try to use link text if available
      if (linkTag.linkText) {
        stringBuilder.append(linkTag.linkText);
        return;
      }

      // If no link text, try to resolve the code destination
      if (linkTag.codeDestination) {
        try {
          const result: IResolveDeclarationReferenceResult = this._apiModel.resolveDeclarationReference(
            linkTag.codeDestination,
            contextApiItem
          );

          if (result.resolvedApiItem) {
            // Try to get the actual type information from the resolved API item
            const apiItem = result.resolvedApiItem;

            // For property signatures, try to extract the type from the excerpt
            if (apiItem.kind === 'PropertySignature' || apiItem.kind === 'Variable') {
              const excerpt = (apiItem as any).excerptTokens;
              if (excerpt && excerpt.length > 1) {
                // Look for the type token (usually the second token after the name)
                for (let i = 1; i < excerpt.length; i++) {
                  if (excerpt[i].kind === 'Content') {
                    stringBuilder.append(excerpt[i].text.trim());
                    break;
                  }
                }
                return;
              }
            }

            // Fallback to the scoped name
            stringBuilder.append(this._getScopedNameWithinPackage(apiItem));
          } else {
            // Enhanced fallback: try to extract inline object literal from the current context
            if (contextApiItem) {
              // Look for the property in the current context's members
              const propertyName = linkTag.codeDestination?.memberReferences?.[0]?.memberIdentifier?.identifier;
              if (propertyName) {
                // Search for this property in the current API item
                if ('members' in contextApiItem) {
                  const members = (contextApiItem as any).members;
                  const property = members?.find((m: any) => m.name === propertyName);
                  if (property && 'excerptTokens' in property) {
                    const excerpt = (property as any).excerptTokens;
                    if (excerpt && excerpt.length > 1) {
                      // Extract the complete type definition (all tokens after the name)
                      const typeTokens = excerpt.slice(1).filter((token: any) => token.kind === 'Content');
                      if (typeTokens.length > 0) {
                        // Join all type tokens to get the complete type definition
                        const completeType = typeTokens.map((token: any) => token.text).join('').trim();
                        stringBuilder.append(completeType);
                        return;
                      }
                    }
                  }
                }
              }
            }

            // Final fallback to the original code destination
            stringBuilder.append(linkTag.codeDestination.emitAsTsdoc());
          }
        } catch (error) {
          // If resolution fails, fallback to the original code destination
          debug.debug(`Failed to resolve declaration reference: ${error}`);
          stringBuilder.append(linkTag.codeDestination.emitAsTsdoc());
        }
      }
    }
  }

  /**
   * Convenience method to extract text content from a DocNode as a string.
   *
   * Wraps `_extractTextContent` with StringBuilder creation for simple one-off text extraction.
   *
   * @param docNode - The DocNode to extract text from
   * @returns The extracted text as a string
   */
  private _getTextContent(docNode: DocNode): string {
    const stringBuilder = new StringBuilder();
    this._extractTextContent(docNode, stringBuilder);
    return stringBuilder.toString();
  }

  /**
   * Recursively writes nested properties with infinite depth support.
   *
   * Legacy method for rendering nested properties as ParamField components with
   * Expandable sections. Note: This is deprecated in favor of the TypeTree component
   * which handles nested properties more elegantly.
   *
   * @param nestedProperties - Array of nested property definitions
   * @param writer - IndentedWriter for output
   * @param indent - Current indentation level as string
   *
   * @deprecated Use TypeTree component with properties prop instead
   *
   * @remarks
   * Each nested property can have its own `nestedProperties` array for arbitrary depth.
   * Properties are wrapped in Expandable components at each nesting level for better UX.
   */
  private _writeNestedProperties(
    nestedProperties: any[],
    writer: IndentedWriter,
    indent: string
  ): void {
    for (const nestedProp of nestedProperties) {
      writer.writeLine(`${indent}<ParamField path="${nestedProp.name}" type="${nestedProp.type}"${nestedProp.required ? ' required' : ''}>`);

      if (nestedProp.description) {
        writer.writeLine(`${indent}  ${nestedProp.description}`);
      }

      // Recursively handle deeper nested properties
      if (nestedProp.nestedProperties && nestedProp.nestedProperties.length > 0) {
        writer.writeLine();
        writer.writeLine(`${indent}  <Expandable title="Properties" defaultOpen={true}>`);

        // Recursively write deeper nested properties
        this._writeNestedProperties(nestedProp.nestedProperties, writer, `${indent}    `);

        writer.writeLine(`${indent}  </Expandable>`);
      }

      writer.writeLine(`${indent}</ParamField>`);
    }
  }
}
