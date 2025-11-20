import * as path from 'path';
import * as child_process from 'child_process';
import { FileSystem } from '@rushstack/node-core-library';
import {
  type CommandLineStringParameter,
  type CommandLineFlagParameter,
  CommandLineAction
} from '@rushstack/ts-command-line';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';

import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import type { DocumenterCli } from './ApiDocumenterCommandLine';
import type { MintlifyTsDocsConfig } from '../config';
import { TsConfigValidator } from '../utils/TsConfigValidator';
import { showCliHeader } from './CliHelpers';
import * as InitHelp from './help/InitHelp';

/**
 * CLI action to initialize a new project with mint-tsdocs configuration
 *
 * This action creates a single mint-tsdocs.config.json file at the project root
 * with auto-detected values. The .tsdocs/ directory is used only for cache/generated files.
 */
export class InitAction extends CommandLineAction {
  private readonly _cliInstance: DocumenterCli;
  private readonly _projectDirParameter: CommandLineStringParameter;
  private readonly _skipMintlifyParameter: CommandLineFlagParameter;
  private readonly _yesParameter: CommandLineFlagParameter;

  public constructor(cliInstance: DocumenterCli) {
    super({
      actionName: 'init',
      summary: 'Initialize mint-tsdocs configuration',
      documentation:
        'Creates mint-tsdocs.config.json with auto-detected settings. ' +
        'Optionally initializes Mintlify (mint new) if not already set up.'
    });

    this._cliInstance = cliInstance;

    this._projectDirParameter = this.defineStringParameter({
      parameterLongName: '--project-dir',
      parameterShortName: '-p',
      argumentName: 'DIRECTORY',
      description: 'Project directory to initialize (default: current directory)'
    });

    this._skipMintlifyParameter = this.defineFlagParameter({
      parameterLongName: '--skip-mintlify',
      description: 'Skip Mintlify initialization (assume already set up)'
    });

    this._yesParameter = this.defineFlagParameter({
      parameterLongName: '--yes',
      parameterShortName: '-y',
      description: 'Use auto-detected defaults for all prompts'
    });
  }

  public override async onExecuteAsync(): Promise<void> {
    // Check if --help was requested (check process.argv since ts-command-line intercepts it)
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      InitHelp.showHelp();
      return;
    }

    const useDefaults = this._yesParameter.value;

    showCliHeader();
    if (!useDefaults) {
      console.log('\n' + Colorize.bold("Let's setup mint-tsdocs for your project!"));
    }

    const projectDir = this._projectDirParameter.value || process.cwd();
    const absoluteProjectDir = path.resolve(projectDir);

