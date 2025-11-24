import { DocNode, DocSection, TSDocConfiguration } from '@microsoft/tsdoc';
import { CustomDocNodeKind } from './CustomDocNodeKind';

/**
 * Represents an Expandable component for Mintlify documentation.
 * Renders as: <Expandable title="...">...</Expandable>
 *
 * @remarks
 * Expandable sections create collapsible content areas in the documentation.
 * The title is always visible, while the content can be expanded/collapsed by users.
 * If no title is provided, defaults to "Details".
 *
 * @example
 * ```typescript
 * const expandable = new DocExpandable({
 *   configuration,
 *   content: new DocSection({ configuration })
 * }, 'Advanced Options');
 * ```
 *
 * @see /architecture/ast-nodes-layer - Custom AST nodes architecture
 */
export class DocExpandable extends DocNode {
  public readonly title: string;
  public readonly content: DocSection;

  public constructor(
    parameters: {
      configuration: TSDocConfiguration;
      content?: DocSection;
    },
    title: string = 'Details'
  ) {
    super(parameters);

    if (!title || title.trim() === '') {
      throw new Error('Expandable title cannot be empty');
    }

    this.title = title;
    this.content = parameters.content || new DocSection({ configuration: this.configuration });
  }

  /** @override */
  public get kind(): string {
    return CustomDocNodeKind.Expandable;
  }

  /** @override */
  public getChildNodes(): ReadonlyArray<DocNode> {
    return [this.content];
  }
}