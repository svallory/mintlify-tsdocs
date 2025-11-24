import { type IDocNodeParameters, DocNode } from '@microsoft/tsdoc';
import { CustomDocNodeKind } from './CustomDocNodeKind';

/**
 * Constructor parameters for {@link DocHeading}.
 */
export interface IDocHeadingParameters extends IDocNodeParameters {
  title: string;
  level?: number;
}

/**
 * Represents a section header similar to an HTML `<h1>` or `<h2>` element.
 *
 * @remarks
 * Headings support levels 1-5, corresponding to markdown heading levels (# through #####).
 * Level 1 is the largest heading, level 5 is the smallest. If no level is specified,
 * defaults to level 1.
 *
 * @example
 * ```typescript
 * // H1 heading (default)
 * const h1 = new DocHeading({
 *   configuration,
 *   title: 'API Reference'
 * });
 *
 * // H2 heading
 * const h2 = new DocHeading({
 *   configuration,
 *   title: 'Methods',
 *   level: 2
 * });
 * ```
 *
 * @see /architecture/ast-nodes-layer - Custom AST nodes architecture
 */
export class DocHeading extends DocNode {
  public readonly title: string;
  public readonly level: number;

  /**
   * Constructs a new DocHeading.
   *
   * @param parameters - Configuration including title and optional level (1-5)
   * @throws Error if level is not between 1 and 5
   */
  public constructor(parameters: IDocHeadingParameters) {
    super(parameters);
    this.title = parameters.title;
    this.level = parameters.level !== undefined ? parameters.level : 1;

    if (this.level < 1 || this.level > 5) {
      throw new Error('IDocHeadingParameters.level must be a number between 1 and 5');
    }
  }

  /** @override */
  public get kind(): string {
    return CustomDocNodeKind.Heading;
  }
}
