import { showCommandHelp } from '../CliHelpers';

/**
 * Display help for the show command (deprecated)
 */
export function showHelp(): void {
  showCommandHelp({
    commandName: 'show',
    summary: '[DEPRECATED] Display configuration or statistics',
    description:
      '[DEPRECATED] This command is deprecated and will be removed in a future version.\n\n' +
      'Use "mint-tsdocs config" to view configuration settings.\n' +
      'Use "mint-tsdocs coverage" to view API coverage statistics.',
    usage: 'mint-tsdocs show [TARGET]',
    options: [
      {
        short: '-h',
        long: '--help',
        description: 'Show this help message'
      }
    ],
    examples: [
      {
        description: 'Show configuration (deprecated - use "mint-tsdocs config")',
        command: 'mint-tsdocs show config'
      },
      {
        description: 'Show statistics (deprecated - use "mint-tsdocs coverage")',
        command: 'mint-tsdocs show stats'
      }
    ]
  });
}
