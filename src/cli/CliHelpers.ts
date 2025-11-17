// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { PackageJsonLookup } from '@rushstack/node-core-library';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';

/**
 * Get the package version
 */
export function getPackageVersion(): string {
  return PackageJsonLookup.loadOwnPackageJson(__dirname).version;
}

/**
 * Show consistent CLI header with version
 */
export function showCliHeader(): void {
  const version = getPackageVersion();
  clack.intro(
    Colorize.bold(
      `mint-tsdocs ${version} ` + Colorize.cyan(' - https://mint-tsdocs.saulo.engineer/')
    )
  );
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
 * Display formatted help for a command
 */
export function showCommandHelp(config: ICommandHelpConfig): void {
  showCliHeader();

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

  clack.outro('For more help, visit ' + Colorize.cyan('https://mint-tsdocs.saulo.engineer/'));
}
