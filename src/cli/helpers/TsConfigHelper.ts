import * as clack from '@clack/prompts';
import { TsConfigValidator } from '../../utils/TsConfigValidator';
import { DocumentationError, ErrorCode } from '../../errors/DocumentationError';

export interface ValidateTsConfigOptions {
  projectDir: string;
  tsconfigPath?: string;
  interactive: boolean; // false for --yes mode
}

export interface TsConfigValidationResult {
  isValid: boolean;
  tsconfigPath: string;
  action?: 'fix' | 'extend' | 'pick' | 'abort';
}

/**
 * Helper for validating and fixing tsconfig.json with user interaction
 * Extracted from GenerateAction to improve reusability
 */
export class TsConfigHelper {
  /**
   * Validate tsconfig and prompt user to fix if needed
   */
  public static async validateAndFix(options: ValidateTsConfigOptions): Promise<TsConfigValidationResult> {
    const { projectDir, tsconfigPath: customPath, interactive } = options;

    // Find tsconfig
    const tsconfigPath = TsConfigValidator.findTsConfig(projectDir, customPath);
    if (!tsconfigPath) {
      throw new DocumentationError(
        'No tsconfig.json found in project directory',
        ErrorCode.FILE_NOT_FOUND
      );
    }

    // Validate tsconfig
    const validation = TsConfigValidator.validateTsConfig(tsconfigPath);

    if (validation.isValid) {
      return {
        isValid: true,
        tsconfigPath
      };
    }

    // If non-interactive, fail immediately
    if (!interactive) {
      throw new DocumentationError(
        `tsconfig.json must have "declaration: true" in compilerOptions. Found at: ${tsconfigPath}`,
        ErrorCode.INVALID_CONFIGURATION
      );
    }

    // Prompt user for fix
    const displayPath = TsConfigValidator.getDisplayPath(projectDir, tsconfigPath);

    const action = await clack.select({
      message: `TypeScript config at ${displayPath} doesn't have "declaration: true". How should we proceed?`,
      options: [
        { value: 'fix', label: 'Update the file automatically', hint: 'Adds "declaration: true"' },
        { value: 'extend', label: 'Create tsconfig.tsdocs.json that extends it', hint: 'Safer option' },
        { value: 'pick', label: 'Let me choose a different tsconfig', hint: 'Use tsconfig.build.json instead' },
        { value: 'abort', label: 'Cancel and fix it manually', hint: 'I\'ll handle this myself' }
      ]
    }) as 'fix' | 'extend' | 'pick' | 'abort';

    if (clack.isCancel(action) || action === 'abort') {
      throw new DocumentationError(
        'Cancelled by user',
        ErrorCode.USER_CANCELLED
      );
    }

    // Handle fix actions
    let finalTsconfigPath = tsconfigPath;

    if (action === 'fix') {
      TsConfigValidator.fixTsConfig(tsconfigPath);
      clack.log.success(`Updated ${displayPath}`);
    } else if (action === 'extend') {
      finalTsconfigPath = TsConfigValidator.createExtendedTsConfig(projectDir, tsconfigPath);
      clack.log.success(`Created tsconfig.tsdocs.json`);
    } else if (action === 'pick') {
      const newPath = await clack.text({
        message: 'Enter path to tsconfig (e.g., ./tsconfig.build.json):',
        placeholder: './tsconfig.build.json',
        validate: (value) => {
          if (!value) return 'Path is required';
          const found = TsConfigValidator.findTsConfig(projectDir, value);
          if (!found) return `File not found: ${value}`;
          const validation = TsConfigValidator.validateTsConfig(found);
          if (!validation.isValid) return 'This tsconfig also needs "declaration: true"';
          return undefined;
        }
      });

      if (clack.isCancel(newPath)) {
        throw new DocumentationError('Cancelled by user', ErrorCode.USER_CANCELLED);
      }

      finalTsconfigPath = TsConfigValidator.findTsConfig(projectDir, newPath as string)!;
    }

    return {
      isValid: true,
      tsconfigPath: finalTsconfigPath,
      action
    };
  }
}
