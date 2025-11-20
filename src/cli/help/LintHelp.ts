import { showCommandHelp } from '../CliHelpers';

/**
 * Display help for the lint command
 */
export function showHelp(): void {
  showCommandHelp({
    commandName: 'lint',
    summary: 'Check documentation quality and find issues',
    description:
      'Analyzes API documentation and reports issues such as undocumented public APIs, ' +
      'missing parameter descriptions, missing return type descriptions, and missing examples ' +
      'for complex APIs. Helps maintain high-quality documentation standards.',
    usage: 'mint-tsdocs lint [OPTIONS]',
    options: [
      {
        short: '-h',
        long: '--help',
        description: 'Show this help message'
      }
    ],
    examples: [
      {
        description: 'Lint documentation for current project',
        command: 'mint-tsdocs lint'
      }
    ]
  });
}
