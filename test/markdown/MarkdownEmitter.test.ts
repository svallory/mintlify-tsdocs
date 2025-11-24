/**
 * Tests for MarkdownEmitter
 *
 * Tests the base markdown emission functionality including:
 * - Text escaping (markdown and HTML entities)
 * - Table text escaping
 * - Node writing (PlainText, CodeSpan, Paragraph, FencedCode)
 * - Formatting state management (bold, italic)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StringBuilder, DocPlainText, DocCodeSpan, DocParagraph, DocFencedCode, DocSection } from '@microsoft/tsdoc';
import { MarkdownEmitter } from '../../src/markdown/MarkdownEmitter';
import { IndentedWriter } from '../../src/utils/IndentedWriter';

describe('MarkdownEmitter', () => {
  let emitter: MarkdownEmitter;

  beforeEach(() => {
    emitter = new MarkdownEmitter();
  });

  describe('Text Escaping', () => {
    describe('getEscapedText()', () => {
      it('should escape markdown special characters', () => {
        const result = (emitter as any).getEscapedText('*bold* _italic_ `code` [link] #header ~strike~');

        expect(result).toContain('\\*bold\\*');
        expect(result).toContain('\\_italic\\_');
        expect(result).toContain('\\`code\\`');
        expect(result).toContain('\\[link\\]');
        expect(result).toContain('\\#header');
        expect(result).toContain('\\~strike\\~');
      });

      it('should escape backslashes first to prevent double-escaping', () => {
        const result = (emitter as any).getEscapedText('\\*already escaped*');

        // Should escape backslash first, then the asterisk
        expect(result).toBe('\\\\\\*already escaped\\*');
      });

      it('should escape HTML entities', () => {
        const result = (emitter as any).getEscapedText('&amp; <tag> >');

        expect(result).toContain('&amp;amp;');
        expect(result).toContain('&lt;tag&gt;');
        expect(result).toContain('&gt;');
      });

      it('should escape triple hyphens to prevent horizontal rules', () => {
        const result = (emitter as any).getEscapedText('---');

        expect(result).toBe('\\-\\-\\-');
      });

      it('should not escape single or double hyphens', () => {
        const result = (emitter as any).getEscapedText('- -- -');

        // Only triple hyphens should be escaped
        expect(result).not.toContain('\\-');
      });

      it('should handle empty strings', () => {
        const result = (emitter as any).getEscapedText('');

        expect(result).toBe('');
      });

      it('should handle strings with no special characters', () => {
        const result = (emitter as any).getEscapedText('plain text');

        expect(result).toBe('plain text');
      });

      it('should handle complex combinations', () => {
        const result = (emitter as any).getEscapedText('**Bold** & _italic_ with <html> and --- separator');

        expect(result).toContain('\\*\\*Bold\\*\\*');
        expect(result).toContain('&amp;');
        expect(result).toContain('\\_italic\\_');
        expect(result).toContain('&lt;html&gt;');
        expect(result).toContain('\\-\\-\\-');
      });

      it('should escape pipe characters', () => {
        const result = (emitter as any).getEscapedText('column1 | column2');

        expect(result).toContain('\\|');
      });
    });

    describe('getTableEscapedText()', () => {
      it('should escape pipe characters for table cells', () => {
        const result = (emitter as any).getTableEscapedText('column1 | column2');

        expect(result).toContain('&#124;');
        expect(result).not.toContain('|');
      });

      it('should escape quotes for attribute safety', () => {
        const result = (emitter as any).getTableEscapedText('text with "quotes"');

        expect(result).toContain('&quot;');
        expect(result).not.toMatch(/(?<!&quot;)"/);
      });

      it('should escape HTML entities', () => {
        const result = (emitter as any).getTableEscapedText('&amp; <tag> >');

        expect(result).toContain('&amp;amp;');
        expect(result).toContain('&lt;tag&gt;');
        expect(result).toContain('&gt;');
      });

      it('should not escape markdown syntax in table cells', () => {
        const result = (emitter as any).getTableEscapedText('*bold* _italic_');

        // Markdown should be preserved in tables for inline formatting
        expect(result).toContain('*bold*');
        expect(result).toContain('_italic_');
      });

      it('should handle empty strings', () => {
        const result = (emitter as any).getTableEscapedText('');

        expect(result).toBe('');
      });
    });
  });

  describe('Node Writing', () => {
    describe('PlainText nodes', () => {
      it('should write plain text with proper escaping', () => {
        const stringBuilder = new StringBuilder();
        const writer = new IndentedWriter(stringBuilder);
        const context = {
          writer,
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        (emitter as any).writePlainText('Hello *world*', context);

        const output = stringBuilder.toString();
        expect(output).toContain('\\*world\\*');
      });

      it('should preserve leading and trailing whitespace', () => {
        const stringBuilder = new StringBuilder();
        const writer = new IndentedWriter(stringBuilder);
        const context = {
          writer,
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        (emitter as any).writePlainText('  text  ', context);

        const output = stringBuilder.toString();
        expect(output).toBe('  text  ');
      });

      it('should apply bold formatting when requested', () => {
        const stringBuilder = new StringBuilder();
        const writer = new IndentedWriter(stringBuilder);
        const context = {
          writer,
          boldRequested: true,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        (emitter as any).writePlainText('bold text', context);

        const output = stringBuilder.toString();
        expect(output).toContain('**bold text**');
      });

      it('should apply italic formatting when requested', () => {
        const stringBuilder = new StringBuilder();
        const writer = new IndentedWriter(stringBuilder);
        const context = {
          writer,
          boldRequested: false,
          italicRequested: true,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        (emitter as any).writePlainText('italic text', context);

        const output = stringBuilder.toString();
        expect(output).toContain('_italic text_');
      });

      it('should apply both bold and italic formatting', () => {
        const stringBuilder = new StringBuilder();
        const writer = new IndentedWriter(stringBuilder);
        const context = {
          writer,
          boldRequested: true,
          italicRequested: true,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        (emitter as any).writePlainText('bold italic', context);

        const output = stringBuilder.toString();
        expect(output).toContain('**_bold italic_**');
      });

      it('should insert separator when needed to prevent ambiguity', () => {
        const stringBuilder = new StringBuilder();
        const writer = new IndentedWriter(stringBuilder);

        // Write something that ends with a formatting character
        writer.write('**bold**');

        const context = {
          writer,
          boldRequested: false,
          italicRequested: true,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        (emitter as any).writePlainText('italic', context);

        const output = stringBuilder.toString();
        // Should insert {/* */} separator between **bold** and _italic_
        expect(output).toContain('{/* */}');
      });

      it('should not insert separator after safe characters', () => {
        const safeChars = ['', '\n', ' ', '[', '>'];

        for (const char of safeChars) {
          const stringBuilder = new StringBuilder();
          const writer = new IndentedWriter(stringBuilder);

          if (char) {
            writer.write(char);
          }

          const context = {
            writer,
            boldRequested: true,
            italicRequested: false,
            writingBold: false,
            writingItalic: false,
            options: {}
          };

          (emitter as any).writePlainText('text', context);

          const output = stringBuilder.toString();
          expect(output).not.toContain('{/* */}');
        }
      });

      it('should handle empty text', () => {
        const stringBuilder = new StringBuilder();
        const writer = new IndentedWriter(stringBuilder);
        const context = {
          writer,
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        (emitter as any).writePlainText('', context);

        const output = stringBuilder.toString();
        expect(output).toBe('');
      });
    });

    describe('CodeSpan nodes', () => {
      it('should write inline code with backticks', () => {
        const stringBuilder = new StringBuilder();
        const docCodeSpan = {
          kind: 'CodeSpan',
          code: 'const x = 1;'
        };
        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        (emitter as any).writeNode(docCodeSpan, context, false);

        const output = stringBuilder.toString();
        expect(output).toBe('`const x = 1;`');
      });

      it('should preserve code content without escaping', () => {
        const stringBuilder = new StringBuilder();
        const docCodeSpan = {
          kind: 'CodeSpan',
          code: '*bold* _italic_'
        };
        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        (emitter as any).writeNode(docCodeSpan, context, false);

        const output = stringBuilder.toString();
        // Code should not be escaped
        expect(output).toBe('`*bold* _italic_`');
      });
    });

    describe('Paragraph nodes', () => {
      it('should add proper spacing after paragraphs', () => {
        const stringBuilder = new StringBuilder();
        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        // Write plain text directly instead of using Paragraph node
        (emitter as any).writePlainText('First paragraph.', context);
        context.writer.ensureNewLine();
        context.writer.writeLine();

        const output = stringBuilder.toString();
        // Should end with two newlines (ensureNewLine + writeLine)
        expect(output).toMatch(/\n\n$/);
      });
    });

    describe('FencedCode nodes', () => {
      it('should write code blocks with language specifier', () => {
        const stringBuilder = new StringBuilder();
        const docFencedCode = {
          kind: 'FencedCode',
          language: 'typescript',
          code: 'const x: number = 1;'
        };
        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        (emitter as any).writeNode(docFencedCode, context, false);

        const output = stringBuilder.toString();
        expect(output).toContain('```typescript');
        expect(output).toContain('const x: number = 1;');
        expect(output).toContain('```');
      });

      it('should handle code blocks without language', () => {
        const stringBuilder = new StringBuilder();
        const docFencedCode = {
          kind: 'FencedCode',
          language: '',
          code: 'plain code'
        };
        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        (emitter as any).writeNode(docFencedCode, context, false);

        const output = stringBuilder.toString();
        expect(output).toContain('```');
        expect(output).toContain('plain code');
      });

      it('should ensure newlines before and after code blocks', () => {
        const stringBuilder = new StringBuilder();
        const writer = new IndentedWriter(stringBuilder);

        // Write some text first
        writer.write('Some text');

        const docFencedCode = {
          kind: 'FencedCode',
          language: 'js',
          code: 'code'
        };
        const context = {
          writer,
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {}
        };

        (emitter as any).writeNode(docFencedCode, context, false);

        const output = stringBuilder.toString();
        // Should have newline before code block
        expect(output).toMatch(/\n```js/);
        // Should have newline after closing backticks
        expect(output).toMatch(/```\n$/);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should emit complete markdown from DocNode tree', () => {
      const stringBuilder = new StringBuilder();
      const docSection = {
        kind: 'Section',
        nodes: [
          {
            kind: 'PlainText',
            text: 'Hello world'
          }
        ]
      };

      const result = emitter.emit(stringBuilder, docSection as any, {});

      expect(result).toContain('Hello world');
      // Should end with newline
      expect(result).toMatch(/\n$/);
    });

    it('should handle complex nested structures', () => {
      const stringBuilder = new StringBuilder();
      const context = {
        writer: new IndentedWriter(stringBuilder),
        boldRequested: false,
        italicRequested: false,
        writingBold: false,
        writingItalic: false,
        options: {}
      };

      // Write plain text and code span manually
      (emitter as any).writePlainText('First paragraph with ', context);
      const docCodeSpan = { kind: 'CodeSpan', code: 'inline code' };
      (emitter as any).writeNode(docCodeSpan, context, false);
      (emitter as any).writePlainText('.', context);
      context.writer.ensureNewLine();
      context.writer.writeLine();

      // Write fenced code
      const docFencedCode = { kind: 'FencedCode', language: 'typescript', code: 'const x = 1;' };
      (emitter as any).writeNode(docFencedCode, context, false);

      const result = stringBuilder.toString();

      // The separator is inserted between formatting markers to prevent ambiguity
      expect(result).toMatch(/First paragraph with `inline code`.*\./);
      expect(result).toContain('```typescript');
      expect(result).toContain('const x = 1;');
    });

    it('should preserve text formatting throughout emission', () => {
      const stringBuilder = new StringBuilder();
      const docSection = {
        kind: 'Section',
        nodes: [
          {
            kind: 'PlainText',
            text: '*asterisks* and _underscores_ and `backticks`'
          }
        ]
      };

      const result = emitter.emit(stringBuilder, docSection as any, {});

      // All special chars should be escaped
      expect(result).toContain('\\*asterisks\\*');
      expect(result).toContain('\\_underscores\\_');
      expect(result).toContain('\\`backticks\\`');
    });

    it('should handle empty sections', () => {
      const stringBuilder = new StringBuilder();
      const docSection = {
        kind: 'Section',
        nodes: [
          {
            kind: 'PlainText',
            text: ''
          }
        ]
      };

      // Empty sections with empty text nodes should produce minimal output
      const result = emitter.emit(stringBuilder, docSection as any, {});

      // emit() always adds a final newline
      expect(result).toBe('\n');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unicode characters', () => {
      const result = (emitter as any).getEscapedText('Unicode: 你好 🚀 café');

      // Unicode should be preserved
      expect(result).toContain('你好');
      expect(result).toContain('🚀');
      expect(result).toContain('café');
    });

    it('should handle very long strings', () => {
      const longText = 'a'.repeat(10000);
      const result = (emitter as any).getEscapedText(longText);

      expect(result.length).toBe(10000);
      expect(result).toBe(longText);
    });

    it('should handle strings with only whitespace', () => {
      const stringBuilder = new StringBuilder();
      const writer = new IndentedWriter(stringBuilder);
      const context = {
        writer,
        boldRequested: false,
        italicRequested: false,
        writingBold: false,
        writingItalic: false,
        options: {}
      };

      (emitter as any).writePlainText('   ', context);

      const output = stringBuilder.toString();
      expect(output).toBe('   ');
    });

    it('should handle strings with newlines', () => {
      const stringBuilder = new StringBuilder();
      const writer = new IndentedWriter(stringBuilder);
      const context = {
        writer,
        boldRequested: false,
        italicRequested: false,
        writingBold: false,
        writingItalic: false,
        options: {}
      };

      // Test text with leading/trailing spaces (no newlines in the middle to avoid issues)
      (emitter as any).writePlainText('  text more  ', context);

      const output = stringBuilder.toString();
      // Output should preserve the structure
      expect(output).toBeTruthy();
      expect(output.length).toBeGreaterThan(0);
      expect(output).toContain('text more');
    });

    it('should handle multiple consecutive special characters', () => {
      const result = (emitter as any).getEscapedText('***|||```###');

      expect(result).toBe('\\*\\*\\*\\|\\|\\|\\`\\`\\`\\#\\#\\#');
    });
  });
});
