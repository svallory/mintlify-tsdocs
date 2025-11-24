import {
  type DocNode,
  DocNodeKind,
  type StringBuilder,
  type DocPlainText,
  type DocHtmlStartTag,
  type DocHtmlEndTag,
  type DocCodeSpan,
  type DocLinkTag,
  type DocParagraph,
  type DocFencedCode,
  type DocSection,
  DocNodeTransforms,
  type DocEscapedText,
  type DocErrorText,
  type DocBlockTag
} from '@microsoft/tsdoc';
import { InternalError } from '@rushstack/node-core-library';

import { IndentedWriter } from '../utils/IndentedWriter';
import { createDebugger, type Debugger } from '../utils/debug';

const debug: Debugger = createDebugger('markdown-emitter');

/**
 * Configuration options for MarkdownEmitter
 * @public
 */
export interface IMarkdownEmitterOptions {}

/**
 * Characters that are safe to precede markdown formatting without a separator
 * @internal
 */
const SAFE_PRECEDING_CHARACTERS = ['', '\n', ' ', '[', '>'] as const;

/**
 * JSX comment syntax used as a zero-width separator in markdown
 *
 * When markdown formatting markers (like ** or *) appear adjacent to each other,
 * they can be misinterpreted. For example, "**one***two*" is ambiguous.
 * We insert {/* * /} as an invisible separator to ensure correct parsing:
 * "**one**{/* * /}*two*{/* * /}**three**"
 *
 * @internal
 */
const MARKDOWN_SEPARATOR = '{/* */}';

/**
 * TSDoc block tags that are handled elsewhere in the documentation system
 * and should not be rendered inline by the markdown emitter.
 *
 * - @default - Rendered in parameter tables
 * - @example - Rendered in dedicated examples section
 * - @remarks - Rendered as main description
 * - @returns - Rendered in return type section
 * - @param - Rendered in parameters table
 *
 * @internal
 */
const KNOWN_BLOCK_TAGS = ['@default', '@example', '@remarks', '@returns', '@param'] as const;

/**
 * Context for markdown emission
 * @public
 */
export interface IMarkdownEmitterContext<TOptions = IMarkdownEmitterOptions> {
  writer: IndentedWriter;

  boldRequested: boolean;
  italicRequested: boolean;

  writingBold: boolean;
  writingItalic: boolean;

  options: TOptions;
}

/**
 * Base class for rendering TSDoc nodes to Markdown/MDX format
 *
 * This emitter traverses a TSDoc abstract syntax tree and converts it to markdown text.
 * It handles standard markdown constructs (bold, italic, code, links) and provides
 * extension points for subclasses to customize behavior.
 *
 * ## Key Features
 *
 * - **TSDoc Node Processing**: Converts all standard TSDoc nodes to markdown
 * - **Text Escaping**: Ensures special markdown characters are properly escaped
 * - **Formatting Tracking**: Maintains state for bold/italic formatting
 * - **Extension Points**: Virtual methods for subclass customization
 *
 * ## Extension Points
 *
 * Subclasses can override these virtual methods:
 * - `writeNode()` - Customize handling for specific node types
 * - `writeLinkTagWithCodeDestination()` - Handle links to code symbols (e.g., {@link MyClass})
 * - `writeLinkTagWithUrlDestination()` - Handle external URL links
 *
 * ## Usage Example
 *
 * ```typescript
 * const emitter = new MarkdownEmitter();
 * const markdown = emitter.emit(stringBuilder, docNode, options);
 * ```
 *
 * @remarks
 * This class is designed to be extended. The base implementation provides standard
 * markdown output, but subclasses like CustomMarkdownEmitter add support for
 * Mintlify components and other custom behaviors.
 *
 * @public
 */
