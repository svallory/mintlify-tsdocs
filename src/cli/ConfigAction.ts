import { CommandLineAction } from '@rushstack/ts-command-line';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';
import { showCliHeader } from './CliHelpers';
import { displayConfig } from './utils/configDisplay';

/**
 * CLI action for displaying current configuration.
 *
 * @public
 */
export class ConfigAction extends CommandLineAction {
  public constructor() {
    super({
      actionName: 'config',
      summary: 'Display current configuration',
      documentation:
        'Shows the current mint-tsdocs configuration loaded from mint-tsdocs.config.json.\n\n' +
        'Example:\n' +
        '  mint-tsdocs config'
    });
  }

  protected override async onExecuteAsync(): Promise<void> {
    showCliHeader();

    // Display note about file-based configuration
    clack.log.message(Colorize.dim('Note: All configuration is currently done via the mint-tsdocs.config.json file.'));
    clack.log.message(Colorize.dim('      Configuration via CLI will be implemented in a future release.\n'));

    // Display the configuration
    await displayConfig();
  }
}