    try {
      // Ensure project directory exists
      if (!FileSystem.exists(absoluteProjectDir)) {
        throw new DocumentationError(
          `Project directory does not exist: ${absoluteProjectDir}`,
          ErrorCode.DIRECTORY_NOT_FOUND
        );
      }

      // Check for package.json
      const packageJsonPath = path.join(absoluteProjectDir, 'package.json');
      if (!FileSystem.exists(packageJsonPath)) {
        throw new DocumentationError(
          'No package.json found. Please run this command in a Node.js project.',
          ErrorCode.FILE_NOT_FOUND
        );
      }

      // Check if config already exists
      const configPath = path.join(absoluteProjectDir, 'mint-tsdocs.config.json');
      if (FileSystem.exists(configPath)) {
        if (!useDefaults) {
          const shouldOverwrite = await clack.confirm({
            message: 'mint-tsdocs.config.json already exists. Overwrite?',
            initialValue: false
          });

          if (clack.isCancel(shouldOverwrite) || !shouldOverwrite) {
            clack.cancel('Operation cancelled');
            process.exit(0);
          }
        } else {
          clack.log.warn('Config file already exists, skipping');
          return;
        }
      }

      // Auto-detect or prompt for entry point
      const entryPoint = await this._detectOrPromptEntryPoint(absoluteProjectDir, packageJsonPath, useDefaults);

      // Validate TypeScript configuration
      const tsconfigPath = await this._validateAndFixTsConfig(absoluteProjectDir, useDefaults);

      // Initialize or detect Mintlify
      let docsJsonPath: string | undefined;
      if (!this._skipMintlifyParameter.value) {
        docsJsonPath = await this._setupMintlify(absoluteProjectDir, useDefaults);
      } else {
        docsJsonPath = this._detectDocsJson(absoluteProjectDir);
      }

      // Determine output folder
      const docsDir = docsJsonPath ? path.dirname(docsJsonPath) : path.join(absoluteProjectDir, 'docs');
      const defaultOutputFolder = path.join(docsDir, 'reference');

      const outputFolder = useDefaults
        ? defaultOutputFolder
        : await this._promptOutputFolder(absoluteProjectDir, defaultOutputFolder);

      // Prompt for navigation settings if docs.json exists
      let tabName: string | undefined;
      let groupName: string | undefined;

      if (docsJsonPath) {
        if (!useDefaults) {
          tabName = (await clack.text({
            message: 'Tab name in Mintlify navigation?',
            placeholder: 'Code Reference',
            defaultValue: 'Code Reference'
          })) as string;

          if (clack.isCancel(tabName)) {
            clack.cancel('Operation cancelled');
            process.exit(0);
          }

          // Read package name for default group name
          const packageJson = JSON.parse(FileSystem.readFile(packageJsonPath));
          const packageName = packageJson.name || 'API';

          groupName = (await clack.text({
            message: 'Group name for sidebar (used when multiple projects share a site)',
            placeholder: packageName,
            defaultValue: packageName,
            validate: (value) => {
              if (!value || value.trim() === '') {
                return 'Group name cannot be empty';
              }
              return undefined;
            }
          })) as string;

          if (clack.isCancel(groupName)) {
            clack.cancel('Operation cancelled');
            process.exit(0);
          }
        } else {
          // Read package name for default group name
          const packageJson = JSON.parse(FileSystem.readFile(packageJsonPath));
          tabName = 'API Reference';
          groupName = packageJson.name || 'API';
        }
      }

      // Create config
      await this._createConfig(absoluteProjectDir, {
        entryPoint: path.relative(absoluteProjectDir, entryPoint),
        outputFolder: path.relative(absoluteProjectDir, outputFolder),
        docsJson: docsJsonPath ? path.relative(absoluteProjectDir, docsJsonPath) : undefined,
        tabName,
        groupName,
        apiExtractor: {
          compiler: {
            tsconfigFilePath: tsconfigPath ? path.relative(absoluteProjectDir, tsconfigPath) : undefined
          }
        }
      });

      // Create tsdoc.json at project root
      this._createTsDocConfig(absoluteProjectDir);

      // Configure MDX support in VS Code and tsconfig
      await this._configureMdxSupport(absoluteProjectDir, useDefaults);

      // Create .tsdocs directory and README
      const tsdocsDir = path.join(docsDir, '.tsdocs');
      FileSystem.ensureFolder(tsdocsDir);
      this._createTsdocsReadme(tsdocsDir);

      // Update .gitignore
      this._updateGitignore(absoluteProjectDir, path.relative(absoluteProjectDir, tsdocsDir));

      clack.outro(Colorize.green('✓ Configuration created successfully!'));

      // Auto-add mint-tsdocs script to package.json if needed
      const scriptAdded = this._addScriptToPackageJson(packageJsonPath);

      const nextSteps = `${Colorize.bold('Next steps:')}
${Colorize.cyan('  Run: mint-tsdocs generate')}

${Colorize.dim('(TypeScript will be compiled automatically)')}${scriptAdded ? `

${Colorize.bold('📋 Added to package.json:')}
${Colorize.cyan('  "mint-tsdocs": "mint-tsdocs generate"')}` : ''}`;

      clack.note(nextSteps);

    } catch (error) {
      if (error instanceof DocumentationError) {
        clack.log.error(error.message);
        process.exit(1);
      }
      throw error;
    }
  }

  /**
   * Auto-detect or prompt for TypeScript entry point
   */
  private async _detectOrPromptEntryPoint(
    projectDir: string,
    packageJsonPath: string,
    useDefaults: boolean
  ): Promise<string> {
    // Try to auto-detect from package.json
    const packageJson = JSON.parse(FileSystem.readFile(packageJsonPath));

    if (packageJson.types) {
      const entryPoint = path.resolve(projectDir, packageJson.types);
      if (FileSystem.exists(entryPoint)) {
        clack.log.success(`Found entry point from package.json: ${packageJson.types}`);
        return entryPoint;
      }
    }

    if (packageJson.typings) {
      const entryPoint = path.resolve(projectDir, packageJson.typings);
      if (FileSystem.exists(entryPoint)) {
        clack.log.success(`Found entry point from package.json: ${packageJson.typings}`);
        return entryPoint;
      }
    }

    // Try common paths
    const commonPaths = ['./lib/index.d.ts', './dist/index.d.ts', './build/index.d.ts'];
    for (const commonPath of commonPaths) {
      const entryPoint = path.resolve(projectDir, commonPath);
      if (FileSystem.exists(entryPoint)) {
        clack.log.success(`Found entry point: ${commonPath}`);
        return entryPoint;
      }
    }

    // Couldn't auto-detect
    if (useDefaults) {
      throw new DocumentationError(
        `Could not auto-detect TypeScript entry point. Tried:\n  - package.json types/typings field\n  - ${commonPaths.join('\n  - ')}`,
        ErrorCode.FILE_NOT_FOUND
      );
    }

    // Prompt user
    const entryPointInput = await clack.text({
      message: 'Path to your TypeScript declaration file (.d.ts)?',
      placeholder: './lib/index.d.ts',
      validate: (value) => {
        if (!value) return 'Entry point is required';
        const absolutePath = path.resolve(projectDir, value);
        if (!FileSystem.exists(absolutePath)) {
          return `File not found: ${value}`;
        }
        if (!value.endsWith('.d.ts')) {
          return 'Must be a TypeScript declaration file (.d.ts)';
        }
        return undefined;
      }
    });

    if (clack.isCancel(entryPointInput)) {
      clack.cancel('Operation cancelled');
      process.exit(0);
    }

    return path.resolve(projectDir, entryPointInput as string);
  }

  /**
   * Validate TypeScript configuration and fix if needed
   */
  private async _validateAndFixTsConfig(
    projectDir: string,
    useDefaults: boolean
  ): Promise<string | undefined> {
    // Find tsconfig.json
    const tsconfigPath = TsConfigValidator.findTsConfig(projectDir);

    if (!tsconfigPath) {
      clack.log.warn('No tsconfig.json found - TypeScript compilation may fail');
      return undefined;
    }

    // Validate configuration
    const validation = TsConfigValidator.validateTsConfig(tsconfigPath);
    const displayPath = TsConfigValidator.getDisplayPath(projectDir, tsconfigPath);

    if (validation.hasDeclaration) {
      clack.log.success(`TypeScript config valid: ${displayPath}`);
      return tsconfigPath;
    }

    // Config is invalid - offer fixes
    clack.log.warn(
      `${displayPath} does not have "declaration: true" in compilerOptions.\nThis is required to generate .d.ts files.`
    );

    if (useDefaults) {
      // Auto-fix in default mode
      TsConfigValidator.fixTsConfig(tsconfigPath);
      clack.log.success(`Updated ${displayPath} with "declaration: true"`);
      return tsconfigPath;
    }

    // Prompt for fix action
    const action = (await clack.select({
      message: 'How would you like to fix this?',
      options: [
        { value: 'fix', label: `Update ${displayPath} with "declaration: true"` },
        { value: 'extend', label: 'Create tsconfig.tsdocs.json (extends your config)' },
        { value: 'pick', label: 'Pick a different tsconfig.json file' },
        { value: 'abort', label: 'Skip (may cause errors during generation)' }
      ]
    })) as string;

    if (clack.isCancel(action)) {
      clack.cancel('Operation cancelled');
      process.exit(0);
    }

    switch (action) {
      case 'fix':
        TsConfigValidator.fixTsConfig(tsconfigPath);
        clack.log.success(`Updated ${displayPath}`);
        return tsconfigPath;

      case 'extend':
        const extendedPath = TsConfigValidator.createExtendedTsConfig(projectDir, tsconfigPath);
        const extendedDisplayPath = TsConfigValidator.getDisplayPath(projectDir, extendedPath);
        clack.log.success(`Created ${extendedDisplayPath}`);
        return extendedPath;

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
          clack.cancel('Operation cancelled');
          process.exit(0);
        }

        const resolvedCustomPath = path.resolve(projectDir, customPath);
        clack.log.success(`Using ${TsConfigValidator.getDisplayPath(projectDir, resolvedCustomPath)}`);
        return resolvedCustomPath;

      case 'abort':
        clack.log.warn('Skipping TypeScript config validation');
        return tsconfigPath;

      default:
        return tsconfigPath;
    }
  }

  /**
   * Detect docs.json in common locations
   */
  private _detectDocsJson(projectDir: string): string | undefined {
    const commonPaths = ['./docs.json', './docs/docs.json', './documentation/docs.json'];

    for (const commonPath of commonPaths) {
      const docsJsonPath = path.resolve(projectDir, commonPath);
      if (FileSystem.exists(docsJsonPath)) {
        clack.log.success(`Found docs.json: ${commonPath}`);
        return docsJsonPath;
      }
    }

    return undefined;
  }

  /**
   * Setup or detect Mintlify
   */
  private async _setupMintlify(projectDir: string, useDefaults: boolean): Promise<string | undefined> {
    // Check if docs.json exists
    const existingDocsJson = this._detectDocsJson(projectDir);
    if (existingDocsJson) {
      return existingDocsJson;
    }

    // Ask if they want to initialize Mintlify
    if (!useDefaults) {
      const shouldInit = await clack.confirm({
        message: 'Initialize Mintlify documentation?',
        initialValue: true
      });

      if (clack.isCancel(shouldInit)) {
        clack.cancel('Operation cancelled');
        process.exit(0);
      }

      if (!shouldInit) {
        return undefined;
      }
    } else {
      clack.log.info('Skipping Mintlify initialization (use --skip-mintlify to suppress this)');
      return undefined;
    }

    // Prompt for docs directory
    const docsDirInput = await clack.text({
      message: 'Where should Mintlify docs be located?',
      placeholder: './docs',
      defaultValue: './docs'
    });

    if (clack.isCancel(docsDirInput)) {
      clack.cancel('Operation cancelled');
      process.exit(0);
    }

    const docsDir = path.resolve(projectDir, docsDirInput as string);
    const docsDirExists = FileSystem.exists(docsDir);

    // If directory exists, ask what to do
    if (docsDirExists) {
      const choice = await clack.select({
        message: `Directory "${docsDirInput}" already exists. What would you like to do?`,
        options: [
          { value: 'keep', label: 'Initialize Mintlify (keep existing files)' },
          { value: 'delete', label: 'Delete directory and reinitialize' },
          { value: 'cancel', label: 'Cancel operation' }
        ]
      });

      if (clack.isCancel(choice) || choice === 'cancel') {
        clack.cancel('Operation cancelled');
        process.exit(0);
      }

      if (choice === 'delete') {
        clack.log.info(`Deleting existing directory: ${docsDirInput}`);
        FileSystem.deleteFolder(docsDir);
      }
    }

    // Run mint new
    const relativeDocsDir = path.relative(projectDir, docsDir);
    await this._runCommand(
      'mint',
      ['new', relativeDocsDir],
      projectDir,
      'Initializing Mintlify',
      { forceInteractive: true }
    );

    // Return docs.json path
    return path.join(docsDir, 'docs.json');
  }

  /**
   * Prompt for output folder
   */
  private async _promptOutputFolder(projectDir: string, defaultPath: string): Promise<string> {
    const relativePath = path.relative(projectDir, defaultPath);
    const outputFolderInput = await clack.text({
      message: 'Where should the TypeScript reference be generated?',
      placeholder: relativePath,
      defaultValue: relativePath
    });

    if (clack.isCancel(outputFolderInput)) {
      clack.cancel('Operation cancelled');
      process.exit(0);
    }

    return path.resolve(projectDir, outputFolderInput as string);
  }

  /**
   * Create mint-tsdocs.config.json
   */
  private async _createConfig(
    projectDir: string,
    config: Partial<MintlifyTsDocsConfig>
  ): Promise<void> {
    const configPath = path.join(projectDir, 'mint-tsdocs.config.json');

    const fullConfig: MintlifyTsDocsConfig = {
      $schema: './node_modules/mint-tsdocs/lib/schemas/config.schema.json',
      entryPoint: config.entryPoint,
      outputFolder: config.outputFolder,
      ...(config.docsJson && { docsJson: config.docsJson }),
      ...(config.tabName && { tabName: config.tabName }),
      ...(config.groupName && { groupName: config.groupName })
    };

    FileSystem.writeFile(configPath, JSON.stringify(fullConfig, null, 2));
    clack.log.success('Created mint-tsdocs.config.json');
  }

  /**
   * Create or update tsdoc.json at project root
   */
  private _createTsDocConfig(projectDir: string): void {
    const tsdocPath = path.join(projectDir, 'tsdoc.json');

    const requiredConfig = {
      $schema: 'https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json',
      extends: ['@microsoft/api-extractor/extends/tsdoc-base.json'],
      tagDefinitions: [
        {
          tagName: '@default',
          syntaxKind: 'block',
          allowMultiple: false
        }
      ],
      supportForTags: {
        '@default': true
      }
    };

    // If file doesn't exist, create it
    if (!FileSystem.exists(tsdocPath)) {
      FileSystem.writeFile(tsdocPath, JSON.stringify(requiredConfig, null, 2));
      clack.log.success('Created tsdoc.json');
      return;
    }

    // File exists - validate and potentially update it
    try {
      const existingContent = FileSystem.readFile(tsdocPath);
      const existing = JSON.parse(existingContent);
      const updates: string[] = [];

      // Check 1: Must extend tsdoc-base.json
      if (!existing.extends || !existing.extends.includes('@microsoft/api-extractor/extends/tsdoc-base.json')) {
        updates.push('- Add extends: ["@microsoft/api-extractor/extends/tsdoc-base.json"]');
        existing.extends = existing.extends || [];
        if (!existing.extends.includes('@microsoft/api-extractor/extends/tsdoc-base.json')) {
          existing.extends.unshift('@microsoft/api-extractor/extends/tsdoc-base.json');
        }
      }

      // Check 2: Should have @default tag definition
      const hasDefaultTag = existing.tagDefinitions?.some((tag: any) => tag.tagName === '@default');
      if (!hasDefaultTag) {
        updates.push('- Add @default tag definition');
        existing.tagDefinitions = existing.tagDefinitions || [];
        existing.tagDefinitions.push({
          tagName: '@default',
          syntaxKind: 'block',
          allowMultiple: false
        });
      }

      // Check 3: Should have @default tag support
      if (!existing.supportForTags || !existing.supportForTags['@default']) {
        updates.push('- Enable @default tag support');
        existing.supportForTags = existing.supportForTags || {};
        existing.supportForTags['@default'] = true;
      }

      // Check 4: Should have $schema for IDE support
      if (!existing.$schema) {
        updates.push('- Add $schema for IDE autocomplete');
        existing.$schema = 'https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json';
      }

      // If updates are needed, write the file
      if (updates.length > 0) {
        clack.log.warn('tsdoc.json exists but is missing required configuration:');
        updates.forEach(update => clack.log.info('  ' + update));
        FileSystem.writeFile(tsdocPath, JSON.stringify(existing, null, 2));
        clack.log.success('Updated tsdoc.json with required configuration');
      } else {
        clack.log.info('tsdoc.json already exists with correct configuration');
      }
    } catch (error) {
      clack.log.warn('Could not parse existing tsdoc.json - creating new one');
      FileSystem.writeFile(tsdocPath, JSON.stringify(requiredConfig, null, 2));
      clack.log.success('Created tsdoc.json');
    }
  }

  /**
   * Configure MDX support in VS Code and tsconfig.json
   */
  private async _configureMdxSupport(projectDir: string, useDefaults: boolean): Promise<void> {
    // Find tsconfig.json
    const tsconfigPath = TsConfigValidator.findTsConfig(projectDir);

    if (!tsconfigPath) {
      clack.log.warn('No tsconfig.json found - skipping MDX configuration');
      return;
    }

    // Ask for permission to update settings
    const shouldConfigure = useDefaults || await clack.confirm({
      message: 'Configure VS Code and TypeScript for MDX support?',
      initialValue: true
    });

    if (clack.isCancel(shouldConfigure) || !shouldConfigure) {
      return;
    }

    // Update .vscode/settings.json
    this._updateVSCodeSettings(projectDir);

    // Update tsconfig.json with MDX settings
    this._updateTsConfigForMdx(projectDir, tsconfigPath);
  }

  /**
   * Update .vscode/settings.json to enable MDX language server
   */
  private _updateVSCodeSettings(projectDir: string): void {
    const vscodeDir = path.join(projectDir, '.vscode');
    const settingsPath = path.join(vscodeDir, 'settings.json');

    try {
      // Ensure .vscode directory exists
      FileSystem.ensureFolder(vscodeDir);

      let settings: any = {};

      // Read existing settings if they exist
      if (FileSystem.exists(settingsPath)) {
        try {
          const content = FileSystem.readFile(settingsPath);
          settings = JSON.parse(content);
        } catch (error) {
          clack.log.warn('Could not parse existing .vscode/settings.json - will create new one');
        }
      }

      // Add MDX server setting
      settings['mdx.server.enable'] = true;

      // Write back
      FileSystem.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      clack.log.success('Updated .vscode/settings.json with MDX language server');
    } catch (error) {
      clack.log.warn(`Failed to update .vscode/settings.json: ${error}`);
    }
  }

  /**
   * Update tsconfig.json with MDX support settings
   */
  private _updateTsConfigForMdx(projectDir: string, tsconfigPath: string): void {
    try {
      const content = FileSystem.readFile(tsconfigPath);
      const tsconfig = JSON.parse(content);

      let updated = false;

      // Add MDX configuration
      if (!tsconfig.mdx) {
        tsconfig.mdx = { checkMdx: true };
        updated = true;
      } else if (!tsconfig.mdx.checkMdx) {
        tsconfig.mdx.checkMdx = true;
        updated = true;
      }

      // Add paths configuration for snippets
      if (!tsconfig.compilerOptions) {
        tsconfig.compilerOptions = {};
      }

      if (!tsconfig.compilerOptions.paths) {
        tsconfig.compilerOptions.paths = {};
      }

      if (!tsconfig.compilerOptions.paths['/snippets/*']) {
        tsconfig.compilerOptions.paths['/snippets/*'] = ['./docs/snippets/*'];
        updated = true;
      }

      if (updated) {
        FileSystem.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');
        clack.log.success('Updated tsconfig.json with MDX support and snippets path mapping');
      } else {
        clack.log.info('tsconfig.json already configured for MDX');
      }
    } catch (error) {
      clack.log.warn(`Failed to update tsconfig.json: ${error}`);
    }
  }

  /**
   * Create README.md in .tsdocs explaining it's a cache directory
   */
  private _createTsdocsReadme(tsdocsDir: string): void {
    const readmePath = path.join(tsdocsDir, 'README.md');

    const readmeContent = `# .tsdocs Cache Directory

This directory contains auto-generated files used during documentation generation.

**⚠️ This entire directory should be gitignored** - it's regenerated on each build.

## Generated Files

- **api-extractor.json** - Auto-generated from your mint-tsdocs.config.json
- **\*.api.json** - API model files generated by API Extractor
- **tsdoc-metadata.json** - TSDoc metadata

## Configuration Files

- **mint-tsdocs.config.json** (project root) - Main configuration for mint-tsdocs
- **tsdoc.json** (project root) - TSDoc configuration for custom tag definitions
  - Created during \`mint-tsdocs init\`
  - Committed to version control
  - Edit this file directly to customize TSDoc tags
- **api-extractor.json** (here, auto-generated) - Generated from mint-tsdocs.config.json

## Need Help?

- **Documentation**: https://mint-tsdocs.saulo.engineer
- **API Extractor**: https://api-extractor.com
- **TSDoc**: https://tsdoc.org
`;

    FileSystem.writeFile(readmePath, readmeContent);
  }

  /**
   * Add mint-tsdocs script to package.json if no existing script uses mint-tsdocs
   * @returns true if script was added, false if skipped
   */
  private _addScriptToPackageJson(packageJsonPath: string): boolean {
    if (!FileSystem.exists(packageJsonPath)) {
      return false;
    }

    try {
      const packageJsonContent = FileSystem.readFile(packageJsonPath);
      const packageJson = JSON.parse(packageJsonContent);

      // Check if any existing script uses mint-tsdocs or mint-tsdocs
      if (packageJson.scripts) {
        const scriptValues = Object.values(packageJson.scripts) as string[];
        const hasExistingScript = scriptValues.some(
          (script) => script.includes('mint-tsdocs') || script.includes('mint-tsdocs')
        );

        if (hasExistingScript) {
          return false; // Skip adding script
        }
      }

      // Add mint-tsdocs script
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      packageJson.scripts['mint-tsdocs'] = 'mint-tsdocs generate';

      // Write back with proper formatting
      FileSystem.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      return true;
    } catch (error) {
      // If we can't update package.json, just skip it
      return false;
    }
  }

  /**
   * Update .gitignore to exclude .tsdocs directory
   */
  private _updateGitignore(projectDir: string, relativeTsdocsDir: string): void {
    const gitignorePath = path.join(projectDir, '.gitignore');
    const gitignoreEntry = `${relativeTsdocsDir}/`;

    if (FileSystem.exists(gitignorePath)) {
      const gitignoreContent = FileSystem.readFile(gitignorePath);
      if (!gitignoreContent.includes(relativeTsdocsDir)) {
        FileSystem.writeFile(
          gitignorePath,
          gitignoreContent.trimEnd() + '\n\n# mint-tsdocs cache\n' + gitignoreEntry + '\n'
        );
      }
    } else {
      FileSystem.writeFile(gitignorePath, '# mint-tsdocs cache\n' + gitignoreEntry + '\n');
    }

    clack.log.success('Updated .gitignore');
  }

  /**
   * Run a shell command with spinner
   */
  private async _runCommand(
    command: string,
    args: string[],
    cwd: string,
    message: string,
    options: { forceInteractive?: boolean } = {}
  ): Promise<void> {
    const isVerbose = this._cliInstance.isVerbose;
    const isDebug = this._cliInstance.isDebug;
    const forceInteractive = options.forceInteractive ?? false;
    const useInherit = isVerbose || forceInteractive;
    const spinner = clack.spinner();

    if (isDebug) {
      clack.log.info(`Running: ${command} ${args.join(' ')}`);
      clack.log.info(`Working directory: ${cwd}`);
    }

    if (!forceInteractive) {
      spinner.start(message);
    } else {
      clack.log.info(message);
    }

    return new Promise((resolve, reject) => {
      const proc = child_process.spawn(command, args, {
        cwd,
        stdio: useInherit ? 'inherit' : 'pipe',
        shell: true
      });

      let stdout = '';
      let stderr = '';

      if (!useInherit) {
        proc.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        proc.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      proc.on('close', (code) => {
        if (code === 0) {
          if (!forceInteractive) {
            spinner.stop(Colorize.green(`✓ ${message}`));
          } else {
            clack.log.success(`✓ ${message}`);
          }

          if (isDebug && !useInherit && stdout) {
            clack.log.info('Command output:');
            console.log(stdout);
          }

          resolve();
        } else {
          if (!forceInteractive) {
            spinner.stop(Colorize.red(`✗ ${message} failed`));
          }
          clack.log.error(`Command failed: ${command} ${args.join(' ')}`);
          if (stderr) {
            clack.log.error(stderr);
          } else if (stdout) {
            clack.log.error(stdout);
          }
          reject(
            new DocumentationError(
              `Failed to run: ${command} ${args.join(' ')}\n${stderr || stdout}`,
              ErrorCode.COMMAND_FAILED
            )
          );
        }
      });

      proc.on('error', (error) => {
        if (!forceInteractive) {
          spinner.stop(Colorize.red(`✗ ${message} failed`));
        }
        reject(
          new DocumentationError(
            `Failed to execute ${command}: ${error.message}`,
            ErrorCode.COMMAND_FAILED
          )
        );
      });
    });
  }
}
