import * as path from 'path';
import { CommandLineAction } from '@rushstack/ts-command-line';
import { FileSystem } from '@rushstack/node-core-library';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ApiModel } from '@microsoft/api-extractor-model';
import { loadConfig } from '../config';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import { DocumentationStats, type TypeCoverageStats } from '../utils/DocumentationStats';
import { showCliHeader } from './CliHelpers';
import * as ShowHelp from './help/ShowHelp';
import { displayConfig } from './utils/configDisplay';
import { ColorThemes } from './ColorThemes';

/**
 * CLI action for displaying configuration and statistics.
 *
 * @public
 */
export class ShowAction extends CommandLineAction {
  public constructor() {
    super({
      actionName: 'show',
      summary: 'Display current configuration',
      documentation:
        'Shows information about the current mint-tsdocs configuration.\n\n' +
        'Example:\n' +
        '  mint-tsdocs show\n' +
        '  mint-tsdocs show config'
    });

    // Define remainder to accept positional target argument (deprecated, for backwards compatibility)
    this.defineCommandLineRemainder({
      description: 'Optional target (deprecated)'
    });
  }

  protected override async onExecuteAsync(): Promise<void> {
    // Check if --help was requested (check process.argv since ts-command-line intercepts it)
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      ShowHelp.showHelp();
      return;
    }

    // Get target from remainder args for backwards compatibility
    const target = (this.remainder && this.remainder.values.length > 0)
      ? this.remainder.values[0]
      : 'config';

    // Handle deprecated 'stats' option - show warning and execute coverage
    if (target.toLowerCase() === 'stats') {
      showCliHeader();
      clack.log.message(chalk.hex(ColorThemes.Nord.yellow)('⚠  The "show stats" command is deprecated and will be removed in a future version.'));
      clack.log.message(Colorize.dim('   Please use "mint-tsdocs coverage" instead.\n'));

      // Execute coverage command
      const { CoverageAction } = await import('./CoverageAction.js');
      const { DocumenterCli } = await import('./ApiDocumenterCommandLine.js');
      const parser = new DocumenterCli();
      await parser.executeAsync(['coverage']);
      return;
    }

    // Handle deprecated 'show config' - show warning and execute config
    if (target.toLowerCase() === 'config') {
      showCliHeader();
      clack.log.message(chalk.hex(ColorThemes.Nord.yellow)('⚠  The "show config" command is deprecated and will be removed in a future version.'));
      clack.log.message(Colorize.dim('   Please use "mint-tsdocs config" instead.\n'));

      // Execute config display
      await displayConfig();
      return;
    }

    throw new DocumentationError(
      `Unknown show target: "${target}". Use "mint-tsdocs config" for configuration or "mint-tsdocs coverage" for coverage statistics.`,
      ErrorCode.INVALID_CONFIGURATION
    );
  }

}
