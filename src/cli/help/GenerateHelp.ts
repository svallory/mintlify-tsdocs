import { showCommandHelp } from '../CliHelpers';

/**
 * Display help for the generate command
 */
export function showHelp(): void {
  showCommandHelp({
    commandName: 'generate',
    summary: 'Generate documentation',
    description:
      'Runs api-extractor to extract type information and generates MDX documentation files. ' +
      'Uses configuration from mint-tsdocs.config.json. Auto-generates API Extractor and TSDoc ' +
      'configs in .tsdocs/ cache directory. This is the default command when no command is specified.',
    usage: 'mint-tsdocs generate [PROJECT_DIR] [OPTIONS]',
    options: [
      {
        long: '--skip-extractor',
        description: 'Skip running api-extractor (use existing .api.json files in .tsdocs/)'
      },
      {
        long: '--project-dir PATH',
        description: 'Generate docs for specific project directory (useful in monorepos)'
      },
      {
        short: '-i',
        long: '--input-folder FOLDER',
        description: 'Input folder containing *.api.json files (only with --skip-extractor)'
      },
      {
        short: '-o',
        long: '--output-folder FOLDER',
        description: 'Output folder for generated documentation (overrides config)'
      },
      {
        short: '-h',
        long: '--help',
        description: 'Show this help message'
      }
    ],
    examples: [
      {
        description: 'Generate docs for current project',
        command: 'mint-tsdocs generate'
      },
      {
        description: 'Or simply (generate is the default command)',
        command: 'mint-tsdocs'
      },
      {
        description: 'Generate docs for specific package',
        command: 'mint-tsdocs generate ./packages/my-library'
      },
      {
        description: 'Skip API Extractor (use existing .api.json)',
        command: 'mint-tsdocs generate --skip-extractor'
      },
      {
        description: 'Override output folder',
        command: 'mint-tsdocs generate -o ./docs/custom-api'
      }
    ]
  });
}
