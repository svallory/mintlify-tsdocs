import * as path from 'path';
import { CommandLineAction } from '@rushstack/ts-command-line';
import { FileSystem } from '@rushstack/node-core-library';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';
import Table from 'cli-table3';
import { ApiModel } from '@microsoft/api-extractor-model';
import { loadConfig } from '../config';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import { DocumentationStats, type TypeCoverageStats } from '../utils/DocumentationStats';
import { showCliHeader } from './CliHelpers';
import * as ShowHelp from './help/ShowHelp';

/**
 * CLI action for displaying configuration and statistics.
 *
 * @public
 */
export class ShowAction extends CommandLineAction {
  public constructor() {
    super({
      actionName: 'show',
      summary: 'Display configuration or statistics',
      documentation:
        'Shows information about the current configuration or documentation statistics.\n\n' +
        'Available targets:\n' +
        '  config  - Display current configuration\n' +
        '  stats   - Display documentation statistics\n\n' +
        'Examples:\n' +
        '  mint-tsdocs show config\n' +
        '  mint-tsdocs show stats'
    });

    // Define remainder to accept positional target argument
    this.defineCommandLineRemainder({
      description: 'Target to show (config or stats)'
    });
  }

  protected override async onExecuteAsync(): Promise<void> {
    // Check if --help was requested (check process.argv since ts-command-line intercepts it)
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      ShowHelp.showHelp();
      return;
    }

    // Get target from remainder args (default to 'config' if not provided)
    const target = (this.remainder && this.remainder.values.length > 0)
      ? this.remainder.values[0]
      : 'config';

    switch (target.toLowerCase()) {
      case 'config':
        await this._showConfig();
        break;
      case 'stats':
        await this._showStats();
        break;
      default:
        throw new DocumentationError(
          `Unknown show target: "${target}". Use "config" or "stats".`,
          ErrorCode.INVALID_CONFIGURATION
        );
    }
  }

  private async _showConfig(): Promise<void> {
    showCliHeader();
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

  private async _showStats(): Promise<void> {
    showCliHeader();
    clack.log.message(Colorize.bold('Documentation Statistics'));

    try {
      const config = loadConfig(process.cwd());

      // Resolve paths
      const projectDir = process.cwd();
      const tsdocsDir = path.join(projectDir, 'docs', '.tsdocs');
      const outputFolder = path.isAbsolute(config.outputFolder)
        ? config.outputFolder
        : path.join(projectDir, config.outputFolder);

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

      // Collect statistics
      const stats = DocumentationStats.collectStats(apiModel, outputFolder);

      // Helper to format coverage percentage with color
      const formatCoverage = (percent: number): string => {
        const color = percent >= 80 ? Colorize.green : percent >= 50 ? Colorize.yellow : Colorize.red;
        return color(`${percent}%`);
      };

      // Helper to add row to table if type has items
      const addTableRow = (
        table: Table.Table,
        label: string,
        typeStats: TypeCoverageStats
      ): void => {
        if (typeStats.total > 0) {
          table.push([
            label,
            typeStats.total.toString(),
            Colorize.green(typeStats.documented.toString()),
            typeStats.undocumented > 0
              ? Colorize.yellow(typeStats.undocumented.toString())
              : '0',
            formatCoverage(typeStats.coveragePercent)
          ]);
        }
      };

      // Display project info
      if (stats.projectName) {
        clack.log.message(
          Colorize.bold('Project') + '\n' +
          '  Name:            ' + Colorize.cyan(stats.projectName)
        );
      }

      // Create API Surface Coverage table
      clack.log.message(Colorize.bold('API Surface Coverage'));
      const table = new Table({
        head: [
          Colorize.cyan('Type'),
          Colorize.cyan('Total'),
          Colorize.cyan('Documented'),
          Colorize.cyan('Undocumented'),
          Colorize.cyan('Coverage')
        ],
        style: {
          head: [],
          border: ['dim']
        },
        colAligns: ['left', 'right', 'right', 'right', 'right']
      });

      // Add rows for each type
      addTableRow(table, 'Classes', stats.apiSurface.classes);
      addTableRow(table, 'Interfaces', stats.apiSurface.interfaces);
      addTableRow(table, 'Functions', stats.apiSurface.functions);
      addTableRow(table, 'Type Aliases', stats.apiSurface.typeAliases);
      addTableRow(table, 'Enums', stats.apiSurface.enums);
      addTableRow(table, 'Namespaces', stats.apiSurface.namespaces);
      addTableRow(table, 'Variables', stats.apiSurface.variables);

      // Add separator if we have member types
      if (stats.apiSurface.methods.total > 0 || stats.apiSurface.properties.total > 0) {
        // Empty row as separator
        addTableRow(table, 'Methods', stats.apiSurface.methods);
        addTableRow(table, 'Properties', stats.apiSurface.properties);
      }

      // Add total row
      const totalStats = DocumentationStats.getTotalStats(stats.apiSurface);
      table.push([
        Colorize.bold('TOTAL'),
        Colorize.bold(totalStats.total.toString()),
        Colorize.bold(Colorize.green(totalStats.documented.toString())),
        Colorize.bold(
          totalStats.undocumented > 0 ? Colorize.yellow(totalStats.undocumented.toString()) : '0'
        ),
        Colorize.bold(formatCoverage(totalStats.coveragePercent))
      ]);

      clack.log.message(table.toString());

      // Display quality metrics
      clack.log.message(
        Colorize.bold('Quality Metrics') + '\n' +
        '  With Examples:   ' + Colorize.cyan(stats.coverage.withExamples.toString()) + '\n' +
        '  With Remarks:    ' + Colorize.cyan(stats.coverage.withRemarks.toString())
      );

      // Display generated files statistics
      if (stats.generatedFiles.mdxFiles > 0) {
        clack.log.message(
          Colorize.bold('Generated Files') + '\n' +
          '  MDX Files:       ' + Colorize.cyan(stats.generatedFiles.mdxFiles.toString()) + '\n' +
          '  Total Size:      ' + Colorize.cyan(DocumentationStats.formatFileSize(stats.generatedFiles.totalSize)) + '\n' +
          '  Average Size:    ' + Colorize.cyan(DocumentationStats.formatFileSize(stats.generatedFiles.averageSize)) + '\n' +
          '  Location:        ' + Colorize.dim(outputFolder)
        );
      }

      clack.outro('');
    } catch (error) {
      if (error instanceof DocumentationError && error.code === ErrorCode.CONFIG_NOT_FOUND) {
        clack.log.error('No mint-tsdocs configuration found.');
        clack.outro('Run ' + Colorize.cyan('mint-tsdocs init') + ' to create a configuration file');
      } else {
        throw error;
      }
    }
  }
}
