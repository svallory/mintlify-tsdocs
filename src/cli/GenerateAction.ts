import * as path from 'path';
import { FileSystem } from '@rushstack/node-core-library';
import { Extractor, ExtractorConfig, type ExtractorResult } from '@microsoft/api-extractor';
import { ApiModel } from '@microsoft/api-extractor-model';
import * as clack from '@clack/prompts';
import chalk from 'chalk';

import type { DocumenterCli } from './ApiDocumenterCommandLine';
import { CommandLineAction } from '@rushstack/ts-command-line';
import { MarkdownDocumenter } from '../documenters/MarkdownDocumenter';
import { BaseAction } from './BaseAction';
import { type CommandLineFlagParameter, type CommandLineStringParameter } from '@rushstack/ts-command-line';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import { loadConfig, generateApiExtractorConfig, findConfigPath } from '../config';
import { SecurityUtils } from '../utils/SecurityUtils';
import { ErrorBoundary } from '../errors/ErrorBoundary';
import { TsConfigValidator } from '../utils/TsConfigValidator';
import { showCliHeader } from './CliHelpers';
import * as GenerateHelp from './help/GenerateHelp';
import { IssueDisplayUtils, type IssueMessage, type IssueGroup } from './IssueDisplayUtils';
import { ApiExtractorService } from './services/ApiExtractorService';
import { TypeScriptCompiler } from './services/TypeScriptCompiler';
import { TsConfigHelper } from './helpers/TsConfigHelper';
import { S_BAR } from './utils/constants';

/**
 * CLI action for generating Mintlify-compatible MDX documentation.
 *
 * This action:
 * 1. Loads unified config from mint-tsdocs.config.json (or package.json)
 * 2. Generates API Extractor and TSDoc configs in .tsdocs/ (cache directory)
 * 3. Runs api-extractor to generate .api.json files
 * 4. Converts .api.json files to MDX documentation with Mintlify integration
 *
 * @see /cli-reference - CLI command documentation
 * @see /architecture/generation-layer - Generation workflow architecture
 *
 * @public
 */
export class GenerateAction extends BaseAction {
  /** Command-line flag to skip api-extractor execution */
  private readonly _skipExtractorParameter: CommandLineFlagParameter;

  /** Command-line flag to enable linting warnings */
  private readonly _lintParameter: CommandLineFlagParameter;

  /** Command-line flag to show verbose output */
  private readonly _verboseParameter: CommandLineFlagParameter;

  /** Project directory parameter (flag) */
  private readonly _projectDirParameter: CommandLineStringParameter;

  /** Reference to parent parser for running init if needed */
  public readonly parser: DocumenterCli;

  /**
   * Initializes the generate action with command-line parameters.
   *
   * @param parser - The parent CLI parser instance
   */
  public constructor(parser: DocumenterCli) {
    super({
      actionName: 'generate',
      summary: 'Generate Mintlify-compatible MDX documentation from TypeScript source',
      documentation:
        'Loads configuration from mint-tsdocs.config.json (or package.json), ' +
        'runs api-extractor to generate .api.json files, then generates MDX documentation ' +
        'with Mintlify frontmatter and navigation integration.\n\n' +
        'Usage:\n' +
        '  mint-tsdocs generate [PROJECT_DIR]\n' +
        '  mint-tsdocs [PROJECT_DIR]  (shorthand)\n\n' +
        'Examples:\n' +
        '  mint-tsdocs generate\n' +
        '  mint-tsdocs generate ./packages/my-lib\n' +
        '  mint-tsdocs ./packages/my-lib'
    });

    this.parser = parser;

    this._projectDirParameter = this.defineStringParameter({
      parameterLongName: '--project-dir',
      argumentName: 'PATH',
      description: 'Project directory containing mint-tsdocs.config.json (default: current directory)'
    });

    this._skipExtractorParameter = this.defineFlagParameter({
      parameterLongName: '--skip-extractor',
      description: 'Skip running api-extractor (use existing .api.json files in .tsdocs/)'
    });

    this._lintParameter = this.defineFlagParameter({
      parameterLongName: '--lint',
      description: 'Show API Extractor linting warnings and suggestions'
    });

    this._verboseParameter = this.defineFlagParameter({
      parameterLongName: '--verbose',
      parameterShortName: '-v',
      description: 'Show detailed output including component installation progress'
    });

    // Define remainder to accept positional project directory argument
    this.defineCommandLineRemainder({
      description: 'Optional project directory path'
    });
  }