export class MarkdownEmitter {
  /**
   * Converts a TSDoc node tree to markdown text
   *
   * @param stringBuilder - Output buffer to write markdown to
   * @param docNode - Root TSDoc node to emit
   * @param options - Emission configuration options
   * @returns The complete markdown string
   *
   * @remarks
   * This is the main entry point for markdown emission. It initializes the emission
   * context (writer, formatting state) and recursively processes the node tree.
   * The output is automatically terminated with a newline.
   */
  public emit(stringBuilder: StringBuilder, docNode: DocNode, options: IMarkdownEmitterOptions): string {
    const writer: IndentedWriter = new IndentedWriter(stringBuilder);

    const context: IMarkdownEmitterContext = {
      writer,

      boldRequested: false,
      italicRequested: false,

      writingBold: false,
      writingItalic: false,

      options
    };

    this.writeNode(docNode, context, false);

    writer.ensureNewLine(); // finish the last line

    return writer.toString();
  }

  /**
   * Escapes text for safe markdown output
   *
   * @param text - Raw text to escape
   * @returns Text with markdown special characters escaped
   *
   * @remarks
   * The escaping order is critical:
   * 1. **Backslashes first** - Prevents double-escaping (e.g., `\*` becoming `\\*`)
   * 2. **Markdown syntax** - Escapes `*`, `#`, `[`, `]`, `_`, `|`, `` ` ``, `~`
   * 3. **Triple hyphens** - Prevents horizontal rules (`---`)
   * 4. **HTML entities** - Escapes `&`, `<`, `>` for safe HTML rendering
   *
   * This ensures that literal text like `*bold*` appears as-is instead of rendering
   * as markdown formatting.
   */
  protected getEscapedText(text: string): string {
    const textWithBackslashes: string = text
      .replace(/\\/g, '\\\\') // first replace the escape character
      .replace(/[*#[\]_|`~]/g, (x) => '\\' + x) // then escape any special characters
      .replace(/---/g, '\\-\\-\\-') // hyphens only if it's 3 or more
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return textWithBackslashes;
  }

  /**
   * Escapes text for safe output in markdown table cells
   *
   * @param text - Raw text to escape
   * @returns Text with table-specific characters escaped as HTML entities
   *
   * @remarks
   * Table cells require different escaping than regular markdown:
   * - **Pipe (`|`)** - Would break table column structure, escaped as `&#124;`
   * - **Quote (`"`)** - Escaped as `&quot;` for attribute safety
   * - **HTML entities** - `&`, `<`, `>` escaped for safe rendering
   *
   * Note: We don't escape markdown syntax (`*`, `_`, etc.) in tables because
   * most markdown parsers support inline formatting within table cells.
   */
  protected getTableEscapedText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\|/g, '&#124;');
  }

