// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

/**
 * mint-tsdocs generates Mintlify-compatible MDX documentation from .api.json files created by API Extractor.
 * The `mint-tsdocs` package provides the command-line tool for generating documentation with proper frontmatter
 * and navigation integration for Mintlify documentation sites.
 *
 * @packageDocumentation
 */

// ===============================================
// Main Documentation Generator
// ===============================================
export { MarkdownDocumenter } from './documenters/MarkdownDocumenter';
export type { IMarkdownDocumenterOptions } from './documenters/MarkdownDocumenter';

// ===============================================
// Markdown Emitters
// ===============================================
export { CustomMarkdownEmitter } from './markdown/CustomMarkdownEmitter';
export type { ICustomMarkdownEmitterOptions } from './markdown/CustomMarkdownEmitter';
export { MarkdownEmitter } from './markdown/MarkdownEmitter';
export type { IMarkdownEmitterContext, IMarkdownEmitterOptions } from './markdown/MarkdownEmitter';

// ===============================================
// Configuration
// ===============================================
export * from './config';

// ===============================================
// Navigation Management
// ===============================================
export * from './navigation';

// ===============================================
// Template System
// ===============================================
export * from './templates';

// ===============================================
// Cache Management
// ===============================================
export * from './cache';

// ===============================================
// Utilities
// ===============================================
export { IndentedWriter } from './utils/IndentedWriter';
export * from './utils';

// ===============================================
// Custom TSDoc Nodes
// ===============================================
export { CustomDocNodeKind, CustomDocNodes } from './nodes/CustomDocNodeKind';
export { DocExpandable } from './nodes/DocExpandable';
export { DocTable } from './nodes/DocTable';
export type { IDocTableParameters } from './nodes/DocTable';
export { DocTableRow } from './nodes/DocTableRow';
export type { IDocTableRowParameters } from './nodes/DocTableRow';
export { DocTableCell } from './nodes/DocTableCell';
export type { IDocTableCellParameters } from './nodes/DocTableCell';
export { DocHeading } from './nodes/DocHeading';
export type { IDocHeadingParameters } from './nodes/DocHeading';
export { DocNoteBox } from './nodes/DocNoteBox';
export type { IDocNoteBoxParameters } from './nodes/DocNoteBox';
export { DocEmphasisSpan } from './nodes/DocEmphasisSpan';
export type { IDocEmphasisSpanParameters } from './nodes/DocEmphasisSpan';
