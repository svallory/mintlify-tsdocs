import { CommandLineAction, CommandLineRemainder } from '@rushstack/ts-command-line';
import * as clack from '@clack/prompts';
import { Colorize } from '@rushstack/terminal';
import type { DocumenterCli } from './ApiDocumenterCommandLine';
import { showPlainHeader, showCommandHelp } from './CliHelpers';
import * as CustomizeHelp from './help/CustomizeHelp';
import * as InitHelp from './help/InitHelp';
import * as GenerateHelp from './help/GenerateHelp';
import * as ShowHelp from './help/ShowHelp';
import * as ConfigHelp from './help/ConfigHelp';
import * as LintHelp from './help/LintHelp';

/**
 * CLI action for displaying help information.
 *
 * @public
 */
export class HelpAction extends CommandLineAction {
  private readonly _cliInstance: DocumenterCli;
  private readonly _commandRemainder: CommandLineRemainder;

  public constructor(parser: DocumenterCli) {
    super({
      actionName: 'help',
      summary: 'Display help information',
      documentation: 'Shows comprehensive help about mint-tsdocs commands and usage. ' +
        'Use "help <command>" to show help for a specific command.'
    });

    this._cliInstance = parser;

    this._commandRemainder = this.defineCommandLineRemainder({
      description: 'Command name to show help for (e.g., "init", "generate", "customize")'
    });
  }

