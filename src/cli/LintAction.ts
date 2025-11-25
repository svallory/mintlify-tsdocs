import * as path from 'path';
import { CommandLineAction } from '@rushstack/ts-command-line';
import { FileSystem } from '@rushstack/node-core-library';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';
import { ESLint } from 'eslint';
import {
  ApiModel,
  ApiItem,
  ApiItemKind,
  ApiDocumentedItem,
  ApiParameterListMixin,
  ApiReturnTypeMixin
} from '@microsoft/api-extractor-model';
import { Extractor, ExtractorConfig, type ExtractorResult } from '@microsoft/api-extractor';
import { loadConfig, generateApiExtractorConfig } from '../config';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import { showCliHeader } from './CliHelpers';
import { IssueDisplayUtils, type IssueMessage, type IssueGroup, type IssueSeverity } from './IssueDisplayUtils';

/**
 * Internal documentation issue from API model analysis
 */
interface DocumentationIssue {
  severity: IssueSeverity;
  message: string;
  location: string;  // API item path like "MyClass.myMethod"
  filePath?: string;  // Source file path if available
  line?: number;     // Line number if available
  apiItem?: ApiItem;  // Associated API item if available
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

      // Generate api-extractor config if needed
      clack.log.info('Preparing API Extractor configuration...');
      const apiExtractorConfigPath = generateApiExtractorConfig(config, projectDir, tsdocsDir);

      // Collections for all issues
      const issueGroups = new Map<string, IssueMessage[]>();
      const ungroupedIssues: IssueMessage[] = [];

      // Step 1: Run api-extractor to collect TSDoc/syntax warnings
      clack.log.info('Running API Extractor to collect TSDoc warnings...');
      await this._runApiExtractor(apiExtractorConfigPath, issueGroups, ungroupedIssues);

      // Step 2: Load API model for documentation completeness checks
      if (!FileSystem.exists(tsdocsDir)) {
        clack.log.warn('No .api.json files found. Skipping API model analysis.');
      } else {
        const files = FileSystem.readFolderItemNames(tsdocsDir);
        const apiJsonFiles = files.filter((file: string) => file.endsWith('.api.json'));

        if (apiJsonFiles.length > 0) {
          clack.log.info('Analyzing API model for documentation completeness...');
          const apiModel = new ApiModel();
          for (const apiJsonFile of apiJsonFiles) {
            const apiJsonPath = path.join(tsdocsDir, apiJsonFile);
            apiModel.loadPackage(apiJsonPath);
          }

          // Collect issues from API model
          const modelIssues: DocumentationIssue[] = [];
          this._lintApiModel(apiModel, modelIssues);
          this._addIssuesToGroups(modelIssues, issueGroups, ungroupedIssues);
        }
      }

      // Step 3: Run ESLint with tsdoc plugin
      clack.log.info('Running ESLint with TSDoc plugin...');
      await this._runESLint(config, projectDir, issueGroups, ungroupedIssues);

