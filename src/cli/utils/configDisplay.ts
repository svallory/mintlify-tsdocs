import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';
import { loadConfig } from '../../config';
import { DocumentationError, ErrorCode } from '../../errors/DocumentationError';

/**
 * Displays the current mint-tsdocs configuration
 *
 * @public
 */
export async function displayConfig(): Promise<void> {
  clack.log.message(Colorize.bold('Configuration'));

  try {
    const config = loadConfig(process.cwd());

    // Build project settings section
    let projectSettings = Colorize.bold('Project Settings') + '\n';
    projectSettings += '  Entry Point:     ' + Colorize.cyan(config.entryPoint) + '\n';
    projectSettings += '  Output Folder:   ' + Colorize.cyan(config.outputFolder);
    if (config.docsJson) {
      projectSettings += '\n  Docs JSON:       ' + Colorize.cyan(config.docsJson);
    }
    clack.log.message(projectSettings);

    // Build navigation section
    clack.log.message(
      Colorize.bold('Navigation') + '\n' +
      '  Tab Name:        ' + Colorize.cyan(config.tabName || 'API Reference') + '\n' +
      '  Group Name:      ' + Colorize.cyan(config.groupName || 'API')
    );

    // Build README section
    let readmeSection = Colorize.bold('README') + '\n';
    readmeSection += '  Convert README:  ' + Colorize.cyan(config.convertReadme ? 'Yes' : 'No');
    if (config.convertReadme) {
      readmeSection += '\n  README Title:    ' + Colorize.cyan(config.readmeTitle || 'README');
    }
    clack.log.message(readmeSection);

    // Build templates section
    let templatesSection = Colorize.bold('Templates') + '\n';
    if (config.templates?.userTemplateDir) {
      templatesSection += '  User Templates:  ' + Colorize.cyan(config.templates.userTemplateDir) + '\n';
      templatesSection += '  Cache:           ' + Colorize.cyan(config.templates.cache ? 'Enabled' : 'Disabled') + '\n';
      templatesSection += '  Strict Mode:     ' + Colorize.cyan(config.templates.strict ? 'Enabled' : 'Disabled');
    } else {
      templatesSection += '  Using default templates';
    }
    clack.log.message(templatesSection);

    // Build API Extractor section
    let apiExtractorSection = Colorize.bold('API Extractor') + '\n';
    if (config.apiExtractor.configPath) {
      apiExtractorSection += '  Config Path:     ' + Colorize.cyan(config.apiExtractor.configPath);
    } else {
      apiExtractorSection += '  Auto-generated config in .tsdocs/';
    }

    if (config.apiExtractor.bundledPackages && config.apiExtractor.bundledPackages.length > 0) {
      apiExtractorSection += '\n  Bundled:         ' + Colorize.cyan(config.apiExtractor.bundledPackages.join(', '));
    }

    if (config.apiExtractor.compiler?.tsconfigFilePath) {
      apiExtractorSection += '\n  TSConfig:        ' + Colorize.cyan(config.apiExtractor.compiler.tsconfigFilePath);
    }

    apiExtractorSection += '\n\n' + Colorize.dim('Note: TSDoc configuration is in tsdoc.json at project root');
    clack.log.message(apiExtractorSection);

    clack.outro('Configuration loaded successfully');
  } catch (error) {
    if (error instanceof DocumentationError && error.code === ErrorCode.CONFIG_NOT_FOUND) {
      clack.log.error('No mint-tsdocs configuration found.');
      clack.outro('Run ' + Colorize.cyan('mint-tsdocs init') + ' to create a configuration file');
    } else {
      throw error;
    }
  }
}