  protected override async onExecuteAsync(): Promise<void> {
    // Check if user specified a command: mint-tsdocs help <command>
    const remainingArgs = this._commandRemainder.values;
    if (remainingArgs && remainingArgs.length > 0) {
      const commandName = remainingArgs[0];

      // Show command-specific help
      switch (commandName) {
        case 'init':
          InitHelp.showHelp();
          return;
        case 'generate':
          GenerateHelp.showHelp();
          return;
        case 'customize':
          CustomizeHelp.showHelp();
          return;
        case 'show':
          ShowHelp.showHelp();
          return;
        case 'config':
          ConfigHelp.showHelp();
          return;
        case 'lint':
          LintHelp.showHelp();
          return;
        case 'coverage':
          // We don't have a specific help helper for coverage yet, but we can show the general help or create one.
          // For now, let's just show the command help using the action itself if possible, 
          // or just rely on the parser's help which is invoked via --help.
          // But here we are inside HelpAction.
          // Let's just print a simple help for now or better, create CoverageHelp.ts later.
          // For now, I'll just print the usage.
          showPlainHeader();
          console.log('\n' + Colorize.bold('USAGE'));
          console.log('  mint-tsdocs coverage [OPTIONS]\n');
          console.log(Colorize.bold('DESCRIPTION'));
          console.log('  Calculate TSDocs coverage for the project.\n');
          console.log(Colorize.bold('OPTIONS'));
          console.log('  --threshold <NUMBER>   Minimum coverage percentage required to pass');
          console.log('  --include <GLOB>       Glob pattern for files to include');
          console.log('  --exclude <GLOB>       Glob pattern for files to exclude');
          console.log('  --group-by <TYPE>      Group results by "file", "folder", or "none"');
          console.log('  --json                 Output report in JSON format');
          console.log('  --skip-extractor       Skip running api-extractor');
          return;
        case 'version':
          // Version just shows version, no special help
          showPlainHeader();
          console.log('\nDisplays version information for mint-tsdocs.\n');
          console.log('Run ' + Colorize.cyan('mint-tsdocs version') + ' to see version details');
          return;
        default:
          showPlainHeader();
          clack.log.warn(`Unknown command: ${Colorize.yellow(commandName)}`);
          console.log(`\nValid commands: init, generate, customize, config, show (deprecated), lint, coverage, version\n`);
          console.log('Run ' + Colorize.cyan('mint-tsdocs help') + ' to see all commands');
          return;
      }
    }

    // Show general help if no command specified
    showPlainHeader();

    console.log('\n' + Colorize.bold('DESCRIPTION'));
    console.log('  Generates Mintlify-compatible MDX documentation from TypeScript source code.');
    console.log('  Uses API Extractor to extract type information and converts it to beautiful,');
    console.log('  searchable documentation with automatic navigation integration.\n');

    console.log(Colorize.bold('USAGE'));
    console.log('  mint-tsdocs [COMMAND] [OPTIONS]\n');
    console.log('  Quick start:');
    console.log('    mint-tsdocs init              Initialize configuration');
    console.log('    mint-tsdocs                   Generate docs (default action)');
    console.log('    mint-tsdocs ./packages/lib    Generate docs for specific package\n');

    console.log(Colorize.bold('COMMANDS'));
    console.log('  ' + Colorize.cyan('init') + '         Initialize mint-tsdocs configuration');
    console.log('               Creates mint-tsdocs.config.json with auto-detected settings');
    console.log('               Options: --yes (skip prompts), --skip-mintlify\n');

    console.log('  ' + Colorize.cyan('generate') + '     Generate documentation (default)');
    console.log('               Runs api-extractor and generates MDX documentation');
    console.log('               Usage: mint-tsdocs generate [PROJECT_DIR]');
    console.log('               Options: --skip-extractor, --project-dir PATH\n');

    console.log('  ' + Colorize.cyan('customize') + '    Initialize template directory');
    console.log('               Copies default Liquid templates for customization');
    console.log('               Usage: mint-tsdocs customize -t ./templates\n');

    console.log('  ' + Colorize.cyan('config') + '       Display current configuration');
    console.log('               Shows project settings, navigation, templates, and API Extractor config');
    console.log('               Usage: mint-tsdocs config\n');

    console.log('  ' + Colorize.cyan('show') + '         ' + Colorize.dim('[DEPRECATED]') + ' Display configuration or statistics');
    console.log('               Use "config" or "coverage" instead');
    console.log('               Usage: mint-tsdocs show config|stats\n');

    console.log('  ' + Colorize.cyan('lint') + '         Check documentation quality and find issues');
    console.log('               Reports undocumented APIs and missing descriptions');
    console.log('               Usage: mint-tsdocs lint [PATH]\n');

    console.log('  ' + Colorize.cyan('coverage') + '     Calculate TSDocs coverage');
    console.log('               Reports percentage of documented API items');
    console.log('               Usage: mint-tsdocs coverage\n');

    console.log('  ' + Colorize.cyan('help') + '         Display this help message\n');

    console.log('  ' + Colorize.cyan('version') + '      Display version information\n');

    console.log(Colorize.bold('GLOBAL OPTIONS'));
    console.log('  -v, --verbose    Show verbose output (info level logging)');
    console.log('  --debug          Show debug output (implies --verbose)');
    console.log('  -q, --quiet      Suppress all output except errors');
    console.log('  -h, --help       Show help for specific command\n');

    console.log(Colorize.bold('EXAMPLES'));
    console.log('  ' + Colorize.gray('# Initialize in current directory'));
    console.log('  $ mint-tsdocs init\n');

    console.log('  ' + Colorize.gray('# Generate docs for current project'));
    console.log('  $ mint-tsdocs\n');

    console.log('  ' + Colorize.gray('# Generate docs for specific package (monorepo)'));
    console.log('  $ mint-tsdocs ./packages/my-library\n');

    console.log('  ' + Colorize.gray('# Customize templates'));
    console.log('  $ mint-tsdocs customize -t ./my-templates\n');

    console.log('  ' + Colorize.gray('# View current configuration'));
    console.log('  $ mint-tsdocs config\n');

    console.log('  ' + Colorize.gray('# Check coverage'));
    console.log('  $ mint-tsdocs coverage\n');

    console.log(Colorize.bold('DOCUMENTATION'));
    console.log('  https://mint-tsdocs.saulo.engineer/\n');

    console.log(Colorize.bold('REPORT ISSUES'));
    console.log('  https://github.com/mintlify/tsdocs/issues\n');

    console.log('Run ' + Colorize.cyan('mint-tsdocs <command> --help') + ' for command-specific help');
  }
}
