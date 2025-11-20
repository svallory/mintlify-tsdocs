/**
 * Unified configuration types for mint-tsdocs
 */

/**
 * TypeScript compiler configuration for API Extractor
 */
export interface ApiExtractorCompilerConfig {
  /**
   * Path to the tsconfig.json file
   * @defaultValue Auto-detected from project root
   */
  tsconfigFilePath?: string;

  /**
   * Whether to skip type checking of declaration files
   * @defaultValue true
   */
  skipLibCheck?: boolean;
}

/**
 * Configuration for API report (.api.md) generation
 */
export interface ApiExtractorApiReportConfig {
  /**
   * Whether to generate API report files
   * @defaultValue false
   */
  enabled?: boolean;

  /**
   * Name of the API report file
   * @defaultValue "<unscopedPackageName>.api.md"
   */
  reportFileName?: string;

  /**
   * Folder where the API report file will be written
   * @defaultValue "<projectFolder>/temp/"
   */
  reportFolder?: string;

  /**
   * Temporary folder for API report generation
   * @defaultValue "<projectFolder>/temp/"
   */
  reportTempFolder?: string;
}

/**
 * Configuration for API documentation model (.api.json) generation
 */
export interface ApiExtractorDocModelConfig {
  /**
   * Whether to generate .api.json files for documentation
   * @defaultValue true
   */
  enabled?: boolean;

  /**
   * Base URL for source code links in documentation.
   * Should point to your repository on GitHub, GitLab, etc.
   * @example "https://github.com/username/repo/tree/main"
   */
  projectFolderUrl?: string;
}

/**
 * Configuration for TypeScript declaration (.d.ts) rollup generation
 */
export interface ApiExtractorDtsRollupConfig {
  /**
   * Whether to generate rolled-up .d.ts files
   * @defaultValue false
   */
  enabled?: boolean;

  /**
   * Path for the untrimmed .d.ts rollup file (includes all declarations)
   */
  untrimmedFilePath?: string;

  /**
   * Path for the alpha-trimmed .d.ts rollup file (includes `@public`, `@beta`, and `@alpha`)
   */
  alphaTrimmedFilePath?: string;

  /**
   * Path for the beta-trimmed .d.ts rollup file (includes `@public` and `@beta`)
   */
  betaTrimmedFilePath?: string;

  /**
   * Path for the public-trimmed .d.ts rollup file (includes only `@public`)
   */
  publicTrimmedFilePath?: string;
}

/**
 * Configuration for how specific messages should be reported
 */
export interface MessageReportingItem {
  /**
   * How to report this message type
   * - `error`: Report as an error (fails the build)
   * - `warning`: Report as a warning (doesn't fail the build)
   * - `none`: Suppress the message
   */
  logLevel?: 'error' | 'warning' | 'none';

  /**
   * Whether to include this message in the API report file
   * @defaultValue false
   */
  addToApiReportFile?: boolean;
}

/**
 * Configuration for controlling how different types of messages are reported
 */
export interface ApiExtractorMessagesConfig {
  /**
   * Configuration for TypeScript compiler messages
   * @example { "TS2551": { "logLevel": "warning" } }
   */
  compilerMessageReporting?: Record<string, MessageReportingItem>;

  /**
   * Configuration for API Extractor messages
   * @example { "ae-missing-release-tag": { "logLevel": "none" } }
   */
  extractorMessageReporting?: Record<string, MessageReportingItem>;

  /**
   * Configuration for TSDoc parser messages
   * @example { "tsdoc-param-tag-missing-hyphen": { "logLevel": "warning" } }
   */
  tsdocMessageReporting?: Record<string, MessageReportingItem>;
}

/**
 * Configuration for API Extractor tool integration.
 * API Extractor analyzes TypeScript declarations and generates documentation models.
 */
export interface ApiExtractorConfig {
  /**
   * Path to custom api-extractor.json file.
   * If specified, will use this instead of generating one automatically.
   * This allows full control over API Extractor configuration.
   */
  configPath?: string;

  /**
   * NPM packages to treat as part of this package.
   * Useful when you have multiple packages that should be documented together.
   * @example ["@mycompany/common", "@mycompany/utils"]
   */
  bundledPackages?: string[];

  /**
   * TypeScript compiler options for API analysis
   */
  compiler?: ApiExtractorCompilerConfig;

  /**
   * API report (.api.md) generation settings.
   * API reports show a text summary of your public API surface.
   */
  apiReport?: ApiExtractorApiReportConfig;

  /**
   * Doc model (.api.json) generation settings.
   * The doc model is used to generate the final MDX documentation.
   */
  docModel?: ApiExtractorDocModelConfig;

