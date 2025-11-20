import { showCommandHelp } from '../CliHelpers';

/**
 * Display help for the init command
 */
export function showHelp(): void {
  showCommandHelp({
    commandName: 'init',
    summary: 'Initialize mint-tsdocs configuration',
    description:
      'Creates mint-tsdocs.config.json at the project root with auto-detected settings. ' +
      'Optionally initializes Mintlify (via "mint new") if not already set up. ' +
      'Auto-detects TypeScript entry point from package.json or common paths.',
    usage: 'mint-tsdocs init [OPTIONS]',
    options: [
      {
        long: '--yes',
        description: 'Use auto-detected defaults without prompts (non-interactive mode)'
      },
      {
        long: '--skip-mintlify',
        description: 'Skip Mintlify initialization (only create mint-tsdocs.config.json)'
      },
      {
        long: '--project-dir PATH',
        description: 'Initialize in a specific directory instead of current directory'
      },
      {
        short: '-h',
        long: '--help',
        description: 'Show this help message'
      }
    ],
    examples: [
      {
        description: 'Interactive initialization with prompts',
        command: 'mint-tsdocs init'
      },
      {
        description: 'Use auto-detected defaults (no prompts)',
        command: 'mint-tsdocs init --yes'
      },
      {
        description: 'Initialize without Mintlify setup',
        command: 'mint-tsdocs init --skip-mintlify'
      },
      {
        description: 'Initialize in a specific package (monorepo)',
        command: 'mint-tsdocs init --project-dir ./packages/my-lib'
      }
    ]
  });
}
