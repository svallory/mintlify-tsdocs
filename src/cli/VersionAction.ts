// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { CommandLineAction } from '@rushstack/ts-command-line';
import { PackageJsonLookup } from '@rushstack/node-core-library';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';
import { showCliHeader } from './CliHelpers';

/**
 * CLI action for displaying version information.
 *
 * @public
 */
export class VersionAction extends CommandLineAction {
  public constructor() {
    super({
      actionName: 'version',
      summary: 'Display version information',
      documentation: 'Shows the current version of mint-tsdocs and related tools.'
    });
  }

  protected override async onExecuteAsync(): Promise<void> {
    const packageJson = PackageJsonLookup.loadOwnPackageJson(__dirname);
    const version = packageJson.version;
    const name = packageJson.name;

    showCliHeader();

    console.log('\n' + Colorize.bold('Package Information'));
    console.log('  Name:        ' + Colorize.cyan(name));
    console.log('  Version:     ' + Colorize.cyan(version));
    console.log('  Description: ' + (packageJson.description || 'N/A'));
    console.log('  License:     ' + (packageJson.license || 'N/A'));

    console.log('\n' + Colorize.bold('Links'));
    if (packageJson.homepage) {
      console.log('  Homepage:    ' + Colorize.cyan(packageJson.homepage));
    }
    if (packageJson.repository) {
      const repo = typeof packageJson.repository === 'string'
        ? packageJson.repository
        : packageJson.repository.url;
      console.log('  Repository:  ' + Colorize.cyan(repo));
    }
    const bugs = (packageJson as any).bugs;
    if (bugs) {
      const bugsUrl = typeof bugs === 'string' ? bugs : bugs.url;
      console.log('  Report bugs: ' + Colorize.cyan(bugsUrl));
    }

    console.log('\n' + Colorize.bold('Dependencies'));
    console.log('  Node.js:     ' + Colorize.cyan(process.version));
    console.log('  Platform:    ' + Colorize.cyan(`${process.platform} ${process.arch}`));

    clack.outro('');
  }
}
