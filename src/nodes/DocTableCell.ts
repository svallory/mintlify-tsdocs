import { type IDocNodeParameters, DocNode, DocSection } from '@microsoft/tsdoc';
import { CustomDocNodeKind } from './CustomDocNodeKind';

/**
 * Constructor parameters for {@link DocTableCell}.
 */
export interface IDocTableCellParameters extends IDocNodeParameters {}

/**
 * Represents table cell, similar to an HTML `<td>` element.
 *
 * @remarks
 * Table cells contain a DocSection that can hold any section-level content including
 * paragraphs, code blocks, and lists. In most cases, cells contain simple text content,
 * but they can also contain complex formatted content.
 *
 * @example
 * ```typescript
 * // Empty cell (content added later)
 * const cell = new DocTableCell({ configuration });
 *
 * // Cell with initial content
 * const cell2 = new DocTableCell({ configuration }, [
 *   new DocParagraph({ configuration }, [
 *     new DocPlainText({ configuration, text: 'Cell content' })
 *   ])
 * ]);
 * ```
 *
 * @see /architecture/ast-nodes-layer - Custom AST nodes architecture
 */
export class DocTableCell extends DocNode {
  public readonly content: DocSection;

  public constructor(parameters: IDocTableCellParameters, sectionChildNodes?: ReadonlyArray<DocNode>) {
    super(parameters);

    this.content = new DocSection({ configuration: this.configuration }, sectionChildNodes);
  }

  /** @override */
  public get kind(): string {
    return CustomDocNodeKind.TableCell;
  }
}
