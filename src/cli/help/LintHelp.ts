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
      'for complex APIs. Helps maintain high-quality documentation standards.\n\n' +
      'Optionally lint only a specific file or folder by passing a path as an argument.',
    usage: 'mint-tsdocs lint [PATH] [OPTIONS]',
    options: [
      {
        short: '-h',
        long: '--help',
        description: 'Show this help message'
      },
      {
        short: '-v',
        long: '--verbose',
        description: 'Show detailed output including API Extractor and ESLint progress'
      }
    ],
    examples: [
      {
        description: 'Lint documentation for current project',
        command: 'mint-tsdocs lint'
      },
      {
        description: 'Lint only the src/core folder',
        command: 'mint-tsdocs lint ./src/core'
      },
      {
        description: 'Lint a specific file',
        command: 'mint-tsdocs lint ./src/index.ts'
      },
      {
        description: 'Lint a specific package in a monorepo',
        command: 'mint-tsdocs lint ./packages/api'
      }
    ]
  });
}
