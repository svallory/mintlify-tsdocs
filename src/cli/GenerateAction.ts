// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as path from 'path';
import { FileSystem } from '@rushstack/node-core-library';
import { Colorize } from '@rushstack/terminal';
import { Extractor, ExtractorConfig, type ExtractorResult } from '@microsoft/api-extractor';
import { ApiModel } from '@microsoft/api-extractor-model';
import * as clack from '@clack/prompts';

import type { DocumenterCli } from './ApiDocumenterCommandLine';
import { CommandLineAction } from '@rushstack/ts-command-line';
import { MarkdownDocumenter } from '../documenters/MarkdownDocumenter';
import { type CommandLineFlagParameter } from '@rushstack/ts-command-line';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import { loadConfig, generateApiExtractorConfig } from '../config';
import { SecurityUtils } from '../utils/SecurityUtils';
import { ErrorBoundary } from '../errors/ErrorBoundary';
import { TsConfigValidator } from '../utils/TsConfigValidator';

/**
 * CLI action for generating Mintlify-compatible MDX documentation.
 *
 * This action:
 * 1. Loads unified config from mintlify-tsdocs.config.json (or package.json)
 * 2. Generates API Extractor and TSDoc configs in .tsdocs/ (cache directory)
 * 3. Runs api-extractor to generate .api.json files
 * 4. Converts .api.json files to MDX documentation with Mintlify integration
 *
 * @public
 */
