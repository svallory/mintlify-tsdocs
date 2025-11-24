import { describe, it, expect } from 'bun:test';
import { TSDocConfiguration } from '@microsoft/tsdoc';
import { CustomDocNodes, CustomDocNodeKind } from '../../src/nodes/CustomDocNodeKind';
import { DocHeading } from '../../src/nodes/DocHeading';
import { DocTable } from '../../src/nodes/DocTable';
import { DocTableRow } from '../../src/nodes/DocTableRow';
import { DocTableCell } from '../../src/nodes/DocTableCell';
import { DocExpandable } from '../../src/nodes/DocExpandable';
import { DocNoteBox } from '../../src/nodes/DocNoteBox';
import { DocEmphasisSpan } from '../../src/nodes/DocEmphasisSpan';

describe('CustomDocNodes', () => {
  describe('configuration', () => {
    it('should return a TSDocConfiguration instance', () => {
      const config = CustomDocNodes.configuration;
      expect(config).toBeInstanceOf(TSDocConfiguration);
    });

    it('should have a docNodeManager', () => {
      const config = CustomDocNodes.configuration;
      expect(config.docNodeManager).toBeDefined();
    });

    it('should return the same configuration instance (singleton)', () => {
      const config1 = CustomDocNodes.configuration;
      const config2 = CustomDocNodes.configuration;
      expect(config1).toBe(config2);
    });
  });
});

describe('DocHeading', () => {
  it('should create a heading with default level 1', () => {
    const heading = new DocHeading({
      configuration: CustomDocNodes.configuration,
      title: 'Test Heading'
    });

    expect(heading.kind).toBe(CustomDocNodeKind.Heading);
    expect(heading.title).toBe('Test Heading');
    expect(heading.level).toBe(1);
  });

  it('should create a heading with specified level', () => {
    const heading = new DocHeading({
      configuration: CustomDocNodes.configuration,
      title: 'Test Heading',
      level: 3
    });

    expect(heading.level).toBe(3);
  });

  it('should validate heading level is between 1 and 5', () => {
    expect(() => {
      new DocHeading({
        configuration: CustomDocNodes.configuration,
        title: 'Test',
        level: 0
      });
    }).toThrow('must be a number between 1 and 5');

    expect(() => {
      new DocHeading({
        configuration: CustomDocNodes.configuration,
        title: 'Test',
        level: 6
      });
    }).toThrow('must be a number between 1 and 5');
  });

  it('should accept valid levels 1-5', () => {
    for (let level = 1; level <= 5; level++) {
      const heading = new DocHeading({
        configuration: CustomDocNodes.configuration,
        title: `Level ${level}`,
        level
      });
      expect(heading.level).toBe(level);
    }
  });
});

describe('DocTable', () => {
  it('should create a table with header titles', () => {
    const table = new DocTable({
      configuration: CustomDocNodes.configuration,
      headerTitles: ['Name', 'Type', 'Description']
    });

    expect(table.kind).toBe(CustomDocNodeKind.Table);
    expect(table.header.cells.length).toBe(3);
  });

  it('should create a table with rows', () => {
    const row = new DocTableRow({ configuration: CustomDocNodes.configuration });
    row.addPlainTextCell('Value');

    const table = new DocTable(
      {
        configuration: CustomDocNodes.configuration,
        headerTitles: ['Column']
      },
      [row]
    );

    expect(table.rows.length).toBe(1);
  });

  it('should throw error if both headerTitles and headerCells are provided', () => {
    const cell = new DocTableCell({ configuration: CustomDocNodes.configuration });

    expect(() => {
      new DocTable({
        configuration: CustomDocNodes.configuration,
        headerTitles: ['Name'],
        headerCells: [cell]
      });
    }).toThrow('cannot both be specified');
  });

  it('should validate headerTitles is not empty array', () => {
    expect(() => {
      new DocTable({
        configuration: CustomDocNodes.configuration,
        headerTitles: []
      });
    }).toThrow('headerTitles cannot be empty array');
  });

  it('should validate headerCells is not empty array', () => {
    expect(() => {
      new DocTable({
        configuration: CustomDocNodes.configuration,
        headerCells: []
      });
    }).toThrow('headerCells cannot be empty array');
  });

  it('should allow adding rows after construction', () => {
    const table = new DocTable({
      configuration: CustomDocNodes.configuration,
      headerTitles: ['Name']
    });

    expect(table.rows.length).toBe(0);

    const row = table.createAndAddRow();
    row.addPlainTextCell('Test');

    expect(table.rows.length).toBe(1);
  });
});

