// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as path from 'path';
import { CommandLineAction, CommandLineStringParameter } from '@rushstack/ts-command-line';
import { FileSystem } from '@rushstack/node-core-library';
import { Colorize } from '@rushstack/terminal';
import * as clack from '@clack/prompts';
import { loadConfig } from '../config';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import { getGlobalCacheManager } from '../cache/CacheManager';
import { showCliHeader } from './CliHelpers';
import * as ShowHelp from './help/ShowHelp';

/**
 * CLI action for displaying configuration and statistics.
 *
 * @public
 */
export class ShowAction extends CommandLineAction {
  private readonly _targetParameter: CommandLineStringParameter;

  public constructor() {
    super({
      actionName: 'show',
      summary: 'Display configuration or statistics',
      documentation:
        'Shows information about the current configuration or cache statistics.\n\n' +
        'Available targets:\n' +
        '  config  - Display current configuration\n' +
        '  stats   - Display cache statistics\n\n' +
        'Examples:\n' +
        '  mint-tsdocs show config\n' +
        '  mint-tsdocs show stats'
    });

    this._targetParameter = this.defineStringParameter({
      parameterLongName: '--target',
      argumentName: 'TARGET',
      description: 'What to show: config or stats'
    });

    // Define remainder to accept positional target argument
    this.defineCommandLineRemainder({
      description: 'Target to show (config or stats)'
    });
  }

  protected override async onExecuteAsync(): Promise<void> {
    // Check if --help was requested (check process.argv since ts-command-line intercepts it)
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      ShowHelp.showHelp();
      return;
    }

    // Get target from remainder args or parameter
    const target = (this.remainder && this.remainder.values.length > 0)
      ? this.remainder.values[0]
      : (this._targetParameter.value || 'config');

    switch (target.toLowerCase()) {
      case 'config':
        await this._showConfig();
        break;
      case 'stats':
        await this._showStats();
        break;
      default:
        throw new DocumentationError(
          `Unknown show target: "${target}". Use "config" or "stats".`,
          ErrorCode.INVALID_CONFIGURATION
        );
    }
  }

  private async _showConfig(): Promise<void> {
    showCliHeader();
    console.log('\n' + Colorize.bold('Configuration'));

    try {
      const config = loadConfig(process.cwd());

      console.log('\n' + Colorize.bold('Project Settings'));
      console.log('  Entry Point:     ' + Colorize.cyan(config.entryPoint));
      console.log('  Output Folder:   ' + Colorize.cyan(config.outputFolder));
      
      if (config.docsJson) {
        console.log('  Docs JSON:       ' + Colorize.cyan(config.docsJson));
      }

      console.log('\n' + Colorize.bold('Navigation'));
      console.log('  Tab Name:        ' + Colorize.cyan(config.tabName || 'API Reference'));
      console.log('  Group Name:      ' + Colorize.cyan(config.groupName || 'API'));

      console.log('\n' + Colorize.bold('README'));
      console.log('  Convert README:  ' + Colorize.cyan(config.convertReadme ? 'Yes' : 'No'));
      if (config.convertReadme) {
        console.log('  README Title:    ' + Colorize.cyan(config.readmeTitle || 'README'));
      }

      console.log('\n' + Colorize.bold('Templates'));
      if (config.templates?.userTemplateDir) {
        console.log('  User Templates:  ' + Colorize.cyan(config.templates.userTemplateDir));
        console.log('  Cache:           ' + Colorize.cyan(config.templates.cache ? 'Enabled' : 'Disabled'));
        console.log('  Strict Mode:     ' + Colorize.cyan(config.templates.strict ? 'Enabled' : 'Disabled'));
      } else {
        console.log('  Using default templates');
      }

      console.log('\n' + Colorize.bold('API Extractor'));
      if (config.apiExtractor.configPath) {
        console.log('  Config Path:     ' + Colorize.cyan(config.apiExtractor.configPath));
      } else {
        console.log('  Auto-generated config in .tsdocs/');
      }

      if (config.apiExtractor.bundledPackages && config.apiExtractor.bundledPackages.length > 0) {
        console.log('  Bundled:         ' + Colorize.cyan(config.apiExtractor.bundledPackages.join(', ')));
      }

      if (config.apiExtractor.compiler?.tsconfigFilePath) {
        console.log('  TSConfig:        ' + Colorize.cyan(config.apiExtractor.compiler.tsconfigFilePath));
      }

      console.log('\n' + Colorize.dim('Note: TSDoc configuration is in tsdoc.json at project root'));

      clack.outro('Configuration loaded successfully');
    } catch (error) {
      if (error instanceof DocumentationError && error.code === ErrorCode.CONFIG_NOT_FOUND) {
        clack.log.error('No mint-tsdocs configuration found.');
        clack.outro('Run ' + Colorize.cyan('mint-tsdocs init') + ' to create a configuration file');
      } else {
        throw error;
      }
    }
  }

  private async _showStats(): Promise<void> {
    showCliHeader();
    console.log('\n' + Colorize.bold('Cache Statistics'));

    const cacheManager = getGlobalCacheManager();
    const stats = cacheManager.getStats();

    console.log('\n' + Colorize.bold('Cache Status'));
    console.log('  Enabled:         ' + Colorize.cyan(stats.enabled ? 'Yes' : 'No'));

    if (!stats.enabled) {
      clack.outro('Caching is disabled');
      return;
    }

    console.log('\n' + Colorize.bold('Type Analysis Cache'));
    console.log('  Entries:         ' + Colorize.cyan(stats.typeAnalysis.size.toString()));
    console.log('  Max Size:        ' + Colorize.cyan(stats.typeAnalysis.maxSize.toString()));
    console.log('  Hits:            ' + Colorize.cyan(stats.typeAnalysis.hitCount.toString()));
    console.log('  Misses:          ' + Colorize.cyan(stats.typeAnalysis.missCount.toString()));
    console.log('  Hit Rate:        ' + Colorize.cyan(`${stats.typeAnalysis.hitRate.toFixed(1)}%`));

    console.log('\n' + Colorize.bold('API Resolution Cache'));
    console.log('  Entries:         ' + Colorize.cyan(stats.apiResolution.size.toString()));
    console.log('  Max Size:        ' + Colorize.cyan(stats.apiResolution.maxSize.toString()));
    console.log('  Hits:            ' + Colorize.cyan(stats.apiResolution.hitCount.toString()));
    console.log('  Misses:          ' + Colorize.cyan(stats.apiResolution.missCount.toString()));
    console.log('  Hit Rate:        ' + Colorize.cyan(`${stats.apiResolution.hitRate.toFixed(1)}%`));

    console.log('\n' + Colorize.bold('Performance Summary'));
    const totalHits = stats.typeAnalysis.hitCount + stats.apiResolution.hitCount;
    const totalMisses = stats.typeAnalysis.missCount + stats.apiResolution.missCount;
    const overallHitRate = totalHits + totalMisses > 0
      ? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(1)
      : '0.0';
    console.log('  Overall Hit Rate: ' + Colorize.cyan(`${overallHitRate}%`));
    console.log('  Total Lookups:    ' + Colorize.cyan((totalHits + totalMisses).toString()));

    clack.outro('');
  }
}
