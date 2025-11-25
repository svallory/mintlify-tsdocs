import * as path from 'path';
import * as clack from '@clack/prompts';
import chalk from 'chalk';

/**
 * Color theme for issue messages - matches Clack's color scheme with true color support
 */
const ISSUE_THEME = {
  // File/location colors (informational - cyan like Clack)
  filePath: chalk.cyan,
  lineNumber: chalk.hex('#9ece6a'),   // Green with true color support

  // Content highlighting
  identifier: chalk.hex('#7aa2f7'),   // Blue with true color support
  tag: chalk.yellow,                   // @ tags like @alpha, @public

  // Message text
  message: (text: string) => text,    // Default/uncolored
  dim: chalk.dim,                      // Subtle text
} as const;

/**
 * Issue severity levels
 */
export type IssueSeverity = 'error' | 'warning' | 'info' | 'message';

/**
 * Individual issue message with optional location
 */
export interface IssueMessage {
  /** The issue message text */
  text: string;

  /** Severity level for display formatting */
  severity: IssueSeverity;

  /** Optional line number in the source file */
  line?: number;

  /** Optional column number in the source file */
  column?: number;
}

/**
 * Group of issues for a specific file
 */
export interface IssueGroup {
  /** File path (absolute or relative) */
  filePath: string;

  /** Array of issues in this file */
  issues: IssueMessage[];
}

/**
 * Options for issue display
 */
export interface IssueDisplayOptions {
  /** Base directory for relative path calculation (defaults to process.cwd()) */
  baseDir?: string;

  /** Terminal width for text wrapping (auto-detected if not provided) */
  terminalWidth?: number;

  /** Whether to show file groups even if they only have "message" severity issues */
  showAllGroups?: boolean;
}

/**
 * Utility class for displaying issues grouped by file using Clack
 *
 * This replaces the inline message display logic from GenerateAction
 * and provides a consistent way to show validation/linting issues across all CLI commands.
 *
 * @example
 * ```typescript
 * const groups: IssueGroup[] = [
 *   {
 *     filePath: '/path/to/file.ts',
 *     issues: [
 *       { text: 'Missing parameter description', severity: 'warning', line: 42 },
 *       { text: 'Invalid @returns tag', severity: 'error', line: 45 }
 *     ]
 *   }
 * ];
 *
 * IssueDisplayUtils.displayGroupedIssues(groups);
 * ```
 */
export class IssueDisplayUtils {
  /**
   * Display issues grouped by file using Clack groups
   *
   * Each file becomes a Clack group, and each issue within that file
   * is displayed as an individual Clack message with appropriate severity styling.
   *
   * @param groups - Array of issue groups (one per file)
   * @param ungroupedIssues - Optional array of issues without file location
   * @param options - Display options
   */
  public static displayGroupedIssues(
    groups: IssueGroup[],
    ungroupedIssues: IssueMessage[] = [],
    options: IssueDisplayOptions = {}
  ): void {
    const {
      baseDir = process.cwd(),
      terminalWidth = this._getTerminalWidth(),
      showAllGroups = false
    } = options;

    // Display issues grouped by file
    for (const group of groups) {
      const relativePath = path.relative(baseDir, group.filePath);

      // Group issues by severity within this file
      const errors = group.issues.filter(i => i.severity === 'error');
      const warnings = group.issues.filter(i => i.severity === 'warning');
      const infos = group.issues.filter(i => i.severity === 'info');
      const messages = group.issues.filter(i => i.severity === 'message');

      // Skip this file group if it only has "message" severity and showAllGroups is false
      if (!showAllGroups && errors.length === 0 && warnings.length === 0 && infos.length === 0) {
        // Still display messages but without the grouped format
        this._displayUngroupedMessages(messages, terminalWidth);
        continue;
      }

      // Display each severity level as its own Clack message
      // Display errors first (highest priority)
      if (errors.length > 0) {
        const errorMessages = errors.map(issue =>
          this._formatIssue(issue, terminalWidth)
        ).join('\n\n');
        clack.log.error(`${ISSUE_THEME.filePath(relativePath)}\n${errorMessages}`);
      }

      // Then warnings
      if (warnings.length > 0) {
        const warningMessages = warnings.map(issue =>
          this._formatIssue(issue, terminalWidth)
        ).join('\n\n');
        clack.log.warn(`${ISSUE_THEME.filePath(relativePath)}\n${warningMessages}`);
      }

      // Then info
      if (infos.length > 0) {
        const infoMessages = infos.map(issue =>
          this._formatIssue(issue, terminalWidth)
        ).join('\n\n');
        clack.log.info(`${ISSUE_THEME.filePath(relativePath)}\n${infoMessages}`);
      }

      // Finally other messages (dimmed)
      if (messages.length > 0 && showAllGroups) {
        const otherMessages = messages.map(issue =>
          this._formatIssue(issue, terminalWidth)
        ).join('\n\n');
        clack.log.message(`${ISSUE_THEME.dim(ISSUE_THEME.filePath(relativePath))}\n${ISSUE_THEME.dim(otherMessages)}`);
      }
    }

    // Display ungrouped issues (without file location)
    this._displayUngroupedMessages(ungroupedIssues, terminalWidth);
  }

