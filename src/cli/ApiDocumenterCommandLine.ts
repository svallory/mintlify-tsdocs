import { CommandLineParser, type CommandLineFlagParameter } from '@rushstack/ts-command-line';
import { GenerateAction } from './GenerateAction';
import { CustomizeAction } from './CustomizeAction';
import { InitAction } from './InitAction';
import { HelpAction } from './HelpAction';
import { VersionAction } from './VersionAction';
import { ShowAction } from './ShowAction';
import { ConfigAction } from './ConfigAction';
import { LintAction } from './LintAction';
import { CoverageAction } from './CoverageAction';

/**
 * Main CLI parser for the mint-tsdocs tool.
 *
 * This class sets up the command-line interface for generating Mintlify-compatible
 * MDX documentation from TypeScript API documentation. The tool supports three main actions:
 * - `init`: Initialize a project with mint-tsdocs configuration
 * - `generate`: Run api-extractor and generate MDX documentation files
 * - `customize`: Create customizable template files for documentation generation
 *
 * @see /cli-reference - Complete CLI command reference
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
      toolFilename: 'mint-tsdocs',
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
   * Override executeAsync to handle default action and directory argument
   */
  public override async executeAsync(args?: string[]): Promise<boolean> {
    // Get the arguments (default to process.argv)
    const actualArgs = args || process.argv.slice(2);

    // If no arguments provided, default to 'generate'
    if (actualArgs.length === 0) {
      return super.executeAsync(['generate']);
    }

    const firstArg = actualArgs[0];

    // If first arg doesn't start with '-' and isn't a known action, treat it as a directory for generate
    const knownActions = ['init', 'generate', 'customize', 'show', 'config', 'lint', 'coverage', 'help', 'version', '--help', '-h', '--version', '-v'];
    if (!firstArg.startsWith('-') && !knownActions.includes(firstArg)) {
      // Treat as positional argument for generate
      // Insert 'generate' action and pass remaining args as remainder
      return super.executeAsync(['generate', ...actualArgs]);
    }

    // Default behavior - pass through to parent
    return super.executeAsync(actualArgs);
  }

  /**
   * Registers all available CLI actions.
   *
   * @private
   */
  private _populateActions(): void {
    this.addAction(new InitAction(this));
    this.addAction(new GenerateAction(this));
    this.addAction(new CustomizeAction());
    this.addAction(new ShowAction());
    this.addAction(new ConfigAction());
    this.addAction(new LintAction(this));
    this.addAction(new CoverageAction(this));
    this.addAction(new HelpAction(this));
    this.addAction(new VersionAction());
  }
}
