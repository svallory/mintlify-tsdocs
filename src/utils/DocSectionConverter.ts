/**
 * Converts TSDoc DocSection nodes to segments for template rendering
 * Preserves TSDoc node structure while allowing flexible template rendering
 */

import {
  DocNode,
  DocNodeKind,
  DocSection,
  DocParagraph,
  DocPlainText,
  DocLinkTag,
  DocCodeSpan,
  DocSoftBreak,
  DocFencedCode
} from '@microsoft/tsdoc';
import { DocumentationHelper } from './DocumentationHelper';

/**
 * Represents a segment from a TSDoc document
 * @public
 */
export interface DocSegment {
  /**
   * TSDoc node kind - aligns with TSDoc's DocNodeKind
   */
  kind: DocNodeKind | string;

  /**
   * Node-specific properties
   */
  props: Record<string, any>;
}

/**
 * Configuration for DocSection conversion
 */
export interface DocSectionConverterOptions {
  /**
   * Whether to flatten paragraphs into inline segments (default: true)
   */
  flattenParagraphs?: boolean;

  /**
   * Whether to preserve code blocks as segments (default: true)
   */
  preserveCodeBlocks?: boolean;

  /**
   * Whether to convert soft breaks to spaces (default: true)
   */
  convertSoftBreaks?: boolean;
}

/**
 * Converts TSDoc DocSection to segments for template rendering
 * @public
 */
export class DocSectionConverter {
  private readonly _documentationHelper: DocumentationHelper;
  private readonly _options: Required<DocSectionConverterOptions>;

  constructor(options: DocSectionConverterOptions = {}) {
    this._documentationHelper = new DocumentationHelper();
    this._options = {
      flattenParagraphs: true,
      preserveCodeBlocks: true,
      convertSoftBreaks: true,
      ...options
    };
  }

  /**
   * Convert a DocSection to an array of segments
   */
  public convertSection(docSection: DocSection | undefined): DocSegment[] {
    if (!docSection) {
      return [];
    }

    const segments: DocSegment[] = [];

    for (const childNode of docSection.getChildNodes()) {
      segments.push(...this._convertNode(childNode));
    }

    return segments;
  }

  /**
   * Convert a single DocNode to segments
   */
  private _convertNode(docNode: DocNode): DocSegment[] {
    const segments: DocSegment[] = [];

    switch (docNode.kind) {
      case DocNodeKind.PlainText:
        segments.push(this._convertPlainText(docNode as DocPlainText));
        break;

      case DocNodeKind.LinkTag:
        segments.push(this._convertLinkTag(docNode as DocLinkTag));
        break;

      case DocNodeKind.CodeSpan:
        segments.push(this._convertCodeSpan(docNode as DocCodeSpan));
        break;

      case DocNodeKind.FencedCode:
        if (this._options.preserveCodeBlocks) {
          segments.push(this._convertFencedCode(docNode as DocFencedCode));
        }
        break;

      case DocNodeKind.SoftBreak:
        if (this._options.convertSoftBreaks) {
          segments.push({
            kind: 'PlainText',
            props: { text: ' ' }
          });
        }
        break;

      case DocNodeKind.Paragraph:
        if (this._options.flattenParagraphs) {
          // Flatten paragraph into inline segments
          const paragraph = docNode as DocParagraph;
          for (const childNode of paragraph.getChildNodes()) {
            segments.push(...this._convertNode(childNode));
          }
        } else {
          // Keep paragraph as a container
          const childSegments: DocSegment[] = [];
          const paragraph = docNode as DocParagraph;
          for (const childNode of paragraph.getChildNodes()) {
            childSegments.push(...this._convertNode(childNode));
          }
          segments.push({
            kind: 'Paragraph',
            props: { segments: childSegments }
          });
        }
        break;

      case DocNodeKind.Section:
        // Recursively process sections
        const section = docNode as DocSection;
        for (const childNode of section.getChildNodes()) {
          segments.push(...this._convertNode(childNode));
        }
        break;

      default:
        // For unsupported node types, convert children recursively
        if (docNode.getChildNodes) {
          for (const childNode of docNode.getChildNodes()) {
            segments.push(...this._convertNode(childNode));
          }
        }
        break;
    }

    return segments;
  }

  private _convertPlainText(docPlainText: DocPlainText): DocSegment {
    return {
      kind: DocNodeKind.PlainText,
      props: {
        text: docPlainText.text
      }
    };
  }

  private _convertLinkTag(docLinkTag: DocLinkTag): DocSegment {
    const props: Record<string, any> = {};

    if (docLinkTag.urlDestination) {
      props.urlDestination = docLinkTag.urlDestination;
    }

    if (docLinkTag.codeDestination) {
      props.codeDestination = docLinkTag.codeDestination;
    }

    if (docLinkTag.linkText) {
      props.linkText = docLinkTag.linkText;
    }

    return {
      kind: DocNodeKind.LinkTag,
      props
    };
  }

  private _convertCodeSpan(docCodeSpan: DocCodeSpan): DocSegment {
    return {
      kind: DocNodeKind.CodeSpan,
      props: {
        code: docCodeSpan.code
      }
    };
  }

  private _convertFencedCode(docFencedCode: DocFencedCode): DocSegment {
    return {
      kind: DocNodeKind.FencedCode,
      props: {
        language: docFencedCode.language,
        code: docFencedCode.code
      }
    };
  }

  /**
   * Check if a link destination is a page link (starts with /)
   */
  public static isPageLink(destination: string): boolean {
    return destination.startsWith('/');
  }

  /**
   * Check if a link destination is an API reference
   */
  public static isApiReferenceLink(destination: string): boolean {
    // API references typically don't start with / and aren't URLs
    return !destination.startsWith('/') &&
           !destination.startsWith('http://') &&
           !destination.startsWith('https://');
  }

  /**
   * Render segments to plain text (for debugging/fallback)
   */
  public static renderPlainText(segments: DocSegment[]): string {
    return segments
      .map(segment => {
        switch (segment.kind) {
          case DocNodeKind.PlainText:
            return segment.props.text;
          case DocNodeKind.LinkTag:
            return segment.props.linkText || segment.props.urlDestination || 'link';
          case DocNodeKind.CodeSpan:
            return `\`${segment.props.code}\``;
          default:
            return '';
        }
      })
      .join('');
  }
}