  /**
   * TypeScript declaration (.d.ts) rollup settings.
   * Rollups combine multiple .d.ts files into a single file.
   */
  dtsRollup?: ApiExtractorDtsRollupConfig;

  /**
   * Message reporting configuration.
   * Controls how different types of diagnostic messages are handled.
   */
  messages?: ApiExtractorMessagesConfig;
}

/**
 * Configuration for customizing documentation templates.
 * Templates control how API items are rendered in MDX format.
 */
export interface TemplateConfig {
  /**
   * Directory containing custom template overrides.
   * Templates are written in Liquid format and override default templates.
   * Use `mint-tsdocs customize -t ./templates` to initialize templates.
   * @example "./templates"
   */
  userTemplateDir?: string;

  /**
   * Whether to enable template caching for better performance.
   * Disable during development if templates aren't updating.
   * @defaultValue true
   */
  cache?: boolean;

  /**
   * Whether to use strict mode for templates.
   * Strict mode will throw errors for undefined variables.
   * @defaultValue true
   */
  strict?: boolean;
}

/**
 * Main configuration interface for mint-tsdocs.
 * This configuration can be provided in mint-tsdocs.config.json or package.json.
 */
export interface MintlifyTsDocsConfig {
  /**
   * JSON Schema reference for IDE autocomplete.
   * Points to the schema file for validation and IntelliSense support.
   * @defaultValue "./node_modules/mint-tsdocs/lib/schemas/config.schema.json"
   */
  $schema?: string;

  /**
   * Path to the main TypeScript declaration file (.d.ts) to document.
   * This is typically the output of your TypeScript build process.
   * If not specified, will auto-detect from package.json `types` or `typings` field.
   * @example "./lib/index.d.ts"
   */
  entryPoint?: string;

  /**
   * Directory where MDX documentation files will be generated.
   * Generated files are organized by API item type (classes, interfaces, etc.).
   * @defaultValue "./docs/reference"
   */
  outputFolder?: string;

  /**
   * Path to Mintlify's docs.json file for navigation integration.
   * This file will be updated with links to the generated documentation pages.
   * If not specified, will search for docs.json in common locations.
   * @example "./docs/docs.json"
   */
  docsJson?: string;

  /**
   * Name of the tab in Mintlify navigation where API docs will appear.
   * This creates a top-level navigation tab in your Mintlify docs.
   * @defaultValue "API Reference"
   */
  tabName?: string;

  /**
   * Name of the group within the tab for organizing API documentation pages.
   * Groups help organize related API pages under a common section.
   * @defaultValue "API"
   */
  groupName?: string;

  /**
   * Whether to convert README.md to index.mdx in the output folder.
   * Useful for including package overview documentation.
   * @defaultValue false
   */
  convertReadme?: boolean;

  /**
   * Title for the converted README file in navigation.
   * Only used when `convertReadme` is true.
   * @defaultValue "README"
   */
  readmeTitle?: string;

  /**
   * Template customization options.
   * Configure custom templates to control how API items are rendered.
   */
  templates?: TemplateConfig;

  /**
   * API Extractor configuration.
   * Controls how TypeScript declarations are analyzed and processed.
   * Configuration is written to .tsdocs/api-extractor.json during generation.
   */
  apiExtractor?: ApiExtractorConfig;
}

/**
 * Resolved template configuration with all defaults applied.
 * This is the final template configuration used internally after resolving defaults.
 */
export interface ResolvedTemplateConfig {
  /**
   * Directory containing custom template overrides
   */
  userTemplateDir?: string;

  /**
   * Whether template caching is enabled
   */
  cache: boolean;

  /**
   * Whether strict mode is enabled for templates
   */
  strict: boolean;
}

/**
 * Resolved configuration after applying defaults and auto-detection.
 * This is the final configuration used internally by mint-tsdocs.
 * All optional fields from MintlifyTsDocsConfig are resolved to concrete values.
 */
export interface ResolvedConfig {
  /**
   * Resolved path to the main TypeScript declaration file (.d.ts)
   */
  entryPoint: string;

  /**
   * Resolved directory where MDX documentation files will be generated
   */
  outputFolder: string;

  /**
   * Resolved tab name in Mintlify navigation
   */
  tabName: string;

  /**
   * Resolved group name within the tab
   */
  groupName: string;

  /**
   * Resolved path to Mintlify's docs.json file (if found)
   */
  docsJson?: string;

  /**
   * Whether to convert README.md to index.mdx
   */
  convertReadme: boolean;

  /**
   * Title for the converted README file
   */
  readmeTitle: string;

  /**
   * Resolved template configuration with all defaults applied
   */
  templates: ResolvedTemplateConfig;

  /**
   * Resolved API Extractor configuration
   */
  apiExtractor: ApiExtractorConfig;
}
