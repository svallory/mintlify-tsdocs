/**
 * Unified configuration types for mint-tsdocs
 */

export interface ApiExtractorCompilerConfig {
  tsconfigFilePath?: string;
  skipLibCheck?: boolean;
}

export interface ApiExtractorApiReportConfig {
  enabled?: boolean;
  reportFileName?: string;
  reportFolder?: string;
  reportTempFolder?: string;
}

export interface ApiExtractorDocModelConfig {
  enabled?: boolean;
  projectFolderUrl?: string;
}

export interface ApiExtractorDtsRollupConfig {
  enabled?: boolean;
  untrimmedFilePath?: string;
  alphaTrimmedFilePath?: string;
  betaTrimmedFilePath?: string;
  publicTrimmedFilePath?: string;
}

export interface MessageReportingItem {
  logLevel?: 'error' | 'warning' | 'none';
  addToApiReportFile?: boolean;
}

export interface ApiExtractorMessagesConfig {
  compilerMessageReporting?: Record<string, MessageReportingItem>;
  extractorMessageReporting?: Record<string, MessageReportingItem>;
  tsdocMessageReporting?: Record<string, MessageReportingItem>;
}

export interface ApiExtractorConfig {
  /**
   * Path to custom api-extractor.json file.
   * If specified, will use this instead of generating one.
   */
  configPath?: string;

  /**
   * NPM packages to treat as part of this package
   */
  bundledPackages?: string[];

  /**
   * TypeScript compiler options
   */
  compiler?: ApiExtractorCompilerConfig;

  /**
   * API report (.api.md) generation settings
   */
  apiReport?: ApiExtractorApiReportConfig;

  /**
   * Doc model (.api.json) generation settings
   */
  docModel?: ApiExtractorDocModelConfig;

  /**
   * TypeScript declaration rollup settings
   */
  dtsRollup?: ApiExtractorDtsRollupConfig;

  /**
   * Message reporting configuration
   */
  messages?: ApiExtractorMessagesConfig;
}

export interface TemplateConfig {
  /**
   * Directory containing custom template overrides
   */
  userTemplateDir?: string;

  /**
   * Whether to enable template caching
   */
  cache?: boolean;

  /**
   * Whether to use strict mode for templates
   */
  strict?: boolean;
}

export interface MintlifyTsDocsConfig {
  /**
   * JSON Schema reference
   */
  $schema?: string;

  /**
   * Path to the main TypeScript declaration file (.d.ts) to document.
   * If not specified, will auto-detect from package.json or common paths.
   */
  entryPoint?: string;

  /**
   * Directory where MDX documentation files will be generated.
   * Defaults to './docs/reference'
   */
  outputFolder?: string;

  /**
   * Path to Mintlify's docs.json file for navigation integration.
   * If not specified, will search for docs.json in common locations.
   */
  docsJson?: string;

  /**
   * Name of the tab in Mintlify navigation where API docs will appear.
   * Defaults to 'API Reference'
   */
  tabName?: string;

  /**
   * Name of the group within the tab for organizing API documentation pages.
   * Defaults to 'API'
   */
  groupName?: string;

  /**
   * Whether to convert README.md to index.mdx
   */
  convertReadme?: boolean;

  /**
   * Title for the converted README file
   */
  readmeTitle?: string;

  /**
   * Template customization options
   */
  templates?: TemplateConfig;

  /**
   * API Extractor configuration (written to .tsdocs/api-extractor.json)
   */
  apiExtractor?: ApiExtractorConfig;
}

export interface ResolvedConfig {
  entryPoint: string;
  outputFolder: string;
  tabName: string;
  groupName: string;
  docsJson?: string;
  convertReadme: boolean;
  readmeTitle: string;
  templates: {
    userTemplateDir?: string;
    cache: boolean;
    strict: boolean;
  };
  apiExtractor: ApiExtractorConfig;
}
