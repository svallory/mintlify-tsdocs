import * as child_process from 'child_process';
import * as clack from '@clack/prompts';
import { DocumentationError, ErrorCode } from '../../errors/DocumentationError';
import { SecurityUtils } from '../../utils/SecurityUtils';

export interface CommandOptions {
  cwd: string;
  inheritStdio?: boolean;
  debug?: boolean;
}

export interface CommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
}

/**
 * Utility for running shell commands with proper error handling and user feedback
 * Extracted from InitAction._runCommand
 */
export class CommandRunner {
  /**
   * Run a shell command with spinner feedback
   */
  public static async run(
    command: string,
    args: string[],
    message: string,
    options: CommandOptions
  ): Promise<CommandResult> {
    const { cwd, inheritStdio = false, debug = false } = options;

    // Validate command (prevent injection)
    const safeCommand = SecurityUtils.validateCliInput(command, 'Command');
    const safeArgs = args.map(arg => SecurityUtils.validateCliInput(arg, 'Command argument'));

    if (debug) {
      console.log(`Running: ${safeCommand} ${safeArgs.join(' ')}`);
    }

    const spinner = clack.spinner();
    spinner.start(message);

    return new Promise((resolve, reject) => {
      const childProcess = child_process.spawn(safeCommand, safeArgs, {
        cwd,
        stdio: inheritStdio ? 'inherit' : 'pipe',
        shell: false // Important: disable shell to prevent injection
      });

      let stdout = '';
      let stderr = '';

      if (!inheritStdio) {
        childProcess.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        childProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      childProcess.on('close', (code) => {
        if (code === 0) {
          spinner.stop(`${message} - Done`);
          resolve({ success: true, stdout, stderr });
        } else {
          spinner.stop(`${message} - Failed`);
          const errorMsg = inheritStdio
            ? `Command failed with exit code ${code}`
            : `Command failed with exit code ${code}\n${stderr || stdout}`;

          reject(new DocumentationError(errorMsg, ErrorCode.COMMAND_FAILED));
        }
      });

      childProcess.on('error', (error) => {
        spinner.stop(`${message} - Failed`);
        reject(new DocumentationError(
          `Failed to start command: ${error.message}`,
          ErrorCode.COMMAND_FAILED
        ));
      });
    });
  }
}
