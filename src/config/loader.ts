/**
 * Configuration loader using cosmiconfig
 */

import * as path from 'path';
import { cosmiconfigSync } from 'cosmiconfig';
import { FileSystem } from '@rushstack/node-core-library';
import type { MintlifyTsDocsConfig, ResolvedConfig } from './types';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';

const MODULE_NAME = 'mint-tsdocs';

/**
 * Find the path to the mint-tsdocs configuration file
 *
 * @param searchFrom - Directory to start searching from (default: current directory)
 * @returns Path to the config file, or undefined if not found
 */
export function findConfigPath(searchFrom?: string): string | undefined {
  const explorer = cosmiconfigSync(MODULE_NAME, {
    searchPlaces: [
      'package.json',
      `.${MODULE_NAME}rc`,
      `.${MODULE_NAME}rc.json`,
      `.${MODULE_NAME}rc.js`,
      `.${MODULE_NAME}rc.cjs`,
      `${MODULE_NAME}.config.js`,
      `${MODULE_NAME}.config.cjs`,
      `${MODULE_NAME}.config.json`
    ]
  });

  const result = explorer.search(searchFrom);
  return result?.filepath;
}

/**
 * Search for and load the mint-tsdocs configuration
 *
 * @see /config-reference - Configuration options reference
 * @see /guides/setup-guide - Setup guide
 */
export function loadConfig(searchFrom?: string): ResolvedConfig {
  const explorer = cosmiconfigSync(MODULE_NAME, {
    searchPlaces: [
      'package.json',
      `.${MODULE_NAME}rc`,
      `.${MODULE_NAME}rc.json`,
      `.${MODULE_NAME}rc.js`,
      `.${MODULE_NAME}rc.cjs`,
      `${MODULE_NAME}.config.js`,
      `${MODULE_NAME}.config.cjs`,
      `${MODULE_NAME}.config.json`
    ]
  });

  const result = explorer.search(searchFrom);

  if (!result || !result.config) {
    throw new DocumentationError(
      `No ${MODULE_NAME} configuration found. Run '${MODULE_NAME} init' to create one.`,
      ErrorCode.CONFIG_NOT_FOUND
    );
  }

  const config = result.config as MintlifyTsDocsConfig;
  const configDir = path.dirname(result.filepath);

  return resolveConfig(config, configDir);
}

/**
 * Auto-detect entry point from package.json or common paths
 */
function detectEntryPoint(configDir: string): string {
  // Check package.json
  const packageJsonPath = path.join(configDir, 'package.json');
  if (FileSystem.exists(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(FileSystem.readFile(packageJsonPath));
      if (packageJson.types) {
        const entryPoint = path.resolve(configDir, packageJson.types);
        if (FileSystem.exists(entryPoint)) {
          return entryPoint;
        }
      }
      if (packageJson.typings) {
        const entryPoint = path.resolve(configDir, packageJson.typings);
        if (FileSystem.exists(entryPoint)) {
          return entryPoint;
        }
      }
    } catch (error) {
      // Ignore package.json parse errors
    }
  }

  // Check common paths
  const commonPaths = [
    './lib/index.d.ts',
    './dist/index.d.ts',
    './build/index.d.ts',
    './types/index.d.ts'
  ];

  for (const commonPath of commonPaths) {
    const entryPoint = path.resolve(configDir, commonPath);
    if (FileSystem.exists(entryPoint)) {
      return entryPoint;
    }
  }

  throw new DocumentationError(
    `Could not auto-detect TypeScript entry point. Please specify "entryPoint" in your config.\nTried: ${commonPaths.join(', ')}`,
    ErrorCode.FILE_NOT_FOUND
  );
}

/**
 * Auto-detect Mintlify docs.json location
 */
function detectDocsJson(configDir: string): string | undefined {
  const commonPaths = [
    './docs.json',
    './docs/docs.json',
    './documentation/docs.json'
  ];

  for (const commonPath of commonPaths) {
    const docsJsonPath = path.resolve(configDir, commonPath);
    if (FileSystem.exists(docsJsonPath)) {
      return docsJsonPath;
    }
  }

  return undefined;
}

/**
 * Resolve and validate configuration with defaults
 */
