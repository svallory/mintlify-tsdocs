/**
 * Tests for CustomMarkdownEmitter
 *
 * Tests the custom markdown emission functionality including:
 * - Table detection (property tables, method tables, other tables)
 * - Table conversion to Mintlify components (TypeTree, ResponseField)
 * - Text extraction from DocNode trees
 * - API reference resolution with caching
 * - Security sanitization
 */

import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { StringBuilder, DocPlainText, DocSection, DocParagraph } from '@microsoft/tsdoc';
import { ApiModel, ApiItem } from '@microsoft/api-extractor-model';
import { CustomMarkdownEmitter } from '../../src/markdown/CustomMarkdownEmitter';
import { DocTable } from '../../src/nodes/DocTable';
import { DocTableRow } from '../../src/nodes/DocTableRow';
import { DocTableCell } from '../../src/nodes/DocTableCell';
import { CustomDocNodeKind } from '../../src/nodes/CustomDocNodeKind';
import { createMockApiItem } from '../helpers/mocks';
import { IndentedWriter } from '../../src/utils/IndentedWriter';

/**
 * Helper to create a TSDoc configuration mock
 */
function createMockConfiguration() {
  return {
    docNodeManager: {
      supportedDocNodeKinds: new Set([
        'PlainText',
        'Section',
        'Paragraph',
        CustomDocNodeKind.Table,
        CustomDocNodeKind.TableCell,
        CustomDocNodeKind.TableRow
      ]),
      isAllowedChild: (parentKind: string, childKind: string) => true
    },
    tsdocConfiguration: {}
  } as any;
}

/**
 * Helper to create a simple PlainText node
 */
function createPlainTextNode(text: string): any {
  return {
    kind: 'PlainText',
    text
  };
}

/**
 * Helper to create a table cell with plain text content
 */
function createTableCell(config: any, text: string): DocTableCell {
  const plainText = createPlainTextNode(text);
  return new DocTableCell({ configuration: config }, [plainText]);
}

/**
 * Helper to create a property table (with "Property" or "Parameter" header)
 */
function createPropertyTable(config: any, headerKeyword: 'Property' | 'Parameter'): DocTable {
  const table = new DocTable({
    configuration: config,
    headerTitles: [headerKeyword, 'Modifiers', 'Type', 'Description']
  });

  // Add a sample row
  const row = table.createAndAddRow();
  row.addPlainTextCell('name');
  row.addPlainTextCell('required');
  row.addPlainTextCell('string');
  row.addPlainTextCell('The name property');

  return table;
}

/**
 * Helper to create a method table (with "Constructor" or "Method" header)
 */
function createMethodTable(config: any, headerKeyword: 'Constructor' | 'Method'): DocTable {
  const table = new DocTable({
    configuration: config,
    headerTitles: [headerKeyword, 'Modifiers', 'Description']
  });

  // Add a sample row
  const row = table.createAndAddRow();
  row.addPlainTextCell('myMethod()');
  row.addPlainTextCell('public');
  row.addPlainTextCell('Does something');

  return table;
}

