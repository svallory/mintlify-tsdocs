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

    // Package Information
    clack.note(
      [
        `Name:        ${Colorize.cyan(name)}`,
        `Version:     ${Colorize.cyan(version)}`,
        `Description: ${packageJson.description || 'N/A'}`,
        `License:     ${packageJson.license || 'N/A'}`
      ].join('\n'),
      Colorize.bold('Package Information')
    );

    // Links
    const links: string[] = [];
    if (packageJson.homepage) {
      links.push(`Homepage:    ${Colorize.cyan(packageJson.homepage)}`);
    }
    if (packageJson.repository) {
      const repo = typeof packageJson.repository === 'string'
        ? packageJson.repository
        : packageJson.repository.url;
      links.push(`Repository:  ${Colorize.cyan(repo)}`);
    }
    const bugs = (packageJson as any).bugs;
    if (bugs) {
      const bugsUrl = typeof bugs === 'string' ? bugs : bugs.url;
      links.push(`Report bugs: ${Colorize.cyan(bugsUrl)}`);
    }
    if (links.length > 0) {
      clack.note(links.join('\n'), Colorize.bold('Links'));
    }

    // Dependencies
    clack.note(
      [
        `Node.js:     ${Colorize.cyan(process.version)}`,
        `Platform:    ${Colorize.cyan(`${process.platform} ${process.arch}`)}`
      ].join('\n'),
      Colorize.bold('Dependencies')
    );
    
    clack.outro(`Meet (and hire?) the author at ${Colorize.cyan('https://saulo.engineer/')}`)
  }
}