export function resolveConfig(config: MintlifyTsDocsConfig, configDir: string): ResolvedConfig {
  // Resolve entry point
  const entryPoint = config.entryPoint
    ? path.resolve(configDir, config.entryPoint)
    : detectEntryPoint(configDir);

  // Verify entry point exists
  if (!FileSystem.exists(entryPoint)) {
    throw new DocumentationError(
      `Entry point not found: ${entryPoint}`,
      ErrorCode.FILE_NOT_FOUND
    );
  }

  // Resolve docs.json
  const docsJson = config.docsJson
    ? path.resolve(configDir, config.docsJson)
    : detectDocsJson(configDir);

  // Resolve output folder
  const outputFolder = config.outputFolder
    ? path.resolve(configDir, config.outputFolder)
    : path.resolve(configDir, './docs/reference');

  // Deep merge messages configuration to preserve defaults
  const defaultMessages = {
    compilerMessageReporting: {
      default: {
        logLevel: 'warning' as const
      }
    },
    extractorMessageReporting: {
      default: {
        logLevel: 'warning' as const
      }
    },
    tsdocMessageReporting: {
      default: {
        logLevel: 'warning' as const
      }
    }
  };

  const mergedMessages = {
    compilerMessageReporting: {
      ...defaultMessages.compilerMessageReporting,
      ...config.apiExtractor?.messages?.compilerMessageReporting
    },
    extractorMessageReporting: {
      ...defaultMessages.extractorMessageReporting,
      ...config.apiExtractor?.messages?.extractorMessageReporting
    },
    tsdocMessageReporting: {
      ...defaultMessages.tsdocMessageReporting,
      ...config.apiExtractor?.messages?.tsdocMessageReporting
    }
  };

  // Resolve defaults
  const resolved: ResolvedConfig = {
    entryPoint,
    outputFolder,
    docsJson: docsJson,
    tabName: config.tabName || 'API Reference',
    groupName: config.groupName || 'API',
    convertReadme: config.convertReadme ?? false,
    readmeTitle: config.readmeTitle || 'README',
    templates: {
      userTemplateDir: config.templates?.userTemplateDir || undefined,
      cache: config.templates?.cache ?? true,
      strict: config.templates?.strict ?? true,
      rendering: {
        hideStringEnumValues: config.templates?.rendering?.hideStringEnumValues ?? true
      }
    },
    apiExtractor: {
      bundledPackages: config.apiExtractor?.bundledPackages || [],
      compiler: config.apiExtractor?.compiler || {},
      apiReport: config.apiExtractor?.apiReport || {
        enabled: false
      },
      docModel: config.apiExtractor?.docModel || {
        enabled: true
      },
      dtsRollup: config.apiExtractor?.dtsRollup || {
        enabled: false
      },
      messages: mergedMessages,
      configPath: config.apiExtractor?.configPath
    }
  };

  return resolved;
}

/**
 * Generate API Extractor config from resolved config
 *
 * @param resolved - Resolved configuration
 * @param configDir - Configuration directory
 * @param tsdocsDir - .tsdocs cache directory
 * @param noLint - If true, suppress all linting warnings
 */
export function generateApiExtractorConfig(
  resolved: ResolvedConfig,
  configDir: string,
  tsdocsDir: string,
  noLint?: boolean
): any {
  // If custom config path specified, don't generate
  if (resolved.apiExtractor.configPath) {
    return null;
  }

  // Since config is in .tsdocs/, projectFolder points to parent (project root)
  const projectFolderFromCache = path.relative(tsdocsDir, configDir);

  // Convert absolute entryPoint to <projectFolder> relative path
  const entryPointFromProject = path.relative(configDir, resolved.entryPoint);

  return {
    $schema: 'https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json',

    // Set projectFolder so we can use <projectFolder> token
    projectFolder: projectFolderFromCache,

    // Use <projectFolder> token for paths
    mainEntryPointFilePath: `<projectFolder>/${entryPointFromProject.replace(/\\/g, '/')}`,

    bundledPackages: resolved.apiExtractor.bundledPackages || [],

    compiler: resolved.apiExtractor.compiler || {},

    apiReport: resolved.apiExtractor.apiReport || { enabled: false },

    docModel: {
      enabled: true,
      // API JSON is generated in the .tsdocs/ folder itself
      apiJsonFilePath: '<unscopedPackageName>.api.json',
      ...resolved.apiExtractor.docModel
    },

    dtsRollup: resolved.apiExtractor.dtsRollup || { enabled: false },

    // Use <lookup> to auto-detect tsdoc-metadata.json location from package.json
    tsdocMetadata: {
      enabled: true
    },

    messages: noLint
      ? {
          compilerMessageReporting: {
            default: { logLevel: 'none' }
          },
          extractorMessageReporting: {
            default: { logLevel: 'none' }
          },
          tsdocMessageReporting: {
            default: { logLevel: 'none' }
          }
        }
      : resolved.apiExtractor.messages
  };
}
