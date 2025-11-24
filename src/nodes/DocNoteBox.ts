import { type IDocNodeParameters, DocNode, DocSection } from '@microsoft/tsdoc';
import { CustomDocNodeKind } from './CustomDocNodeKind';

/**
 * Constructor parameters for {@link DocNoteBox}.
 */
export interface IDocNoteBoxParameters extends IDocNodeParameters {}

/**
 * Represents a note box, which is typically displayed as a bordered box containing informational text.
 *
 * @remarks
 * Note boxes are rendered as Mintlify `<Note>` components, which provide visual emphasis for
 * important information, warnings, tips, or other callout content. The content can include
 * any section-level nodes like paragraphs, code blocks, and lists.
 *
 * @example
 * ```typescript
 * const note = new DocNoteBox({
 *   configuration
 * }, [
 *   new DocParagraph({ configuration }, [
 *     new DocPlainText({ configuration, text: 'This is an important note.' })
 *   ])
 * ]);
 * ```
 *
 * @see /architecture/ast-nodes-layer - Custom AST nodes architecture
 */
export class DocNoteBox extends DocNode {
  public readonly content: DocSection;

  public constructor(parameters: IDocNoteBoxParameters, sectionChildNodes?: ReadonlyArray<DocNode>) {
    super(parameters);
    this.content = new DocSection({ configuration: this.configuration }, sectionChildNodes);
  }

  /** @override */
  public get kind(): string {
    return CustomDocNodeKind.NoteBox;
  }

  /** @override */
  protected onGetChildNodes(): ReadonlyArray<DocNode | undefined> {
    return [this.content];
  }
}