  /**
   * Executes the documentation generation process.
   *
   * This method:
   * 1. Loads unified config via cosmiconfig
   * 2. Invalidates cache if config is newer than .tsdocs/
   * 3. Creates .tsdocs/ directory if needed
   * 4. Generates api-extractor.json and tsdoc.json in .tsdocs/
   * 5. Validates tsdoc.json configuration
   * 6. Validates and compiles TypeScript
   * 7. Runs api-extractor (unless --skip-extractor)
   * 8. Builds API model from .api.json files
   * 9. Generates MDX documentation
   *
   * @protected
   * @override
   */
  protected override async onExecuteAsync(): Promise<void> {
    // Check if --help was requested (check process.argv since ts-command-line intercepts it)
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      GenerateHelp.showHelp();
      return;
    }

    // Determine project directory from either positional arg (remainder) or flag
    let projectDir: string;

    if (this.remainder && this.remainder.values.length > 0 && !this.remainder.values[0].startsWith('-')) {
      // Use first positional argument as project directory (if not a flag)
      const rawPath = this.remainder.values[0];
      SecurityUtils.validateCliInput(rawPath, 'Project directory');
      projectDir = path.resolve(process.cwd(), rawPath);
    } else if (this._projectDirParameter.value) {
      // Use --project-dir flag
      const rawPath = this._projectDirParameter.value;
      SecurityUtils.validateCliInput(rawPath, 'Project directory');
      projectDir = path.resolve(process.cwd(), rawPath);
    } else {
      // Default to current directory
      projectDir = process.cwd();
    }

    showCliHeader();

    // Change to project directory
    const originalCwd = process.cwd();
    if (projectDir !== originalCwd) {
      clack.log.info(`Using project directory: ${projectDir}`);
      process.chdir(projectDir);
    }