  /**
   * Writes a single TSDoc node to the output
   *
   * @param docNode - The TSDoc node to write
   * @param context - Emission context (writer, formatting state)
   * @param docNodeSiblings - Whether this node has siblings (used for formatting decisions)
   *
   * @remarks
   * This is the core dispatch method that handles all TSDoc node types:
   * - **PlainText** - Regular text content
   * - **HtmlStartTag/HtmlEndTag** - Raw HTML pass-through
   * - **CodeSpan** - Inline code (backticks)
   * - **LinkTag** - Links to code symbols or URLs
   * - **Paragraph** - Text blocks with spacing
   * - **FencedCode** - Code blocks with syntax highlighting
   * - **Section** - Logical grouping of content
   * - **SoftBreak** - Whitespace normalization
   * - **EscapedText** - Pre-escaped text
   * - **ErrorText** - Parser error recovery
   * - **InlineTag** - Ignored (handled elsewhere)
   * - **BlockTag** - Known tags skipped, unknown tags logged
   *
   * @virtual
   * Subclasses can override this to customize handling for specific node types.
   */
  protected writeNode(docNode: DocNode, context: IMarkdownEmitterContext, docNodeSiblings: boolean): void {
    const writer: IndentedWriter = context.writer;

    switch (docNode.kind) {
      case DocNodeKind.PlainText: {
        const docPlainText: DocPlainText = docNode as DocPlainText;
        this.writePlainText(docPlainText.text, context);
        break;
      }
      case DocNodeKind.HtmlStartTag:
      case DocNodeKind.HtmlEndTag: {
        const docHtmlTag: DocHtmlStartTag | DocHtmlEndTag = docNode as DocHtmlStartTag | DocHtmlEndTag;
        // write the HTML element verbatim into the output
        writer.write(docHtmlTag.emitAsHtml());
        break;
      }
      case DocNodeKind.CodeSpan: {
        const docCodeSpan: DocCodeSpan = docNode as DocCodeSpan;
        writer.write('`');
        writer.write(docCodeSpan.code);
        writer.write('`');
        break;
      }
      case DocNodeKind.LinkTag: {
        const docLinkTag: DocLinkTag = docNode as DocLinkTag;
        if (docLinkTag.codeDestination) {
          this.writeLinkTagWithCodeDestination(docLinkTag, context);
        } else if (docLinkTag.urlDestination) {
          this.writeLinkTagWithUrlDestination(docLinkTag, context);
        } else if (docLinkTag.linkText) {
          this.writePlainText(docLinkTag.linkText, context);
        }
        break;
      }
      case DocNodeKind.Paragraph: {
        const docParagraph: DocParagraph = docNode as DocParagraph;
        const trimmedParagraph: DocParagraph = DocNodeTransforms.trimSpacesInParagraph(docParagraph);

        this.writeNodes(trimmedParagraph.nodes, context);
        writer.ensureNewLine();
        writer.writeLine();
        break;
      }
      case DocNodeKind.FencedCode: {
        const docFencedCode: DocFencedCode = docNode as DocFencedCode;
        writer.ensureNewLine();
        writer.write('```');
        writer.write(docFencedCode.language);
        writer.writeLine();
        writer.write(docFencedCode.code);
        writer.ensureNewLine();
        writer.writeLine('```');
        break;
      }
      case DocNodeKind.Section: {
        const docSection: DocSection = docNode as DocSection;
        this.writeNodes(docSection.nodes, context);
        break;
      }
      case DocNodeKind.SoftBreak: {
        if (!/^\s?$/.test(writer.peekLastCharacter())) {
          writer.write(' ');
        }
        break;
      }
      case DocNodeKind.EscapedText: {
        const docEscapedText: DocEscapedText = docNode as DocEscapedText;
        this.writePlainText(docEscapedText.decodedText, context);
        break;
      }
      case DocNodeKind.ErrorText: {
        const docErrorText: DocErrorText = docNode as DocErrorText;
        this.writePlainText(docErrorText.text, context);
        break;
      }
      case DocNodeKind.InlineTag: {
        break;
      }
      case DocNodeKind.BlockTag: {
        const tagNode: DocBlockTag = docNode as DocBlockTag;
        // Skip known block tags that are handled elsewhere or don't need rendering
        if (!KNOWN_BLOCK_TAGS.includes(tagNode.tagName as (typeof KNOWN_BLOCK_TAGS)[number])) {
          debug.warn('Unsupported block tag: ' + tagNode.tagName);
        }
        break;
      }
      default:
        debug.debug(`BaseMarkdownEmitter.writeNode: Unsupported - ${docNode.kind}`);
        throw new InternalError('Unsupported DocNodeKind kind: ' + docNode.kind);
    }
  }

  /**
   * Writes a link tag that references a code symbol
   *
   * @param docLinkTag - The link tag node with a code destination
   * @param context - Emission context
   *
   * @remarks
   * This virtual method must be implemented by subclasses to handle code references
   * like `{@link MyClass}` or `{@link MyClass.method}`.
   *
   * The base class throws an error because code destination handling requires:
   * - Resolving the symbol to a file path
   * - Generating appropriate relative URLs
   * - Determining if the symbol exists in the current documentation set
   *
   * See `CustomMarkdownEmitter.writeLinkTagWithCodeDestination()` for an implementation.
   *
   * @virtual
   */
  protected writeLinkTagWithCodeDestination(docLinkTag: DocLinkTag, context: IMarkdownEmitterContext): void {
    // The subclass needs to implement this to support code destinations
    throw new InternalError('writeLinkTagWithCodeDestination()');
  }

