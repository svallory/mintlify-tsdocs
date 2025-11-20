import { showCommandHelp } from '../CliHelpers';

/**
 * Display help for the customize command
 */
export function showHelp(): void {
  showCommandHelp({
    commandName: 'customize',
    summary: 'Initialize template directory',
    description:
      'Creates a template directory populated with default Liquid templates that can be ' +
      'customized to override the default documentation generation behavior. Automatically ' +
      'updates mint-tsdocs.config.json to use the custom templates.',
    usage: 'mint-tsdocs customize [OPTIONS]',
    options: [
      {
        short: '-t',
        long: '--template-dir DIRECTORY',
        description: 'Specifies the directory where templates should be created. If omitted, you will be prompted.'
      },
      {
        short: '-f',
        long: '--force',
        description: 'Overwrite existing templates in the target directory'
      },
      {
        short: '-h',
        long: '--help',
        description: 'Show this help message'
      }
    ],
    examples: [
      {
        description: 'Initialize templates in default location (interactive)',
        command: 'mint-tsdocs customize'
      },
      {
        description: 'Initialize templates in specific directory',
        command: 'mint-tsdocs customize -t ./my-templates'
      },
      {
        description: 'Overwrite existing templates',
        command: 'mint-tsdocs customize -t ./templates --force'
      }
    ]
  });
}
