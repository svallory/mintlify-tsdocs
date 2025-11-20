import * as path from 'path';
import { CommandLineAction } from '@rushstack/ts-command-line';
import { FileSystem } from '@rushstack/node-core-library';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';
import Table from 'cli-table3';
import { ESLint } from 'eslint';
import {
  ApiModel,
  ApiItem,
  ApiItemKind,
  ApiDocumentedItem,
  ApiParameterListMixin,
  ApiReturnTypeMixin
} from '@microsoft/api-extractor-model';
import { loadConfig } from '../config';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import { showCliHeader } from './CliHelpers';

/**
 * Documentation issue severity levels
 */
enum IssueSeverity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info'
}

/**
 * Documentation issue interface
 */
interface DocumentationIssue {
  severity: IssueSeverity;
  message: string;
  location: string;
  apiItem: ApiItem;
}

/**
 * CLI action for linting documentation quality.
 *
 * @public
 */
export class LintAction extends CommandLineAction {
  public constructor() {
    super({
      actionName: 'lint',
      summary: 'Check documentation quality and find issues',
      documentation:
        'Analyzes API documentation and reports:\n' +
        '  - Undocumented public APIs\n' +
        '  - Missing parameter descriptions\n' +
        '  - Missing return type descriptions\n' +
        '  - Missing examples for complex APIs\n\n' +
        'Examples:\n' +
        '  mint-tsdocs lint\n' +
        '  mint-tsdocs lint --help'
    });
  }

  protected override async onExecuteAsync(): Promise<void> {

    showCliHeader();
    clack.log.message(Colorize.bold('Documentation Linting'));

    try {
      const config = loadConfig(process.cwd());

      // Resolve paths
      const projectDir = process.cwd();
      const tsdocsDir = path.join(projectDir, 'docs', '.tsdocs');

      // Check if .tsdocs directory exists
      if (!FileSystem.exists(tsdocsDir)) {
        clack.log.error('No documentation has been generated yet.');
        clack.outro(
          'Run ' + Colorize.cyan('mint-tsdocs generate') + ' to generate documentation first'
        );
        return;
      }

      // Find all .api.json files
      const files = FileSystem.readFolderItemNames(tsdocsDir);
      const apiJsonFiles = files.filter((file: string) => file.endsWith('.api.json'));

      if (apiJsonFiles.length === 0) {
        clack.log.error('No API model files found in ' + tsdocsDir);
        clack.outro(
          'Run ' + Colorize.cyan('mint-tsdocs generate') + ' to generate documentation first'
        );
        return;
      }

      // Load API model
      const apiModel = new ApiModel();
      for (const apiJsonFile of apiJsonFiles) {
        const apiJsonPath = path.join(tsdocsDir, apiJsonFile);
        apiModel.loadPackage(apiJsonPath);
      }

      // Collect issues from API model
      const issues: DocumentationIssue[] = [];
      this._lintApiModel(apiModel, issues);

      // Run ESLint with tsdoc plugin
      await this._runESLint(config, projectDir, issues);

      // Display results
      this._displayIssues(issues);
    } catch (error) {
      if (error instanceof DocumentationError && error.code === ErrorCode.CONFIG_NOT_FOUND) {
        clack.log.error('No mint-tsdocs configuration found.');
        clack.outro('Run ' + Colorize.cyan('mint-tsdocs init') + ' to create a configuration file');
      } else {
        throw error;
      }
    }
  }

  /**
   * Lint the API model and collect issues
   */
  private _lintApiModel(apiModel: ApiModel, issues: DocumentationIssue[]): void {
    const lintApiItem = (item: ApiItem, parentPath: string = ''): void => {
      // Build location path
      const location = parentPath ? `${parentPath}.${item.displayName}` : item.displayName;

      // Skip non-public items (they don't need docs)
      if (item instanceof ApiDocumentedItem) {
        // Check if item is documented
        const tsdocComment = item.tsdocComment;
        const hasDocumentation =
          tsdocComment &&
          tsdocComment.summarySection &&
          tsdocComment.summarySection.nodes.length > 0;

        if (!hasDocumentation) {
          // Severity based on item type
          let severity = IssueSeverity.Warning;
          if (
            item.kind === ApiItemKind.Class ||
            item.kind === ApiItemKind.Interface ||
            item.kind === ApiItemKind.Function
          ) {
            severity = IssueSeverity.Error;
          }

          issues.push({
            severity,
            message: 'Missing documentation',
            location,
            apiItem: item
          });
        } else if (tsdocComment) {
          // Check for missing parameter descriptions
          if (ApiParameterListMixin.isBaseClassOf(item)) {
            for (const param of item.parameters) {
              // Try to find the parameter documentation
              let hasParamDoc = false;
              for (const paramBlock of tsdocComment.params.blocks) {
                if (paramBlock.parameterName === param.name && paramBlock.content.nodes.length > 0) {
                  hasParamDoc = true;
                  break;
                }
              }

              if (!hasParamDoc) {
                issues.push({
                  severity: IssueSeverity.Warning,
                  message: `Parameter '${param.name}' missing description`,
                  location,
                  apiItem: item
                });
              }
            }
          }

          // Check for missing return type description
          if (
            ApiReturnTypeMixin.isBaseClassOf(item) &&
            item.kind !== ApiItemKind.Constructor &&
            item.returnTypeExcerpt.text !== 'void'
          ) {
            const returnsBlock = tsdocComment.returnsBlock;
            if (!returnsBlock || returnsBlock.content.nodes.length === 0) {
              issues.push({
                severity: IssueSeverity.Warning,
                message: 'Missing @returns description',
                location,
                apiItem: item
              });
            }
          }

          // Suggest examples for complex public APIs
          if (
            (item.kind === ApiItemKind.Class || item.kind === ApiItemKind.Interface) &&
            tsdocComment.customBlocks.filter(b => b.blockTag.tagName === '@example').length === 0
          ) {
            issues.push({
              severity: IssueSeverity.Info,
              message: 'Consider adding usage examples',
              location,
              apiItem: item
            });
          }
        }
      }

      // Recurse into members
      if ('members' in item) {
        for (const member of (item as any).members) {
          lintApiItem(member, location);
        }
      }
    };

    // Process all packages
    for (const apiPackage of apiModel.packages) {
      for (const entryPoint of apiPackage.entryPoints) {
        for (const member of entryPoint.members) {
          lintApiItem(member);
        }
      }
    }
  }

