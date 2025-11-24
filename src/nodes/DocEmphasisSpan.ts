import { type DocNode, DocNodeContainer, type IDocNodeContainerParameters } from '@microsoft/tsdoc';
import { CustomDocNodeKind } from './CustomDocNodeKind';

/**
 * Constructor parameters for {@link DocEmphasisSpan}.
 */
export interface IDocEmphasisSpanParameters extends IDocNodeContainerParameters {
  bold?: boolean;
  italic?: boolean;
}

/**
 * Represents a span of text that is styled with CommonMark emphasis (italics), strong emphasis (boldface),
 * or both.
 *
 * @remarks
 * This node can contain PlainText and SoftBreak nodes. The text content is rendered with markdown
 * emphasis markers: `*italic*` for italic, `**bold**` for bold, or `***bold italic***` for both.
 *
 * @example
 * ```typescript
 * // Bold text
 * const bold = new DocEmphasisSpan({
 *   configuration,
 *   bold: true
 * }, [new DocPlainText({ configuration, text: 'Important' })]);
 *
 * // Italic text
 * const italic = new DocEmphasisSpan({
 *   configuration,
 *   italic: true
 * }, [new DocPlainText({ configuration, text: 'Emphasis' })]);
 *
 * // Bold and italic
 * const both = new DocEmphasisSpan({
 *   configuration,
 *   bold: true,
 *   italic: true
 * }, [new DocPlainText({ configuration, text: 'Very Important' })]);
 * ```
 *
 * @see /architecture/ast-nodes-layer - Custom AST nodes architecture
 */
export class DocEmphasisSpan extends DocNodeContainer {
  public readonly bold: boolean;
  public readonly italic: boolean;

  public constructor(parameters: IDocEmphasisSpanParameters, children?: DocNode[]) {
    super(parameters, children);
    this.bold = !!parameters.bold;
    this.italic = !!parameters.italic;
  }

  /** @override */
  public get kind(): string {
    return CustomDocNodeKind.EmphasisSpan;
  }
}
