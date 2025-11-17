// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as path from 'path';
import { FileSystem } from '@rushstack/node-core-library';
import {
  CommandLineAction,
  type CommandLineStringParameter,
  CommandLineFlagParameter
} from '@rushstack/ts-command-line';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';

import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import { loadConfig } from '../config/loader';
import type { MintlifyTsDocsConfig } from '../config/types';
import { showCliHeader } from './CliHelpers';
import * as CustomizeHelp from './help/CustomizeHelp';

/**
 * CLI action to initialize a template directory with default templates for customization
 */
export class CustomizeAction extends CommandLineAction {
  private readonly _templateDirParameter: CommandLineStringParameter;
  private readonly _forceParameter: CommandLineFlagParameter;

  public constructor() {
    super({
      actionName: 'customize',
      summary: 'Initialize a template directory with default Liquid templates for customization',
      documentation:
        'Creates a template directory populated with default Liquid templates ' +
        'that can be customized to override the default documentation generation behavior. ' +
        'Automatically updates mint-tsdocs.config.json to use the custom templates.'
    });

    this._templateDirParameter = this.defineStringParameter({
      parameterLongName: '--template-dir',
      parameterShortName: '-t',
      argumentName: 'DIRECTORY',
      description:
        'Specifies the directory where templates should be created. ' +
        'If omitted, you will be prompted for a location.'
    });

    this._forceParameter = this.defineFlagParameter({
      parameterLongName: '--force',
      parameterShortName: '-f',
      description:
        'Overwrite existing templates in the target directory'
    });
  }

  protected override async onExecuteAsync(): Promise<void> {
    // Check if --help was requested (check process.argv since ts-command-line intercepts it)
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      CustomizeHelp.showHelp();
      return;
    }
    try {
      // Get or prompt for template directory
      let templateDir = this._templateDirParameter.value;

      if (!templateDir) {
        // Interactive prompt for template directory
        const response = await clack.text({
          message: 'Where should the templates be copied to?',
          placeholder: './templates',
          defaultValue: './templates',
          validate: (value) => {
            if (!value || value.trim().length === 0) {
              return 'Template directory is required';
            }
            return undefined;
          }
        });

        if (clack.isCancel(response)) {
          clack.cancel('Template customization cancelled');
          process.exit(0);
        }

        templateDir = response as string;
      }

      const force = this._forceParameter.value || false;

      showCliHeader();
      console.log('\n' + Colorize.bold('Initializing template directory: ') + Colorize.cyan(templateDir));

      // Check if directory exists and has files
      if (FileSystem.exists(templateDir)) {
        const files = FileSystem.readFolderItemNames(templateDir);
        const liquidFiles = files.filter(f => f.endsWith('.liquid'));

        if (liquidFiles.length > 0 && !force) {
          throw new DocumentationError(
            `Template directory "${templateDir}" already contains ${liquidFiles.length} template files. ` +
            'Use --force to overwrite existing templates.',
            ErrorCode.TEMPLATE_ERROR
          );
        }

        if (force) {
          clack.log.warn(`Overwriting existing templates in ${templateDir}...`);
        }
      } else {
        // Create directory
        clack.log.info(`Creating directory: ${templateDir}`);
        FileSystem.ensureFolder(templateDir);
      }

      // Get the default template directory
      const defaultTemplateDir = path.join(__dirname, '..', 'templates', 'defaults');

      if (!FileSystem.exists(defaultTemplateDir)) {
        throw new DocumentationError(
          `Default templates not found at ${defaultTemplateDir}`,
          ErrorCode.TEMPLATE_NOT_FOUND
        );
      }

      // Copy all default templates to user directory
      clack.log.info('Copying default templates...');
      const copiedCount = this._copyTemplates(defaultTemplateDir, templateDir);
      clack.log.success(`✓ Copied ${copiedCount} template files`);

      // Update mint-tsdocs.config.json if it exists
      await this._updateConfig(templateDir);

      clack.outro(`Templates ready for customization!

${Colorize.cyan('Location:')} ${path.resolve(templateDir)}

${Colorize.bold('Next steps:')}
1. Customize the template files as needed
2. Generate docs: ${Colorize.cyan('mint-tsdocs generate')}

${Colorize.gray('Documentation:')} https://mint-tsdocs.saulo.engineer/templates
`);

    } catch (error) {
      if (error instanceof DocumentationError) {
        throw error;
      }
      throw new DocumentationError(
        `Failed to initialize templates: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.TEMPLATE_ERROR,
        { cause: error instanceof Error ? error : new Error(String(error)) }
      );
    }
  }

  /**
   * Copy templates from source to destination directory
   */
  private _copyTemplates(sourceDir: string, destDir: string): number {
    const entries = FileSystem.readFolderItemNames(sourceDir);
    let count = 0;

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry);
      const destPath = path.join(destDir, entry);

      // Only copy .liquid files (skip other files like .ts, .js, etc.)
      if (entry.endsWith('.liquid')) {
        clack.log.info(`  Copying: ${entry}`);

        const content = FileSystem.readFileToBuffer(sourcePath).toString();

        // Add a comment at the top of each template explaining it
        const headerComment = `<!--
  Mintlify TypeDoc Template

  This template controls how ${entry.replace('.liquid', '')} documentation is generated.

  Available variables:
  - apiItem: The API item being documented
  - page: Page metadata (title, description, icon, breadcrumb)
  - properties, methods, constructors: Structured data for API members
  - examples: Array of example code strings
  - heritageTypes: Inheritance information

  Learn more: https://mint-tsdocs.saulo.engineer/templates
-->

`;

        const finalContent = headerComment + content;
        FileSystem.writeFile(destPath, finalContent);
        count++;
      }
    }

    return count;
  }

  /**
   * Update mint-tsdocs.config.json with the template directory path
   */
  private async _updateConfig(templateDir: string): Promise<void> {
    try {
      // Try to load existing config
      const result = await loadConfig(process.cwd());

      if (result) {
        const configPath = path.join(process.cwd(), 'mint-tsdocs.config.json');

        if (!FileSystem.exists(configPath)) {
          clack.log.warn('No mint-tsdocs.config.json found. Run "mint-tsdocs init" first.');
          return;
        }

        // Read the current config file
        const configContent = FileSystem.readFile(configPath);
        const config = JSON.parse(configContent) as MintlifyTsDocsConfig;

        // Update templates configuration
        if (!config.templates) {
          config.templates = {};
        }
        config.templates.userTemplateDir = templateDir;

        // Write updated config with pretty formatting
        FileSystem.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');

        clack.log.success(`✓ Updated mint-tsdocs.config.json with template directory`);
      } else {
        clack.log.info('No configuration file found. Templates will be used with --template-dir flag.');
      }
    } catch (error) {
      // Non-fatal error - just log it
      clack.log.warn('Could not update configuration file. You can manually set templates.userTemplateDir in mint-tsdocs.config.json');
    }
  }
}
