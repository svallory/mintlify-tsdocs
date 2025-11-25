import { PackageJsonLookup } from '@rushstack/node-core-library';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';
import { S_BAR_START, S_BAR, S_BAR_END, symbolBar } from './utils/constants';
import { ColorThemes } from './ColorThemes';
import chalk from 'chalk';

export const BORDER = Colorize.gray('│  ');

/**
 * Get the package version
 */
export function getPackageVersion(): string {
  return PackageJsonLookup.loadOwnPackageJson(__dirname).version;
}

export function multiLineOutro(message: string, trim = false): void {
  const lines = message.split('\n');
  let last = lines.pop();

  while (last?.trim() === '' && lines.length > 0) {
    last = lines.pop();
  }

  if (!last) {
    return;
  }

  lines.forEach((line: string) => {
    console.log(`${chalk.gray(S_BAR)}  ${trim ? line.trim() : line}`);
  });

  console.log(`${chalk.gray(S_BAR_END)}  ${trim ? last.trim() : last}`);
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

  // Build the header with two lines
  const line1 = `${formatTitle('mint-tsdocs', 1)} ${chalk.dim(`v${version}`)}`;
  const line2 = chalk.cyan('https://mint-tsdocs.saulo.engineer/');

  clack.intro(`${line1}\n${chalk.gray(S_BAR)}  ${line2}`);
}

export function formatTitle(title: string, level: number = 1): string {

  switch (level) {
    case 1:
      return chalk.bgRgb(22, 110, 63).bold(` ${title} `);
    case 2:
      return chalk.bgHex(ColorThemes.Nord.pink).bold(` ${title} `);
    case 3:
      return chalk.bgHex(ColorThemes.Nord.blue).bold(` ${title} `);
    default:
      return chalk.bgHex(ColorThemes.Nord.green).bold(` ${title} `);
  }
}

/**
 * Show a section header with background styling (similar to CLI header)
 */
export function showSectionHeader(title: string): void {
  const message = `${S_BAR_START}
${S_BAR}  ${formatTitle(title, 2)}
${S_BAR_END}`;
  console.log(message);
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