    try {
      // Step 1: Load configuration
      let config;
      try {
        config = loadConfig(projectDir);
      } catch (error) {
        // If config not found, prompt to run init
        if (error instanceof DocumentationError && error.code === ErrorCode.CONFIG_NOT_FOUND) {
          clack.log.error('No mint-tsdocs configuration found.');

          const shouldInit = await clack.confirm({
            message: 'Would you like to initialize mint-tsdocs now?',
            initialValue: true
          });

          if (clack.isCancel(shouldInit) || !shouldInit) {
            throw new DocumentationError(
              'Cannot generate documentation without configuration. Run "mint-tsdocs init" to create a configuration file.',
              ErrorCode.CONFIG_NOT_FOUND
            );
          }

          // Run init action
          const initSpinner = clack.spinner();
          initSpinner.start('Initializing mint-tsdocs');
          try {
            const { InitAction } = await import('./InitAction.js');
            const initAction = new InitAction(this.parser as any);
            await initAction.onExecuteAsync();
            initSpinner.stop('Initialization complete');
          } catch (initError) {
            initSpinner.stop('Initialization failed');
            throw initError;
          }

          // Load config after init
          config = loadConfig(projectDir);
        } else {
          throw error;
        }
      }

      // Determine .tsdocs directory location
      const tsdocsDir = config.docsJson
        ? path.join(path.dirname(config.docsJson), '.tsdocs')
        : path.join(projectDir, 'docs', '.tsdocs');

      // Step 2: Check if config file is newer than cache - invalidate if so
      const configPath = findConfigPath(projectDir);
      if (configPath && FileSystem.exists(tsdocsDir)) {
        const configStats = FileSystem.getStatistics(configPath);
        const cacheStats = FileSystem.getStatistics(tsdocsDir);

        if (configStats.mtime > cacheStats.mtime) {
          if (this._verboseParameter.value) {
            clack.log.info('Configuration updated - invalidating cache...');
          }
          FileSystem.deleteFolder(tsdocsDir);
          if (this._verboseParameter.value) {
            clack.log.success('Cache invalidated');
          }
        }
      }

      // Step 3: Ensure .tsdocs directory exists
      FileSystem.ensureFolder(tsdocsDir);

      // Step 4: Generate api-extractor.json in .tsdocs/
      const apiExtractorConfigPath = path.join(tsdocsDir, 'api-extractor.json');
      let inputFolder: string;

      if (config.apiExtractor.configPath) {
        // Use custom api-extractor.json
        const customConfigPath = path.resolve(projectDir, config.apiExtractor.configPath);
        if (!FileSystem.exists(customConfigPath)) {
          throw new DocumentationError(
            `Custom api-extractor config not found: ${customConfigPath}`,
            ErrorCode.FILE_NOT_FOUND
          );
        }
        if (this._verboseParameter.value) {
          clack.log.info(`Using custom api-extractor config: ${config.apiExtractor.configPath}`);
        }

        // Read input folder from custom config
        const extractorConfig = ExtractorConfig.loadFileAndPrepare(customConfigPath);
        inputFolder = path.dirname(extractorConfig.apiJsonFilePath);
      } else {
        // Generate api-extractor.json
        // By default, suppress lint warnings unless --lint is passed
        const apiExtractorConfig = generateApiExtractorConfig(
          config,
          projectDir,
          tsdocsDir,
          !this._lintParameter.value // Invert: suppress when lint is NOT enabled
        );
        FileSystem.writeFile(apiExtractorConfigPath, JSON.stringify(apiExtractorConfig, null, 2));
        if (this._verboseParameter.value) {
          clack.log.info('Generated .tsdocs/api-extractor.json');
        }

        if (this._verboseParameter.value && this._lintParameter.value) {
          clack.log.info('Linting enabled (--lint flag set)');
        }

        inputFolder = tsdocsDir;
      }

      // Step 5: Validate tsdoc.json exists and is correctly configured
      this._validateTsDocConfig(projectDir);

      // Step 6: Validate and compile TypeScript
      await this._validateAndCompileTypeScript(projectDir, config.apiExtractor.compiler?.tsconfigFilePath);

      // Step 7: Run api-extractor if not skipped
      if (!this._skipExtractorParameter.value) {
        await this._runApiExtractor(
          config.apiExtractor.configPath
            ? path.resolve(projectDir, config.apiExtractor.configPath)
            : apiExtractorConfigPath
        );
      } else {
        clack.log.warn('Skipping api-extractor (--skip-extractor flag set)');
      }

      // Step 8: Build API model from .api.json files
      const { apiModel } = this.buildApiModel(inputFolder);

      // Step 9: Generate documentation
      const markdownDocumenter: MarkdownDocumenter = new MarkdownDocumenter({
        apiModel,
        outputFolder: config.outputFolder,
        docsJsonPath: config.docsJson,
        tabName: config.tabName,
        groupName: config.groupName,
        enableMenu: false,
        convertReadme: config.convertReadme,
        readmeTitle: config.readmeTitle,
        templates: config.templates,
        verbose: this._verboseParameter.value
      });

      // const generateSpinner = clack.spinner();

      try {
        await markdownDocumenter.generateFiles();
        clack.log.success(`Generation completed`);
      } catch (generateError) {
        clack.log.error('Generation failed');
        throw generateError;
      }

      // Calculate Mintlify project root (where mint.json is)
      const mintProjectRoot = config.docsJson
        ? path.dirname(config.docsJson)
        : path.join(projectDir, 'docs');

      // Make path relative to CWD for better readability
      const relativeMintRoot = path.relative(process.cwd(), mintProjectRoot);
      const cdCommand = relativeMintRoot ? `cd ${relativeMintRoot} && ` : '';

      clack.outro(`Run ${chalk.cyan(`${cdCommand}mint dev`)} to view the documentation`);
    } finally {
      // Restore original working directory
      if (projectDir !== originalCwd) {
        process.chdir(originalCwd);
      }
    }
  }

  /**
   * Validate tsdoc.json exists and has required configuration
   * @param projectDir - Project directory
   * @private
   */
  private _validateTsDocConfig(projectDir: string): void {
    const tsdocPath = path.join(projectDir, 'tsdoc.json');

    if (!FileSystem.exists(tsdocPath)) {
      clack.log.error('tsdoc.json not found at project root');
      clack.log.info('Run ' + chalk.cyan('mint-tsdocs init') + ' to create it');
      throw new DocumentationError(
        'tsdoc.json is required for API Extractor to recognize custom TSDoc tags',
        ErrorCode.CONFIG_NOT_FOUND
      );
    }

    try {
      const content = FileSystem.readFile(tsdocPath);
      const config = SecurityUtils.parseJsonSafe(content);

      // Check for required base extension
      if (!config.extends || !config.extends.includes('@microsoft/api-extractor/extends/tsdoc-base.json')) {
        clack.log.warn('tsdoc.json must extend "@microsoft/api-extractor/extends/tsdoc-base.json"');
        clack.log.info('Run ' + chalk.cyan('mint-tsdocs init') + ' again to update it');
      }
    } catch (error) {
      throw new DocumentationError(
        `Failed to parse tsdoc.json: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.INVALID_CONFIGURATION
      );
    }
  }

  /**
   * Validate TypeScript configuration and compile
   *
   * @param projectDir - Project directory
   * @param tsconfigPath - Path to tsconfig.json from config
   * @private
   */
  private async _validateAndCompileTypeScript(
    projectDir: string,
    tsconfigPath?: string
  ): Promise<void> {
    const spinner = clack.spinner();

    try {
      // Validate tsconfig
      spinner.start('Validating TypeScript configuration');
      const validation = await TsConfigHelper.validateAndFix({
        projectDir,
        tsconfigPath,
        interactive: true // GenerateAction is always interactive
      });
      spinner.stop('TypeScript configuration validated');

      // Compile TypeScript
      spinner.start('Compiling TypeScript');

      const { execFileSync } = await import('child_process');

      // Use execFileSync with array arguments to prevent command injection
      execFileSync('npx', ['tsc', '--project', validation.tsconfigPath], {
        cwd: projectDir,
        stdio: 'inherit'
      });

      // Copy custom .d.ts files to preserve type definitions that shouldn't be auto-generated
      // This is necessary because TypeScript auto-generates .d.ts for .jsx files,
      // but we have custom type definitions in src/components/*.d.ts
      const componentsSrc = path.join(projectDir, 'src', 'components');
      const componentsDest = path.join(projectDir, 'lib', 'components');
      if (FileSystem.exists(componentsSrc)) {
        const customDtsFiles = FileSystem.readFolderItemNames(componentsSrc)
          .filter(f => f.endsWith('.d.ts'));

        for (const dtsFile of customDtsFiles) {
          const srcPath = path.join(componentsSrc, dtsFile);
          const destPath = path.join(componentsDest, dtsFile);
          FileSystem.copyFile({
            sourcePath: srcPath,
            destinationPath: destPath
          });
        }
      }

      spinner.stop('TypeScript compilation completed');
    } catch (error) {
      spinner.stop('Validation/compilation failed');
      throw error;
    }
  }

  /**
   * Runs api-extractor to generate .api.json files
   *
   * @param configPath - Path to api-extractor.json
   * @private
   */
  private async _runApiExtractor(configPath: string): Promise<void> {
    const extractorSpinner = clack.spinner();
    extractorSpinner.start('Running api-extractor');

    // Group warnings/errors by file for cleaner display
    const issueGroups: Map<string, IssueMessage[]> = new Map();
    const ungroupedIssues: IssueMessage[] = [];

    try {
      const result = await ApiExtractorService.run({
        configPath,
        suppressConsole: true,
        showVerboseMessages: false,
        messageHandler: (message) => {
          // Skip messages that have been suppressed (logLevel: 'none')
          if (message.logLevel === 'none') {
            return;
          }

          // When lint is disabled (default), only show errors, not warnings
          const isError = message.logLevel === 'error';
          if (!this._lintParameter.value && !isError) {
            return;
          }

          // Create issue message with normalized severity
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

      // Display grouped messages after extraction
      const groups: IssueGroup[] = Array.from(issueGroups.entries()).map(([filePath, issues]) => ({
        filePath,
        issues
      }));
      IssueDisplayUtils.displayGroupedIssues(groups, ungroupedIssues);

      if (result.succeeded) {
        extractorSpinner.stop('API extraction completed');
      } else {
        extractorSpinner.stop('API extraction completed with errors');
        throw new DocumentationError(
          `API extraction completed with ${result.errorCount} errors and ${result.warningCount} warnings`,
          ErrorCode.COMMAND_FAILED
        );
      }
    } catch (error) {
      extractorSpinner.stop('API extraction failed');
      if (error instanceof DocumentationError) {
        throw error;
      }
      throw new DocumentationError(
        `Failed to run API extraction: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.COMMAND_FAILED
      );
    }
  }
}