  /**
   * Writes a link tag that references an external URL
   *
   * @param docLinkTag - The link tag node with a URL destination
   * @param context - Emission context
   *
   * @remarks
   * Handles external URL links like `{@link https://example.com}` or
   * `{@link https://example.com | Link Text}`.
   *
   * The link text is normalized (whitespace collapsed) and escaped for safe
   * markdown output. The URL is used as-is.
   *
   * Output format: `[Link Text](URL)`
   *
   * @virtual
   * Subclasses can override this to customize URL link rendering.
   */
  protected writeLinkTagWithUrlDestination(docLinkTag: DocLinkTag, context: IMarkdownEmitterContext): void {
    const linkText: string =
      docLinkTag.linkText !== undefined ? docLinkTag.linkText : docLinkTag.urlDestination!;

    const encodedLinkText: string = this.getEscapedText(linkText.replace(/\s+/g, ' '));

    context.writer.write('[');
    context.writer.write(encodedLinkText);
    context.writer.write(`](${docLinkTag.urlDestination!})`);
  }

  /**
   * Writes plain text with context-aware formatting
   *
   * @param text - The text to write
   * @param context - Emission context (includes bold/italic state)
   *
   * @remarks
   * This method handles the complex logic of inserting markdown formatting markers
   * (bold `**`, italic `_`) while avoiding ambiguous sequences.
   *
   * **Processing steps:**
   * 1. Split text into [leading whitespace, content, trailing whitespace]
   * 2. Write leading whitespace as-is
   * 3. Check if a separator is needed before formatting markers
   * 4. Apply bold/italic markers if requested
   * 5. Write escaped content
   * 6. Close bold/italic markers
   * 7. Write trailing whitespace as-is
   *
   * **Separator logic:**
   * When transitioning between formatted spans (e.g., `**bold***italic*`), we need
   * a zero-width separator to prevent parser ambiguity. The separator is inserted
   * unless the previous character is safe (empty, newline, space, `[`, or `>`).
   */
  protected writePlainText(text: string, context: IMarkdownEmitterContext): void {
    const writer: IndentedWriter = context.writer;

    // split out the [ leading whitespace, content, trailing whitespace ]
    const parts: string[] = text.match(/^(\s*)(.*?)(\s*)$/) || [];

    writer.write(parts[1]); // write leading whitespace

    const middle: string = parts[2];

    if (middle !== '') {
      const lastChar = writer.peekLastCharacter();

      // Check if we need a separator before formatting markers
      const isSafeChar = (SAFE_PRECEDING_CHARACTERS as readonly string[]).includes(lastChar);
      if (!isSafeChar) {
        // This is no problem:        "**one** *two* **three**"
        // But this is trouble:       "**one***two***three**"
        // The most general solution: "**one**{/* */}*two*{/* */}**three**"
        writer.write(MARKDOWN_SEPARATOR);
      }

      if (context.boldRequested) {
        writer.write('**');
      }
      if (context.italicRequested) {
        writer.write('_');
      }

      writer.write(this.getEscapedText(middle));

      if (context.italicRequested) {
        writer.write('_');
      }
      if (context.boldRequested) {
        writer.write('**');
      }
    }

    writer.write(parts[3]); // write trailing whitespace
  }

  /**
   * Writes multiple TSDoc nodes sequentially
   *
   * @param docNodes - Array of nodes to write
   * @param context - Emission context
   *
   * @remarks
   * This helper iterates through a node array and calls `writeNode()` for each.
   * The `docNodeSiblings` parameter passed to `writeNode()` is set based on
   * whether there are multiple nodes (used for formatting decisions).
   */
  protected writeNodes(docNodes: ReadonlyArray<DocNode>, context: IMarkdownEmitterContext): void {
    for (const docNode of docNodes) {
      this.writeNode(docNode, context, docNodes.length > 1);
    }
  }
}