export class GenerateAction extends CommandLineAction {
  /** Command-line flag to skip api-extractor execution */
  private readonly _skipExtractorParameter: CommandLineFlagParameter;

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
        'Loads configuration from mintlify-tsdocs.config.json (or package.json), ' +
        'runs api-extractor to generate .api.json files, then generates MDX documentation ' +
        'with Mintlify frontmatter and navigation integration.'
    });

    const cliInstance = parser;

    this._skipExtractorParameter = this.defineFlagParameter({
      parameterLongName: '--skip-extractor',
      description: 'Skip running api-extractor (use existing .api.json files in .tsdocs/)'
    });
  }

  /**
   * Executes the documentation generation process.
   *
   * This method:
   * 1. Loads unified config via cosmiconfig
   * 2. Creates .tsdocs/ directory if needed
   * 3. Generates api-extractor.json and tsdoc.json in .tsdocs/
   * 4. Runs api-extractor (unless --skip-extractor)
   * 5. Builds API model from .api.json files
   * 6. Generates MDX documentation
   *
   * @protected
   * @override
   */
  protected override async onExecuteAsync(): Promise<void> {
    // Step 1: Load configuration
    clack.log.info('Loading configuration...');
    const config = loadConfig(process.cwd());
    const projectDir = process.cwd();

    // Determine .tsdocs directory location
    const tsdocsDir = config.docsJson
      ? path.join(path.dirname(config.docsJson), '.tsdocs')
      : path.join(projectDir, 'docs', '.tsdocs');

    // Step 2: Ensure .tsdocs directory exists
    FileSystem.ensureFolder(tsdocsDir);

    // Step 3: Generate api-extractor.json in .tsdocs/
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
      clack.log.info(`Using custom api-extractor config: ${config.apiExtractor.configPath}`);

      // Read input folder from custom config
      const extractorConfig = ExtractorConfig.loadFileAndPrepare(customConfigPath);
      inputFolder = path.dirname(extractorConfig.apiJsonFilePath);
    } else {
      // Generate api-extractor.json
      const apiExtractorConfig = generateApiExtractorConfig(config, projectDir, tsdocsDir);
      FileSystem.writeFile(apiExtractorConfigPath, JSON.stringify(apiExtractorConfig, null, 2));
      clack.log.info('Generated .tsdocs/api-extractor.json');

      inputFolder = tsdocsDir;
    }

    // Step 4: Generate tsdoc.json in .tsdocs/
    const tsdocConfigPath = path.join(tsdocsDir, 'tsdoc.json');
    FileSystem.writeFile(tsdocConfigPath, JSON.stringify(config.tsdoc, null, 2));
    clack.log.info('Generated .tsdocs/tsdoc.json');

    // Step 5: Validate and compile TypeScript
    await this._validateAndCompileTypeScript(projectDir, config.apiExtractor.compiler?.tsconfigFilePath);

    // Step 6: Run api-extractor if not skipped
    if (!this._skipExtractorParameter.value) {
      await this._runApiExtractor(
        config.apiExtractor.configPath
          ? path.resolve(projectDir, config.apiExtractor.configPath)
          : apiExtractorConfigPath
      );
    } else {
      clack.log.warn('Skipping api-extractor (--skip-extractor flag set)');
    }

    // Step 7: Build API model from .api.json files
    const apiModel = this._buildApiModel(inputFolder);

    // Step 8: Generate documentation
    const markdownDocumenter: MarkdownDocumenter = new MarkdownDocumenter({
      apiModel,
      outputFolder: config.outputFolder,
      docsJsonPath: config.docsJson,
      tabName: config.tabName,
      groupName: config.groupName,
      enableMenu: false,
      convertReadme: config.convertReadme,
      readmeTitle: config.readmeTitle,
      templates: config.templates
    });

    markdownDocumenter.generateFiles();

    clack.log.success(`Documentation generated in ${config.outputFolder}`);
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
    // Find tsconfig.json
    let resolvedTsconfigPath = tsconfigPath
      ? path.resolve(projectDir, tsconfigPath)
      : TsConfigValidator.findTsConfig(projectDir);

    if (!resolvedTsconfigPath) {
      throw new DocumentationError(
        'No tsconfig.json found. TypeScript compilation is required to generate .d.ts files.',
        ErrorCode.FILE_NOT_FOUND
      );
    }

    // Validate configuration
    const validation = TsConfigValidator.validateTsConfig(resolvedTsconfigPath);
    const displayPath = TsConfigValidator.getDisplayPath(projectDir, resolvedTsconfigPath);

    if (!validation.hasDeclaration) {
      clack.log.error(
        `${displayPath} does not have "declaration: true" in compilerOptions.\nThis is required to generate .d.ts files.`
      );

      // Offer fixes
      const action = (await clack.select({
        message: 'How would you like to fix this?',
        options: [
          { value: 'fix', label: `Update ${displayPath} with "declaration: true"` },
          { value: 'extend', label: 'Create tsconfig.tsdocs.json (extends your config)' },
          { value: 'pick', label: 'Pick a different tsconfig.json file' },
          { value: 'abort', label: 'Abort generation' }
        ]
      })) as string;

      if (clack.isCancel(action) || action === 'abort') {
        throw new DocumentationError(
          'Cannot generate documentation without valid TypeScript configuration',
          ErrorCode.INVALID_CONFIGURATION
        );
      }

      let finalTsconfigPath = resolvedTsconfigPath;

      switch (action) {
        case 'fix':
          TsConfigValidator.fixTsConfig(resolvedTsconfigPath);
          clack.log.success(`Updated ${displayPath}`);
          break;

        case 'extend':
          finalTsconfigPath = TsConfigValidator.createExtendedTsConfig(projectDir, resolvedTsconfigPath);
          const extendedDisplayPath = TsConfigValidator.getDisplayPath(projectDir, finalTsconfigPath);
          clack.log.success(`Created ${extendedDisplayPath}`);
          break;

        case 'pick':
          const customPath = (await clack.text({
            message: 'Path to tsconfig.json:',
            placeholder: './tsconfig.build.json',
            validate: (value) => {
              const resolved = path.resolve(projectDir, value);
              if (!FileSystem.exists(resolved)) {
                return 'File does not exist';
              }
              const customValidation = TsConfigValidator.validateTsConfig(resolved);
              if (!customValidation.hasDeclaration) {
                return 'This tsconfig also does not have "declaration: true"';
              }
              return undefined;
            }
          })) as string;

          if (clack.isCancel(customPath)) {
            throw new DocumentationError(
              'Cannot generate documentation without valid TypeScript configuration',
              ErrorCode.INVALID_CONFIGURATION
            );
          }

          finalTsconfigPath = path.resolve(projectDir, customPath);
          clack.log.success(`Using ${TsConfigValidator.getDisplayPath(projectDir, finalTsconfigPath)}`);
          break;
      }

      // Update the path for compilation
      resolvedTsconfigPath = finalTsconfigPath;
    }

    // Compile TypeScript
    clack.log.info('Compiling TypeScript...');
    try {
      const { execSync } = await import('child_process');
      const tscCommand = `npx tsc --project ${resolvedTsconfigPath}`;

      execSync(tscCommand, {
        cwd: projectDir,
        stdio: 'inherit'
      });

      clack.log.success('TypeScript compilation completed');
    } catch (error) {
      throw new DocumentationError(
        `TypeScript compilation failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.COMMAND_FAILED
      );
    }
  }

  /**
   * Runs api-extractor to generate .api.json files
   *
   * @param configPath - Path to api-extractor.json
   * @private
   */
  private async _runApiExtractor(configPath: string): Promise<void> {
    clack.log.info('Running api-extractor...');

    try {
      // Load the config
      const extractorConfig: ExtractorConfig = ExtractorConfig.loadFileAndPrepare(configPath);

      // Run api-extractor
      const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
        localBuild: true,
        showVerboseMessages: false
      });

      if (extractorResult.succeeded) {
        clack.log.success('api-extractor completed successfully');
      } else {
        throw new DocumentationError(
          `api-extractor completed with ${extractorResult.errorCount} errors and ${extractorResult.warningCount} warnings`,
          ErrorCode.COMMAND_FAILED
        );
      }
    } catch (error) {
      if (error instanceof DocumentationError) {
        throw error;
      }
      throw new DocumentationError(
        `Failed to run api-extractor: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.COMMAND_FAILED
      );
    }
  }

  /**
   * Builds API model from .api.json files in the input folder
   *
   * @param inputFolder - Directory containing .api.json files
   * @returns The loaded API model
   * @private
   */
  private _buildApiModel(inputFolder: string): ApiModel {
    const errorBoundary = new ErrorBoundary({
      continueOnError: false,
      logErrors: true
    });

    const result = errorBoundary.executeSync(() => {
      const apiModel: ApiModel = new ApiModel();

      // Validate input folder
      const validatedInputFolder = SecurityUtils.validateCliInput(inputFolder, 'Input folder');

      if (!FileSystem.exists(validatedInputFolder)) {
        throw new DocumentationError(
          `The input folder does not exist: ${validatedInputFolder}`,
          ErrorCode.DIRECTORY_NOT_FOUND
        );
      }

      // Process API files
      const apiFiles = FileSystem.readFolderItemNames(validatedInputFolder);
      let loadedCount = 0;

      for (const filename of apiFiles) {
        if (!filename.match(/\.api\.json$/i)) {
          continue;
        }

        try {
          const safeFilename = SecurityUtils.validateFilename(filename);
          const filenamePath = SecurityUtils.validateFilePath(validatedInputFolder, safeFilename);

          clack.log.info(`Reading ${safeFilename}`);

          const fileContent = FileSystem.readFile(filenamePath);
          SecurityUtils.validateJsonContent(fileContent);

          apiModel.loadPackage(filenamePath);
          loadedCount++;
        } catch (error) {
          throw new DocumentationError(
            `Failed to load API package from ${filename}: ${error instanceof Error ? error.message : String(error)}`,
            ErrorCode.API_LOAD_ERROR
          );
        }
      }

      if (loadedCount === 0) {
        throw new DocumentationError(
          `No .api.json files found in input folder: ${validatedInputFolder}`,
          ErrorCode.API_LOAD_ERROR
        );
      }

      return apiModel;
    });

    // ErrorBoundary.executeSync returns the result or throws
    return result as unknown as ApiModel;
  }
}
