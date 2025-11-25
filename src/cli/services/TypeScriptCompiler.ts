import * as path from 'path';
import { execFileSync } from 'child_process';
import { FileSystem } from '@rushstack/node-core-library';
import { DocumentationError, ErrorCode } from '../../errors/DocumentationError';
import { SecurityUtils } from '../../utils/SecurityUtils';

export interface CompileOptions {
  projectDir: string;
  tsconfigPath: string;
  entryPoint: string;
}

export interface CompileResult {
  success: boolean;
  outputPath?: string;
  errors?: string[];
}

/**
 * Service for compiling TypeScript projects
 * Extracted from GenerateAction to improve reusability and testability
 */
export class TypeScriptCompiler {
  /**
   * Compile TypeScript project and return path to generated .d.ts file
   */
  public static async compile(options: CompileOptions): Promise<CompileResult> {
    const { projectDir, tsconfigPath, entryPoint } = options;

    try {
      // Validate paths
      const safeTsconfigPath = SecurityUtils.validateFilePath(projectDir, tsconfigPath);

      // Run TypeScript compiler
      const tscArgs = ['tsc', '--project', safeTsconfigPath];

      try {
        execFileSync('npx', tscArgs, {
          cwd: projectDir,
          stdio: 'pipe',
          encoding: 'utf-8'
        });
      } catch (error: any) {
        // TypeScript compilation failed
        const errorOutput = error.stderr || error.stdout || error.message;
        return {
          success: false,
          errors: [errorOutput]
        };
      }

      // Copy custom .d.ts files if they exist
      const outputPath = await this.copyCustomDtsFiles(projectDir, entryPoint);

      return {
        success: true,
        outputPath
      };
    } catch (error) {
      throw new DocumentationError(
        `TypeScript compilation failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.COMMAND_FAILED
      );
    }
  }

  /**
   * Copy custom .d.ts files to ensure they're included in API Extractor analysis
   * Some TypeScript configs may not emit .d.ts files for all declaration files
   */
  private static async copyCustomDtsFiles(projectDir: string, entryPoint: string): Promise<string> {
    // For now, return entryPoint as-is
    // TODO: Implement custom .d.ts file copying logic if needed
    return entryPoint;
  }
}
