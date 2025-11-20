/**
 * TypeScript configuration validation utilities
 */

import * as path from 'path';
import { FileSystem } from '@rushstack/node-core-library';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';

export interface TsConfigValidationResult {
  isValid: boolean;
  tsconfigPath: string;
  hasDeclaration: boolean;
  compilerOptions?: any;
}

export interface TsConfigFixOptions {
  action: 'fix' | 'extend' | 'pick' | 'abort';
  newTsconfigPath?: string;
}

/**
 * Validates that a tsconfig.json has emitDeclaration enabled
 */
export class TsConfigValidator {
  /**
   * Find tsconfig.json in project directory
   */
  public static findTsConfig(projectDir: string, customPath?: string): string | undefined {
    if (customPath) {
      const resolvedPath = path.resolve(projectDir, customPath);
      if (FileSystem.exists(resolvedPath)) {
        return resolvedPath;
      }
      return undefined;
    }

    // Check common paths
    const commonPaths = ['./tsconfig.json', './tsconfig.build.json', './tsconfig.lib.json'];

    for (const commonPath of commonPaths) {
      const tsconfigPath = path.resolve(projectDir, commonPath);
      if (FileSystem.exists(tsconfigPath)) {
        return tsconfigPath;
      }
    }

    return undefined;
  }

  /**
   * Validate that tsconfig has declaration: true
   */
  public static validateTsConfig(tsconfigPath: string): TsConfigValidationResult {
    if (!FileSystem.exists(tsconfigPath)) {
      return {
        isValid: false,
        tsconfigPath,
        hasDeclaration: false
      };
    }

    try {
      const content = FileSystem.readFile(tsconfigPath);
      // Try to parse directly first
      let tsconfig: any;
      try {
        tsconfig = JSON.parse(content);
      } catch (parseError) {
        // If parsing fails, try removing comments
        const cleanContent = content
          .replace(/\/\*[\s\S]*?\*\//g, '')          // Remove /* */ comments
          .replace(/^\s*\/\/.*$/gm, '');            // Remove // comments (only full-line)
        tsconfig = JSON.parse(cleanContent);
      }

      const compilerOptions = tsconfig.compilerOptions || {};
      const hasDeclaration = compilerOptions.declaration === true;

      return {
        isValid: hasDeclaration,
        tsconfigPath,
        hasDeclaration,
        compilerOptions
      };
    } catch (error) {
      throw new DocumentationError(
        `Failed to parse tsconfig.json at ${tsconfigPath}: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.INVALID_CONFIGURATION
      );
    }
  }

  /**
   * Fix tsconfig by enabling declaration
   */
  public static fixTsConfig(tsconfigPath: string): void {
    try {
      const content = FileSystem.readFile(tsconfigPath);
      const tsconfig = JSON.parse(content);

      if (!tsconfig.compilerOptions) {
        tsconfig.compilerOptions = {};
      }

      tsconfig.compilerOptions.declaration = true;

      FileSystem.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    } catch (error) {
      throw new DocumentationError(
        `Failed to update tsconfig.json at ${tsconfigPath}: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.INVALID_CONFIGURATION
      );
    }
  }

  /**
   * Create extended tsconfig with declaration enabled
   */
  public static createExtendedTsConfig(
    projectDir: string,
    baseTsconfigPath: string
  ): string {
    const extendedPath = path.join(projectDir, 'tsconfig.tsdocs.json');
    const relativePath = path.relative(projectDir, baseTsconfigPath);

    const extendedConfig = {
      extends: `./${relativePath}`,
      compilerOptions: {
        declaration: true
      }
    };

    FileSystem.writeFile(extendedPath, JSON.stringify(extendedConfig, null, 2));
    return extendedPath;
  }

  /**
   * Get relative path for display
   */
  public static getDisplayPath(projectDir: string, tsconfigPath: string): string {
    const relative = path.relative(projectDir, tsconfigPath);
    return relative.startsWith('.') ? relative : `./${relative}`;
  }
}
