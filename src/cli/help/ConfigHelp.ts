import { showCommandHelp } from '../CliHelpers';

/**
 * Display help for the config command
 */
export function showHelp(): void {
  showCommandHelp({
    commandName: 'config',
    summary: 'Display current configuration',
    description:
      'Displays the current mint-tsdocs configuration loaded from mint-tsdocs.config.json. ' +
      'Shows project settings, navigation, templates, and API Extractor configuration. ' +
      '\n\nNote: All configuration is currently done via the mint-tsdocs.config.json file. ' +
      'Configuration via CLI will be implemented in a future release.',
    usage: 'mint-tsdocs config',
    options: [
      {
        short: '-h',
        long: '--help',
        description: 'Show this help message'
      }
    ],
    examples: [
      {
        description: 'Display current configuration',
        command: 'mint-tsdocs config'
      }
    ]
  });
}
