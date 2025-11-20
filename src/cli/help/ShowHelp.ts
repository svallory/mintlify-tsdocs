import { showCommandHelp } from '../CliHelpers';

/**
 * Display help for the show command
 */
export function showHelp(): void {
  showCommandHelp({
    commandName: 'show',
    summary: 'Display configuration or statistics',
    description:
      'Displays the current mint-tsdocs configuration or documentation statistics. ' +
      'Use "config" to view configuration settings or "stats" to view API coverage and quality metrics. ' +
      'Defaults to "config" if no target is specified.',
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
        description: 'Show current configuration (default)',
        command: 'mint-tsdocs show'
      },
      {
        description: 'Show configuration explicitly',
        command: 'mint-tsdocs show config'
      },
      {
        description: 'Show documentation statistics',
        command: 'mint-tsdocs show stats'
      }
    ]
  });
}
