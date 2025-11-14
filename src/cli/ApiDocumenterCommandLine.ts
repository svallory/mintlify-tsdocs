// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { CommandLineParser, type CommandLineFlagParameter } from '@rushstack/ts-command-line';
import { GenerateAction } from './GenerateAction';
import { CustomizeAction } from './CustomizeAction';
import { InitAction } from './InitAction';

/**
 * Main CLI parser for the mintlify-tsdocs tool.
 *
 * This class sets up the command-line interface for generating Mintlify-compatible
 * MDX documentation from TypeScript API documentation. The tool supports three main actions:
 * - `init`: Initialize a project with mintlify-tsdocs configuration
 * - `generate`: Run api-extractor and generate MDX documentation files
 * - `customize`: Create customizable template files for documentation generation
 *
 * @public
 */
export class DocumenterCli extends CommandLineParser {
  private _verboseFlag: CommandLineFlagParameter | undefined;
  private _debugFlag: CommandLineFlagParameter | undefined;
  private _quietFlag: CommandLineFlagParameter | undefined;

  /**
   * Initializes the CLI parser with tool metadata and available actions.
   */
  public constructor() {
    super({
      toolFilename: 'mintlify-tsdocs',
      toolDescription:
        'Reads *.api.json files produced by api-extractor and generates ' +
        'Mintlify-compatible MDX documentation with proper frontmatter and navigation.'
    });
    this._populateActions();
  }

  /**
   * Get the verbose flag value
   * Note: Debug mode automatically enables verbose
   */
  public get isVerbose(): boolean {
    return this._verboseFlag?.value ?? this.isDebug;
  }

  /**
   * Get the debug flag value
   */
  public get isDebug(): boolean {
    return this._debugFlag?.value ?? false;
  }

  /**
   * Get the quiet flag value
   */
  public get isQuiet(): boolean {
    return this._quietFlag?.value ?? false;
  }

  /**
   * Define global parameters that apply to all actions
   */
  protected onDefineParameters(): void {
    this._verboseFlag = this.defineFlagParameter({
      parameterLongName: '--verbose',
      parameterShortName: '-v',
      description: 'Show verbose output (info level logging)'
    });

    this._debugFlag = this.defineFlagParameter({
      parameterLongName: '--debug',
      description: 'Show debug output (implies --verbose)'
    });

    this._quietFlag = this.defineFlagParameter({
      parameterLongName: '--quiet',
      parameterShortName: '-q',
      description: 'Suppress all output except errors'
    });
  }

  /**
   * Registers all available CLI actions.
   * Supports three actions:
   * - `init`: Initialize project configuration
   * - `generate`: Run api-extractor and generate MDX documentation
   * - `customize`: Initialize customizable template files
   *
   * @private
   */
  private _populateActions(): void {
    this.addAction(new InitAction(this));
    this.addAction(new GenerateAction(this));
    this.addAction(new CustomizeAction());
  }
}