  /**
   * Run ESLint with tsdoc plugin on source files
   */
  private async _runESLint(
    config: any,
    projectDir: string,
    issues: DocumentationIssue[]
  ): Promise<void> {
    try {
      // Determine source directory
      const srcDir = path.join(projectDir, 'src');
      if (!FileSystem.exists(srcDir)) {
        // Skip ESLint if no src directory
        return;
      }

      // Import plugins (ESLint 9 format)
      const tsdocPlugin = await import('eslint-plugin-tsdoc');
      const typescriptParser = await import('@typescript-eslint/parser');

      // Create ESLint instance with tsdoc plugin
      const eslint = new ESLint({
        overrideConfigFile: true,
        overrideConfig: [{
          plugins: {
            tsdoc: tsdocPlugin.default
          },
          rules: {
            'tsdoc/syntax': 'warn'
          },
          languageOptions: {
            parser: typescriptParser.default
          }
        }],
        cwd: projectDir
      });

      // Lint all TypeScript files in src
      const results = await eslint.lintFiles([path.join(srcDir, '**/*.ts')]);

      // Convert ESLint results to our issue format
      for (const result of results) {
        const relativePath = path.relative(projectDir, result.filePath);

        for (const message of result.messages) {
          // Skip if no tsdoc-related message
          if (!message.ruleId || !message.ruleId.startsWith('tsdoc/')) {
            continue;
          }

          const severity =
            message.severity === 2
              ? IssueSeverity.Error
              : message.severity === 1
              ? IssueSeverity.Warning
              : IssueSeverity.Info;

          issues.push({
            severity,
            message: `${message.message} (${message.ruleId})`,
            location: `${relativePath}:${message.line}:${message.column}`,
            apiItem: null as any // ESLint issues don't have API items
          });
        }
      }
    } catch (error) {
      // Silently skip ESLint if it fails (e.g., no TypeScript parser)
      clack.log.warn('ESLint analysis skipped (install @typescript-eslint/parser for TSDoc linting)');
    }
  }

  /**
   * Display lint issues in a formatted table
   */
  private _displayIssues(issues: DocumentationIssue[]): void {
    if (issues.length === 0) {
      console.log('\n' + Colorize.green('✓ No documentation issues found!'));
      clack.outro('Your documentation looks great!');
      return;
    }

    // Group by severity
    const errors = issues.filter(i => i.severity === IssueSeverity.Error);
    const warnings = issues.filter(i => i.severity === IssueSeverity.Warning);
    const info = issues.filter(i => i.severity === IssueSeverity.Info);

    // Create table
    const table = new Table({
      head: [Colorize.cyan('Severity'), Colorize.cyan('Issue'), Colorize.cyan('Location')],
      style: {
        head: [],
        border: ['dim']
      },
      colWidths: [12, 35, 50],
      wordWrap: true
    });

    // Helper to format severity
    const formatSeverity = (severity: IssueSeverity): string => {
      switch (severity) {
        case IssueSeverity.Error:
          return Colorize.red('error');
        case IssueSeverity.Warning:
          return Colorize.yellow('warning');
        case IssueSeverity.Info:
          return Colorize.cyan('info');
      }
    };

    // Add issues to table (errors first, then warnings, then info)
    const sortedIssues = [...errors, ...warnings, ...info];

    // Limit display to avoid overwhelming output
    const maxDisplay = 50;
    const displayIssues = sortedIssues.slice(0, maxDisplay);

    for (const issue of displayIssues) {
      table.push([formatSeverity(issue.severity), issue.message, issue.location]);
    }

    // Wrap table output with Clack's message formatting
    clack.log.message(table.toString());

    // Build summary message
    let summaryLines: string[] = [Colorize.bold('Summary')];
    if (errors.length > 0) {
      summaryLines.push('  Errors:          ' + Colorize.red(errors.length.toString()));
    }
    if (warnings.length > 0) {
      summaryLines.push('  Warnings:        ' + Colorize.yellow(warnings.length.toString()));
    }
    if (info.length > 0) {
      summaryLines.push('  Info:            ' + Colorize.cyan(info.length.toString()));
    }

    if (sortedIssues.length > maxDisplay) {
      summaryLines.push('');
      summaryLines.push(
        Colorize.dim(
          `Showing first ${maxDisplay} issues. ${sortedIssues.length - maxDisplay} more issues found.`
        )
      );
    }

    // Wrap summary with Clack
    clack.log.message(summaryLines.join('\n'));

    // Exit with error code if there are errors
    if (errors.length > 0) {
      clack.outro(Colorize.red(`Found ${errors.length} error(s). Fix these issues first.`));
      process.exitCode = 1;
    } else {
      clack.outro('Run `mint-tsdocs generate` to update documentation.');
    }
  }
}