  /**
   * Display issues that don't have a file location
   */
  private static _displayUngroupedMessages(issues: IssueMessage[], terminalWidth: number): void {
    for (const issue of issues) {
      const lines = issue.text.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        const wrapped = this._wrapText(line, terminalWidth, 0, 0);

        if (issue.severity === 'error') {
          clack.log.error(wrapped);
        } else if (issue.severity === 'warning') {
          clack.log.warn(wrapped);
        } else if (issue.severity === 'info') {
          clack.log.info(wrapped);
        } else {
          clack.log.message(ISSUE_THEME.dim(wrapped));
        }
      }
    }
  }

  /**
   * Format a single issue with location and colorized components
   */
  private static _formatIssue(issue: IssueMessage, maxWidth: number): string {
    // Build location string (just line number, not column)
    let location = '';
    if (issue.line !== undefined) {
      location = String(issue.line);
    }

    // Colorize message components
    const coloredText = this._colorizeMessageText(issue.text);

    // Format: "  line: message" (clack provides the left border)
    const indent = '  ';
    const separator = ': ';
    const coloredLocation = location ? ISSUE_THEME.lineNumber(location) : '';
    const locationStr = location ? `${coloredLocation}${separator}` : '';

    // Calculate lengths without ANSI codes for proper wrapping
    const firstLineIndent = indent.length + location.length + separator.length;
    const continuationIndent = indent.length + location.length + separator.length;

    // Wrap the message text if needed
    const wrappedLines = this._wrapText(coloredText, maxWidth, firstLineIndent, continuationIndent);

    // Format first line
    const lines = wrappedLines.split('\n');
    const result = [`${indent}${locationStr}${lines[0]}`];

    // Add continuation lines with proper indentation
    for (let i = 1; i < lines.length; i++) {
      // Align continuation with the start of the message text
      const continuationIndentStr = ' '.repeat(continuationIndent);
      result.push(`${continuationIndentStr}${lines[i]}`);
    }

    return result.join('\n');
  }

  /**
   * Colorize message text with syntax highlighting using theme colors
   */
  private static _colorizeMessageText(text: string): string {
    let result = text;

    // Color @ tags (like @alpha, @beta, @public, @internal) using theme
    result = result.replace(/@(alpha|beta|public|internal|param|returns?|throws?|deprecated|see|link|example|remarks?|readonly|override|sealed|virtual|abstract|enum|interface|extends|implements|typeParam)/g,
      (match) => ISSUE_THEME.tag(match));

    // Color quoted identifiers/strings using theme
    result = result.replace(/"([^"]+)"/g, (_, match) => `"${ISSUE_THEME.identifier(match)}"`);

    return result;
  }

  /**
   * Wrap text to fit within terminal width, preserving ANSI color codes
   */
  private static _wrapText(text: string, maxWidth: number, firstLineIndent: number, continuationIndent: number): string {
    // Remove ANSI codes for length calculation
    const stripAnsi = (str: string): string => str.replace(/\x1b\[[0-9;]*m/g, '');

    const plainText = stripAnsi(text);

    // If text fits on one line, return as-is
    if (plainText.length + firstLineIndent <= maxWidth) {
      return text;
    }

    // Need to wrap - we'll do a simple word-based wrap
    const words: string[] = [];
    const coloredWords: string[] = [];

    // Split by spaces while tracking positions to preserve colors
    let currentWord = '';
    let currentColoredWord = '';
    let inAnsiCode = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '\x1b') {
        inAnsiCode = true;
      }

      currentColoredWord += char;

      if (!inAnsiCode) {
        currentWord += char;
      }

      if (char === 'm' && inAnsiCode) {
        inAnsiCode = false;
      }

      if (char === ' ' && !inAnsiCode) {
        if (currentWord.trim()) {
          words.push(currentWord.trim());
          coloredWords.push(currentColoredWord.trim());
        }
        currentWord = '';
        currentColoredWord = '';
      }
    }

    // Add last word
    if (currentWord.trim()) {
      words.push(currentWord.trim());
      coloredWords.push(currentColoredWord.trim());
    }

    // Build wrapped lines
    const lines: string[] = [];
    let currentLine: string[] = [];
    let currentLineLength = 0;
    const firstLineMax = maxWidth - firstLineIndent;
    const continuationMax = maxWidth - continuationIndent;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const coloredWord = coloredWords[i];
      const wordLength = word.length;
      const isFirstLine = lines.length === 0;
      const maxLength = isFirstLine ? firstLineMax : continuationMax;
      const spaceLength = currentLine.length > 0 ? 1 : 0;

      if (currentLineLength + spaceLength + wordLength <= maxLength) {
        currentLine.push(coloredWord);
        currentLineLength += spaceLength + wordLength;
      } else {
        // Start new line
        if (currentLine.length > 0) {
          lines.push(currentLine.join(' '));
        }
        currentLine = [coloredWord];
        currentLineLength = wordLength;
      }
    }

    // Add last line
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }

    return lines.join('\n');
  }

  /**
   * Get terminal width with margin for safe text wrapping
   */
  private static _getTerminalWidth(): number {
    const defaultWidth = 80;
    const margin = 4; // Extra safety margin to prevent incorrect line breaks
    const width = process.stdout.columns || defaultWidth;
    return Math.max(40, width - margin); // Minimum 40 chars
  }

  /**
   * Convert a log level string to issue severity
   *
   * @param logLevel - Log level from api-extractor or other tools
   * @returns Normalized severity level
   */
  public static logLevelToSeverity(logLevel: string): IssueSeverity {
    switch (logLevel.toLowerCase()) {
      case 'error':
        return 'error';
      case 'warning':
      case 'warn':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'message';
    }
  }
}
