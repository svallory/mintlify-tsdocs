import { PackageJsonLookup } from '@rushstack/node-core-library';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';

export const BORDER = Colorize.gray('│  ');

/**
 * Get the package version
 */
export function getPackageVersion(): string {
  return PackageJsonLookup.loadOwnPackageJson(__dirname).version;
}

/**
 * Show consistent CLI header with version (plain text, no Clack borders)
 */
export function showPlainHeader(): void {
  const version = getPackageVersion();

  // ANSI escape codes for custom background color rgb(22, 110, 63)
  const bgGreen = '\x1b[48;2;22;110;63m';  // RGB background
  const fgWhite = '\x1b[97m';               // Bright white text
  const bold = '\x1b[1m';                   // Bold
  const reset = '\x1b[0m';                  // Reset all styles

  console.log(
    [
      '',
      `${bold}${fgWhite}${bgGreen} mint-tsdocs ${reset} ${Colorize.dim(`v${version}`)}`,
      Colorize.cyan('https://mint-tsdocs.saulo.engineer/')
    ].join('\n')
  );
} 

/**
 * Show consistent CLI header with version (with Clack intro border)
 */
export function showCliHeader(): void {
  const version = getPackageVersion();

  // ANSI escape codes for custom background color rgb(22, 110, 63)
  const bgGreen = '\x1b[48;2;22;110;63m';  // RGB background
  const fgWhite = '\x1b[97m';               // Bright white text
  const bold = '\x1b[1m';                   // Bold
  const reset = '\x1b[0m';                  // Reset all styles

  // Build the header with two lines
  const line1 = `${bold}${fgWhite}${bgGreen} mint-tsdocs ${reset} ${Colorize.dim(`v${version}`)}`;
  const line2 = Colorize.cyan('https://mint-tsdocs.saulo.engineer/');

  clack.intro(`${line1}\n${BORDER}${line2}`);
}

/**
 * Interface for help option configuration
 */
export interface IHelpOption {
  short?: string;
  long: string;
  description: string;
}

/**
 * Interface for help example configuration
 */
export interface IHelpExample {
  description: string;
  command: string;
}

/**
 * Configuration for displaying command help
 */
export interface ICommandHelpConfig {
  commandName: string;
  summary: string;
  description?: string;
  usage?: string;
  options?: IHelpOption[];
  examples?: IHelpExample[];
}

/**
 * Display formatted help for a command (plain text, no Clack borders)
 */
export function showCommandHelp(config: ICommandHelpConfig): void {
  showPlainHeader();

  console.log('\n' + Colorize.bold(config.summary));

  if (config.description) {
    console.log('\n' + Colorize.bold('DESCRIPTION'));
    console.log('  ' + config.description);
  }

  if (config.usage) {
    console.log('\n' + Colorize.bold('USAGE'));
    console.log('  ' + config.usage);
  }

  if (config.options && config.options.length > 0) {
    console.log('\n' + Colorize.bold('OPTIONS'));
    for (const option of config.options) {
      let optionLine = '  ';
      if (option.short) {
        optionLine += Colorize.cyan(option.short) + ', ';
      }
      optionLine += Colorize.cyan(option.long);
      console.log(optionLine);
      console.log('      ' + option.description);
      console.log('');
    }
  }

  if (config.examples && config.examples.length > 0) {
    console.log(Colorize.bold('EXAMPLES'));
    for (const example of config.examples) {
      console.log('  ' + Colorize.gray('# ' + example.description));
      console.log('  $ ' + example.command);
      console.log('');
    }
  }

  console.log('\nFor more help, visit ' + Colorize.cyan('https://mint-tsdocs.saulo.engineer/'));
}