      // Display all collected issues
      this._displayIssues(issueGroups, ungroupedIssues);
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
   * Run API Extractor to collect TSDoc syntax warnings
   */
  private async _runApiExtractor(
    configPath: string,
    issueGroups: Map<string, IssueMessage[]>,
    ungroupedIssues: IssueMessage[]
  ): Promise<void> {
    try {
      const extractorConfig: ExtractorConfig = ExtractorConfig.loadFileAndPrepare(configPath);

      // Intercept console to suppress api-extractor's output
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;

      console.log = () => { };
      console.error = () => { };
      console.warn = () => { };

      try {
        // Run api-extractor with message callback
        const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
          localBuild: true,
          showVerboseMessages: false,
          messageCallback: (message: any) => {
            // Skip suppressed messages
            if (message.logLevel === 'none') {
              return;
            }

            // Create issue message
            const issue: IssueMessage = {
              text: message.text,
              severity: IssueDisplayUtils.logLevelToSeverity(message.logLevel),
              line: message.sourceFileLine,
              column: message.sourceFileColumn
            };

            // Group by file or collect without location
            if (message.sourceFilePath) {
              const fileKey = message.sourceFilePath;
              if (!issueGroups.has(fileKey)) {
                issueGroups.set(fileKey, []);
              }
              issueGroups.get(fileKey)!.push(issue);
            } else {
              ungroupedIssues.push(issue);
            }
          }
        });

        if (!extractorResult.succeeded) {
          clack.log.warn(
            `API Extractor completed with ${extractorResult.errorCount} errors and ${extractorResult.warningCount} warnings`
          );
        }
      } finally {
        // Restore console
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
      }
    } catch (error) {
      clack.log.warn('API Extractor analysis failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Convert DocumentationIssue array to grouped IssueMessage format
   */
  private _addIssuesToGroups(
    issues: DocumentationIssue[],
    issueGroups: Map<string, IssueMessage[]>,
    ungroupedIssues: IssueMessage[]
  ): void {
    for (const issue of issues) {
      const issueMessage: IssueMessage = {
        text: `${issue.message} (${issue.location})`,
        severity: issue.severity,
        line: issue.line
      };

      if (issue.filePath) {
        // Use "API: ItemName" format for API model issues to distinguish from file paths
        const groupKey = issue.filePath.includes('/') || issue.filePath.includes('\\')
          ? issue.filePath // Real file path
          : `API: ${issue.filePath}`; // Logical API grouping

        if (!issueGroups.has(groupKey)) {
          issueGroups.set(groupKey, []);
        }
        issueGroups.get(groupKey)!.push(issueMessage);
      } else {
        ungroupedIssues.push(issueMessage);
      }
    }
  }

  /**
   * Lint the API model and collect issues
   */
  private _lintApiModel(apiModel: ApiModel, issues: DocumentationIssue[]): void {
    const lintApiItem = (item: ApiItem, parentPath: string = '', topLevelItem: string = ''): void => {
      // Build location path
      const location = parentPath ? `${parentPath}.${item.displayName}` : item.displayName;

      // Track top-level item for grouping (e.g., "CacheManager", "Utilities")
      const currentTopLevel = topLevelItem || item.displayName;

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
          let severity: IssueSeverity = 'warning';
          if (
            item.kind === ApiItemKind.Class ||
            item.kind === ApiItemKind.Interface ||
            item.kind === ApiItemKind.Function
          ) {
            severity = 'error';
          }

          issues.push({
            severity,
            message: 'Missing documentation',
            location,
            filePath: currentTopLevel, // Use top-level item name for grouping
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
                  severity: 'warning',
                  message: `Parameter '${param.name}' missing description`,
                  location,
                  filePath: currentTopLevel,
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
                severity: 'warning',
                message: 'Missing @returns description',
                location,
                filePath: currentTopLevel,
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
              severity: 'info',
              message: 'Consider adding usage examples',
              location,
              filePath: currentTopLevel,
              apiItem: item
            });
          }
        }
      }

      // Recurse into members
      if ('members' in item) {
        for (const member of (item as any).members) {
          lintApiItem(member, location, currentTopLevel);
        }
      }
    };

    // Process all packages
    for (const apiPackage of apiModel.packages) {
      for (const entryPoint of apiPackage.entryPoints) {
        for (const member of entryPoint.members) {
          // Top-level items (classes, interfaces, functions, etc.)
          lintApiItem(member, '', member.displayName);
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
    issueGroups: Map<string, IssueMessage[]>,
    ungroupedIssues: IssueMessage[]
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

      // Convert ESLint results to grouped format
      for (const result of results) {
        if (result.messages.length === 0) continue;

        const filePath = result.filePath;

        for (const message of result.messages) {
          // Skip if no tsdoc-related message
          if (!message.ruleId || !message.ruleId.startsWith('tsdoc/')) {
            continue;
          }

          const severity: IssueSeverity =
            message.severity === 2
              ? 'error'
              : message.severity === 1
              ? 'warning'
              : 'info';

          const issue: IssueMessage = {
            text: `${message.message} (${message.ruleId})`,
            severity,
            line: message.line,
            column: message.column
          };

          if (!issueGroups.has(filePath)) {
            issueGroups.set(filePath, []);
          }
          issueGroups.get(filePath)!.push(issue);
        }
      }
    } catch (error) {
      // Silently skip ESLint if it fails (e.g., no TypeScript parser)
      clack.log.warn('ESLint analysis skipped (install @typescript-eslint/parser for TSDoc linting)');
    }
  }

  /**
   * Display lint issues using grouped format
   */
  private _displayIssues(
    issueGroups: Map<string, IssueMessage[]>,
    ungroupedIssues: IssueMessage[]
  ): void {
    // Count total issues and by severity
    let totalIssues = ungroupedIssues.length;
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const issues of issueGroups.values()) {
      totalIssues += issues.length;
      for (const issue of issues) {
        if (issue.severity === 'error') errorCount++;
        else if (issue.severity === 'warning') warningCount++;
        else if (issue.severity === 'info') infoCount++;
      }
    }

    for (const issue of ungroupedIssues) {
      if (issue.severity === 'error') errorCount++;
      else if (issue.severity === 'warning') warningCount++;
      else if (issue.severity === 'info') infoCount++;
    }

    if (totalIssues === 0) {
      console.log('\n' + Colorize.green('✓ No documentation issues found!'));
      clack.outro('Your documentation looks great!');
      return;
    }

    // Convert Map to IssueGroup array
    const groups: IssueGroup[] = Array.from(issueGroups.entries()).map(([filePath, issues]) => ({
      filePath,
      issues
    }));

    // Display grouped issues using IssueDisplayUtils
    IssueDisplayUtils.displayGroupedIssues(groups, ungroupedIssues);

    // Build and display summary
    const summaryLines: string[] = [Colorize.bold('\nSummary')];
    if (errorCount > 0) {
      summaryLines.push('  Errors:          ' + Colorize.red(errorCount.toString()));
    }
    if (warningCount > 0) {
      summaryLines.push('  Warnings:        ' + Colorize.yellow(warningCount.toString()));
    }
    if (infoCount > 0) {
      summaryLines.push('  Info:            ' + Colorize.cyan(infoCount.toString()));
    }

    clack.log.message(summaryLines.join('\n'));

    // Exit with error code if there are errors
    if (errorCount > 0) {
      clack.outro(Colorize.red(`Found ${errorCount} error(s). Fix these issues first.`));
      process.exitCode = 1;
    } else {
      clack.outro('Linting complete. Run `mint-tsdocs generate` to update documentation.');
    }
  }
}