describe('DocTableRow', () => {
  it('should create an empty row', () => {
    const row = new DocTableRow({ configuration: CustomDocNodes.configuration });

    expect(row.kind).toBe(CustomDocNodeKind.TableRow);
    expect(row.cells.length).toBe(0);
  });

  it('should create a row with initial cells', () => {
    const cell1 = new DocTableCell({ configuration: CustomDocNodes.configuration });
    const cell2 = new DocTableCell({ configuration: CustomDocNodes.configuration });

    const row = new DocTableRow({ configuration: CustomDocNodes.configuration }, [cell1, cell2]);

    expect(row.cells.length).toBe(2);
  });

  it('should add plain text cells', () => {
    const row = new DocTableRow({ configuration: CustomDocNodes.configuration });

    row.addPlainTextCell('Cell 1');
    row.addPlainTextCell('Cell 2');

    expect(row.cells.length).toBe(2);
  });

  it('should create and add cells', () => {
    const row = new DocTableRow({ configuration: CustomDocNodes.configuration });

    const cell = row.createAndAddCell();

    expect(row.cells.length).toBe(1);
    expect(cell).toBeInstanceOf(DocTableCell);
  });
});

describe('DocTableCell', () => {
  it('should create an empty cell', () => {
    const cell = new DocTableCell({ configuration: CustomDocNodes.configuration });

    expect(cell.kind).toBe(CustomDocNodeKind.TableCell);
    expect(cell.content).toBeDefined();
  });

  it('should create a cell with initial content', () => {
    const cell = new DocTableCell({ configuration: CustomDocNodes.configuration });

    expect(cell.content).toBeDefined();
  });
});

describe('DocExpandable', () => {
  it('should create an expandable with default title', () => {
    const expandable = new DocExpandable({
      configuration: CustomDocNodes.configuration
    });

    expect(expandable.kind).toBe(CustomDocNodeKind.Expandable);
    expect(expandable.title).toBe('Details');
    expect(expandable.content).toBeDefined();
  });

  it('should create an expandable with custom title', () => {
    const expandable = new DocExpandable(
      {
        configuration: CustomDocNodes.configuration
      },
      'Advanced Options'
    );

    expect(expandable.title).toBe('Advanced Options');
  });

  it('should validate title is not empty', () => {
    expect(() => {
      new DocExpandable(
        {
          configuration: CustomDocNodes.configuration
        },
        ''
      );
    }).toThrow('Expandable title cannot be empty');
  });

  it('should validate title is not whitespace only', () => {
    expect(() => {
      new DocExpandable(
        {
          configuration: CustomDocNodes.configuration
        },
        '   '
      );
    }).toThrow('Expandable title cannot be empty');
  });
});

describe('DocNoteBox', () => {
  it('should create a note box', () => {
    const note = new DocNoteBox({ configuration: CustomDocNodes.configuration });

    expect(note.kind).toBe(CustomDocNodeKind.NoteBox);
    expect(note.content).toBeDefined();
  });

  it('should have child nodes', () => {
    const note = new DocNoteBox({ configuration: CustomDocNodes.configuration });
    const children = note['onGetChildNodes']();

    expect(children.length).toBe(1);
    expect(children[0]).toBe(note.content);
  });
});

describe('DocEmphasisSpan', () => {
  it('should create emphasis with bold', () => {
    const emphasis = new DocEmphasisSpan({
      configuration: CustomDocNodes.configuration,
      bold: true
    });

    expect(emphasis.kind).toBe(CustomDocNodeKind.EmphasisSpan);
    expect(emphasis.bold).toBe(true);
    expect(emphasis.italic).toBe(false);
  });

  it('should create emphasis with italic', () => {
    const emphasis = new DocEmphasisSpan({
      configuration: CustomDocNodes.configuration,
      italic: true
    });

    expect(emphasis.bold).toBe(false);
    expect(emphasis.italic).toBe(true);
  });

  it('should create emphasis with both bold and italic', () => {
    const emphasis = new DocEmphasisSpan({
      configuration: CustomDocNodes.configuration,
      bold: true,
      italic: true
    });

    expect(emphasis.bold).toBe(true);
    expect(emphasis.italic).toBe(true);
  });

  it('should default to no emphasis', () => {
    const emphasis = new DocEmphasisSpan({
      configuration: CustomDocNodes.configuration
    });

    expect(emphasis.bold).toBe(false);
    expect(emphasis.italic).toBe(false);
  });
});