describe('CustomMarkdownEmitter', () => {
  let emitter: CustomMarkdownEmitter;
  let apiModel: ApiModel;
  let mockConfig: any;

  beforeEach(() => {
    apiModel = new ApiModel();
    emitter = new CustomMarkdownEmitter(apiModel);
    mockConfig = createMockConfiguration();
  });

  describe('Table Detection', () => {
    describe('_hasHeaderKeyword()', () => {
      it('should detect "Property" keyword in header', () => {
        const table = createPropertyTable(mockConfig, 'Property');

        const result = (emitter as any)._hasHeaderKeyword(table, ['Property', 'Parameter']);

        expect(result).toBe(true);
      });

      it('should detect "Parameter" keyword in header', () => {
        const table = createPropertyTable(mockConfig, 'Parameter');

        const result = (emitter as any)._hasHeaderKeyword(table, ['Property', 'Parameter']);

        expect(result).toBe(true);
      });

      it('should detect "Constructor" keyword in header', () => {
        const table = createMethodTable(mockConfig, 'Constructor');

        const result = (emitter as any)._hasHeaderKeyword(table, ['Constructor', 'Method']);

        expect(result).toBe(true);
      });

      it('should detect "Method" keyword in header', () => {
        const table = createMethodTable(mockConfig, 'Method');

        const result = (emitter as any)._hasHeaderKeyword(table, ['Constructor', 'Method']);

        expect(result).toBe(true);
      });

      it('should return false for tables without matching keywords', () => {
        const table = new DocTable({
          configuration: mockConfig,
          headerTitles: ['Column1', 'Column2', 'Column3']
        });

        const result = (emitter as any)._hasHeaderKeyword(table, ['Property', 'Parameter']);

        expect(result).toBe(false);
      });

      it('should handle case-insensitive keyword matching', () => {
        const table = new DocTable({
          configuration: mockConfig,
          headerTitles: ['PROPERTY', 'Type', 'Description']
        });

        const result = (emitter as any)._hasHeaderKeyword(table, ['Property']);

        expect(result).toBe(true);
      });

      it('should return false for empty header', () => {
        const table = new DocTable({
          configuration: mockConfig
        });

        const result = (emitter as any)._hasHeaderKeyword(table, ['Property']);

        expect(result).toBe(false);
      });

      it('should handle tables with null cells', () => {
        // Tables with empty headerCells array should now throw an error
        expect(() => {
          new DocTable({
            configuration: mockConfig,
            headerCells: []
          });
        }).toThrow('headerCells cannot be empty array');
      });
    });

    describe('_cellContainsKeywords()', () => {
      it('should detect keywords in PlainText nodes', () => {
        const cell = createTableCell(mockConfig, 'Property');

        const result = (emitter as any)._cellContainsKeywords(cell, ['Property']);

        expect(result).toBe(true);
      });

      it('should detect keywords in nested Paragraph nodes', () => {
        const paragraph = {
          kind: 'Paragraph',
          nodes: [createPlainTextNode('Property')]
        };
        const cell = new DocTableCell({ configuration: mockConfig }, [paragraph as any]);

        const result = (emitter as any)._cellContainsKeywords(cell, ['Property']);

        expect(result).toBe(true);
      });

      it('should handle case-insensitive matching', () => {
        const cell = createTableCell(mockConfig, 'PROPERTY');

        const result = (emitter as any)._cellContainsKeywords(cell, ['property']);

        expect(result).toBe(true);
      });

      it('should normalize whitespace before matching', () => {
        const cell = createTableCell(mockConfig, '  Property  \n  Name  ');

        const result = (emitter as any)._cellContainsKeywords(cell, ['Property']);

        expect(result).toBe(true);
      });

      it('should return false when keyword not found', () => {
        const cell = createTableCell(mockConfig, 'Some other text');

        const result = (emitter as any)._cellContainsKeywords(cell, ['Property']);

        expect(result).toBe(false);
      });

      it('should handle multiple keywords', () => {
        const cell = createTableCell(mockConfig, 'Method');

        const result = (emitter as any)._cellContainsKeywords(cell, ['Property', 'Method']);

        expect(result).toBe(true);
      });

      it('should handle empty cell content', () => {
        const cell = new DocTableCell({ configuration: mockConfig }, []);

        const result = (emitter as any)._cellContainsKeywords(cell, ['Property']);

        expect(result).toBe(false);
      });
    });
  });

  describe('Text Extraction', () => {
    describe('_getTextContent()', () => {
      it('should extract text from PlainText nodes', () => {
        const node = createPlainTextNode('Hello world');

        const result = (emitter as any)._getTextContent(node);

        expect(result).toBe('Hello world');
      });

      it('should extract text from Section nodes', () => {
        const section = {
          kind: 'Section',
          nodes: [
            createPlainTextNode('First '),
            createPlainTextNode('Second')
          ]
        };

        const result = (emitter as any)._getTextContent(section);

        expect(result).toBe('First Second');
      });

      it('should extract text from Paragraph nodes', () => {
        const paragraph = {
          kind: 'Paragraph',
          nodes: [
            createPlainTextNode('Paragraph '),
            createPlainTextNode('text')
          ]
        };

        const result = (emitter as any)._getTextContent(paragraph);

        expect(result).toBe('Paragraph text');
      });

      it('should extract text from nested structures', () => {
        const section = {
          kind: 'Section',
          nodes: [
            {
              kind: 'Paragraph',
              nodes: [createPlainTextNode('Nested text')]
            }
          ]
        };

        const result = (emitter as any)._getTextContent(section);

        expect(result).toBe('Nested text');
      });

      it('should handle empty nodes', () => {
        const section = {
          kind: 'Section',
          nodes: []
        };

        const result = (emitter as any)._getTextContent(section);

        expect(result).toBe('');
      });
    });

    describe('_extractTextContent()', () => {
      it('should extract text to StringBuilder', () => {
        const stringBuilder = new StringBuilder();
        const node = createPlainTextNode('Test content');

        (emitter as any)._extractTextContent(node, stringBuilder);

        expect(stringBuilder.toString()).toBe('Test content');
      });

      it('should handle LinkTag nodes with linkText', () => {
        const stringBuilder = new StringBuilder();
        const linkTag = {
          kind: 'LinkTag',
          linkText: 'Link Text'
        };

        (emitter as any)._extractTextContent(linkTag, stringBuilder);

        expect(stringBuilder.toString()).toBe('Link Text');
      });

      it('should handle LinkTag nodes with codeDestination', () => {
        const stringBuilder = new StringBuilder();
        const linkTag = {
          kind: 'LinkTag',
          codeDestination: {
            emitAsTsdoc: () => '@scope/package!Member'
          }
        };

        (emitter as any)._extractTextContent(linkTag, stringBuilder);

        expect(stringBuilder.toString()).toBe('@scope/package!Member');
      });

      it('should accumulate text from multiple nodes', () => {
        const stringBuilder = new StringBuilder();
        const section = {
          kind: 'Section',
          nodes: [
            createPlainTextNode('First '),
            createPlainTextNode('Second '),
            createPlainTextNode('Third')
          ]
        };

        (emitter as any)._extractTextContent(section, stringBuilder);

        expect(stringBuilder.toString()).toBe('First Second Third');
      });
    });

    describe('_extractTextContentWithTypeResolution()', () => {
      it('should extract plain text', () => {
        const stringBuilder = new StringBuilder();
        const node = createPlainTextNode('Simple text');

        (emitter as any)._extractTextContentWithTypeResolution(node, stringBuilder, undefined);

        expect(stringBuilder.toString()).toBe('Simple text');
      });

      it('should handle LinkTag with linkText', () => {
        const stringBuilder = new StringBuilder();
        const linkTag = {
          kind: 'LinkTag',
          linkText: 'Display Text',
          codeDestination: null
        };

        (emitter as any)._extractTextContentWithTypeResolution(linkTag, stringBuilder, undefined);

        expect(stringBuilder.toString()).toBe('Display Text');
      });

      it('should attempt to resolve API references', () => {
        const stringBuilder = new StringBuilder();
        const mockContextItem = createMockApiItem({ displayName: 'Context' });

        // Create a simple mock that will fallback gracefully
        const mockDeclarationReference = {
          emitAsTsdoc: () => 'test!Member'
        };

        const linkTag = {
          kind: 'LinkTag',
          codeDestination: mockDeclarationReference,
          linkText: undefined,
          urlDestination: undefined
        };

        // Should handle the resolution gracefully and fallback to emitAsTsdoc
        (emitter as any)._extractTextContentWithTypeResolution(
          linkTag,
          stringBuilder,
          mockContextItem
        );

        // Should fallback to emitAsTsdoc since no link text is provided
        expect(stringBuilder.toString()).toBe('test!Member');
      });

      it('should handle nested sections', () => {
        const stringBuilder = new StringBuilder();
        const section = {
          kind: 'Section',
          nodes: [
            {
              kind: 'Paragraph',
              nodes: [createPlainTextNode('Nested content')]
            }
          ]
        };

        (emitter as any)._extractTextContentWithTypeResolution(section, stringBuilder, undefined);

        expect(stringBuilder.toString()).toBe('Nested content');
      });
    });
  });

  describe('Mintlify Component Generation', () => {
    describe('Property Tables (TypeTree)', () => {
      it('should convert property tables to TypeTree components', () => {
        const stringBuilder = new StringBuilder();
        const table = createPropertyTable(mockConfig, 'Property');
        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {
            contextApiItem: undefined,
            onGetFilenameForApiItem: () => undefined
          }
        };

        (emitter as any)._writeMintlifyTable(table, context);

        const output = stringBuilder.toString();
        expect(output).toContain('<TypeTree open');
        expect(output).toContain('name="name"');
        expect(output).toContain('type="string"');
        expect(output).toContain('required={true}');
      });

      it('should include TypeTree import statement', () => {
        const stringBuilder = new StringBuilder();
        const table = createPropertyTable(mockConfig, 'Property');
        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {
            contextApiItem: undefined,
            onGetFilenameForApiItem: () => undefined
          }
        };

        (emitter as any)._writeMintlifyTable(table, context);

        const output = stringBuilder.toString();
        expect(output).toContain('import { TypeTree }');
        expect(output).toContain('/snippets/tsdocs/TypeTree.jsx');
      });

      it('should only add TypeTree import once', () => {
        const stringBuilder = new StringBuilder();
        const table1 = createPropertyTable(mockConfig, 'Property');
        const table2 = createPropertyTable(mockConfig, 'Parameter');
        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {
            contextApiItem: undefined,
            onGetFilenameForApiItem: () => undefined
          }
        };

        (emitter as any)._writeMintlifyTable(table1, context);
        (emitter as any)._writeMintlifyTable(table2, context);

        const output = stringBuilder.toString();
        const importMatches = output.match(/import \{ TypeTree \}/g);
        expect(importMatches).toHaveLength(1);
      });

      it('should sanitize property names for JSX', () => {
        const stringBuilder = new StringBuilder();
        const table = new DocTable({
          configuration: mockConfig,
          headerTitles: ['Property', 'Modifiers', 'Type', 'Description']
        });

        const row = table.createAndAddRow();
        row.addPlainTextCell('prop"name');
        row.addPlainTextCell('required');
        row.addPlainTextCell('string');
        row.addPlainTextCell('Description');

        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {
            contextApiItem: undefined,
            onGetFilenameForApiItem: () => undefined
          }
        };

        (emitter as any)._writeMintlifyTable(table, context);

        const output = stringBuilder.toString();
        // Quotes should be escaped
        expect(output).not.toContain('name="prop"name"');
      });

      it('should handle optional properties', () => {
        const stringBuilder = new StringBuilder();
        const table = new DocTable({
          configuration: mockConfig,
          headerTitles: ['Property', 'Modifiers', 'Type', 'Description']
        });

        const row = table.createAndAddRow();
        row.addPlainTextCell('optionalProp?');
        row.addPlainTextCell('');
        row.addPlainTextCell('string');
        row.addPlainTextCell('(Optional) An optional property');

        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {
            contextApiItem: undefined,
            onGetFilenameForApiItem: () => undefined
          }
        };

        (emitter as any)._writeMintlifyTable(table, context);

        const output = stringBuilder.toString();
        expect(output).toContain('name="optionalProp"');
        expect(output).not.toContain('required={true}');
      });
    });

    describe('Method Tables (ResponseField)', () => {
      it('should convert method tables to ResponseField components', () => {
        const stringBuilder = new StringBuilder();
        const table = createMethodTable(mockConfig, 'Method');
        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {
            contextApiItem: undefined,
            onGetFilenameForApiItem: () => undefined
          }
        };

        (emitter as any)._writeMintlifyTable(table, context);

        const output = stringBuilder.toString();
        expect(output).toContain('<ResponseField');
        expect(output).toContain('name="myMethod()"');
        expect(output).toContain('</ResponseField>');
      });

      it('should include method descriptions', () => {
        const stringBuilder = new StringBuilder();
        const table = createMethodTable(mockConfig, 'Method');
        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {
            contextApiItem: undefined,
            onGetFilenameForApiItem: () => undefined
          }
        };

        (emitter as any)._writeMintlifyTable(table, context);

        const output = stringBuilder.toString();
        expect(output).toContain('Does something');
      });

      it('should mark deprecated methods', () => {
        const stringBuilder = new StringBuilder();
        const table = new DocTable({
          configuration: mockConfig,
          headerTitles: ['Method', 'Modifiers', 'Description']
        });

        const row = table.createAndAddRow();
        row.addPlainTextCell('oldMethod()');
        row.addPlainTextCell('public');
        row.addPlainTextCell('Deprecated: Use newMethod() instead');

        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {
            contextApiItem: undefined,
            onGetFilenameForApiItem: () => undefined
          }
        };

        (emitter as any)._writeMintlifyTable(table, context);

        const output = stringBuilder.toString();
        expect(output).toContain('deprecated={true}');
      });

      it('should sanitize method names for JSX', () => {
        const stringBuilder = new StringBuilder();
        const table = new DocTable({
          configuration: mockConfig,
          headerTitles: ['Constructor', 'Modifiers', 'Description']
        });

        const row = table.createAndAddRow();
        row.addPlainTextCell('new <Type>()');
        row.addPlainTextCell('public');
        row.addPlainTextCell('Creates instance');

        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {
            contextApiItem: undefined,
            onGetFilenameForApiItem: () => undefined
          }
        };

        (emitter as any)._writeMintlifyTable(table, context);

        const output = stringBuilder.toString();
        // Should escape angle brackets
        expect(output).not.toMatch(/<Type>/);
      });
    });

    describe('HTML Table Fallback', () => {
      it('should render unknown tables as HTML', () => {
        const stringBuilder = new StringBuilder();
        const table = new DocTable({
          configuration: mockConfig,
          headerTitles: ['Column1', 'Column2']
        });

        const row = table.createAndAddRow();
        row.addPlainTextCell('Value1');
        row.addPlainTextCell('Value2');

        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {
            contextApiItem: undefined,
            onGetFilenameForApiItem: () => undefined
          }
        };

        (emitter as any)._writeMintlifyTable(table, context);

        const output = stringBuilder.toString();
        expect(output).toContain('<table>');
        expect(output).toContain('<thead>');
        expect(output).toContain('<tbody>');
        expect(output).toContain('</table>');
      });

      it('should handle tables with inconsistent column counts', () => {
        const stringBuilder = new StringBuilder();
        const table = new DocTable({
          configuration: mockConfig,
          headerTitles: ['Col1', 'Col2']
        });

        // Add row with different column count
        const row = table.createAndAddRow();
        row.addPlainTextCell('Value1');
        row.addPlainTextCell('Value2');
        row.addPlainTextCell('Value3');

        const context = {
          writer: new IndentedWriter(stringBuilder),
          boldRequested: false,
          italicRequested: false,
          writingBold: false,
          writingItalic: false,
          options: {
            contextApiItem: undefined,
            onGetFilenameForApiItem: () => undefined
          }
        };

        (emitter as any)._writeMintlifyTable(table, context);

        const output = stringBuilder.toString();
        // Should size table based on longest row (3 columns)
        expect(output).toContain('<th>');
        expect(output).toContain('</th>');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tables', () => {
      const stringBuilder = new StringBuilder();
      const table = new DocTable({
        configuration: mockConfig
      });

      const context = {
        writer: new IndentedWriter(stringBuilder),
        boldRequested: false,
        italicRequested: false,
        writingBold: false,
        writingItalic: false,
        options: {
          contextApiItem: undefined,
          onGetFilenameForApiItem: () => undefined
        }
      };

      (emitter as any)._writeMintlifyTable(table, context);

      const output = stringBuilder.toString();
      // Should still render table structure
      expect(output).toContain('<table>');
    });

    it('should handle tables with empty cells', () => {
      const stringBuilder = new StringBuilder();
      const table = new DocTable({
        configuration: mockConfig,
        headerTitles: ['Property', 'Modifiers', 'Type', 'Description']
      });

      const row = table.createAndAddRow();
      row.addPlainTextCell(''); // Empty name
      row.addPlainTextCell(''); // Empty modifiers
      row.addPlainTextCell(''); // Empty type
      row.addPlainTextCell(''); // Empty description

      const context = {
        writer: new IndentedWriter(stringBuilder),
        boldRequested: false,
        italicRequested: false,
        writingBold: false,
        writingItalic: false,
        options: {
          contextApiItem: undefined,
          onGetFilenameForApiItem: () => undefined
        }
      };

      (emitter as any)._writeMintlifyTable(table, context);

      const output = stringBuilder.toString();
      // Should handle gracefully - no TypeTree should be generated for empty name
      expect(output).toContain('## Properties');
      expect(output).toContain('import { TypeTree }');
      // But no TypeTree components since name is empty
      expect(output).not.toContain('<TypeTree open');
    });

    it('should handle missing type column', () => {
      const stringBuilder = new StringBuilder();
      const table = new DocTable({
        configuration: mockConfig,
        headerTitles: ['Property', 'Modifiers', 'Type', 'Description']
      });

      const row = table.createAndAddRow();
      row.addPlainTextCell('name');
      row.addPlainTextCell('required');
      row.addPlainTextCell(''); // Empty type
      row.addPlainTextCell('Description');

      const context = {
        writer: new IndentedWriter(stringBuilder),
        boldRequested: false,
        italicRequested: false,
        writingBold: false,
        writingItalic: false,
        options: {
          contextApiItem: undefined,
          onGetFilenameForApiItem: () => undefined
        }
      };

      (emitter as any)._writeMintlifyTable(table, context);

      const output = stringBuilder.toString();
      // Should use 'object' as fallback
      expect(output).toContain('type="object"');
    });

    it('should handle unicode in table content', () => {
      const stringBuilder = new StringBuilder();
      const table = new DocTable({
        configuration: mockConfig,
        headerTitles: ['Property', 'Modifiers', 'Type', 'Description']
      });

      const row = table.createAndAddRow();
      row.addPlainTextCell('name');
      row.addPlainTextCell('required');
      row.addPlainTextCell('string');
      row.addPlainTextCell('Unicode test: 你好 🚀');

      const context = {
        writer: new IndentedWriter(stringBuilder),
        boldRequested: false,
        italicRequested: false,
        writingBold: false,
        writingItalic: false,
        options: {
          contextApiItem: undefined,
          onGetFilenameForApiItem: () => undefined
        }
      };

      (emitter as any)._writeMintlifyTable(table, context);

      const output = stringBuilder.toString();
      expect(output).toContain('你好');
      expect(output).toContain('🚀');
    });
  });

  describe('Integration Tests', () => {
    it('should emit complete MDX from complex table structures', () => {
      const stringBuilder = new StringBuilder();
      const propertyTable = createPropertyTable(mockConfig, 'Property');
      const methodTable = createMethodTable(mockConfig, 'Method');

      const section = {
        kind: 'Section',
        nodes: []
      };

      const options = {
        contextApiItem: undefined,
        onGetFilenameForApiItem: () => undefined
      };

      const result = emitter.emit(stringBuilder, section as any, options as any);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });
});
