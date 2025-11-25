import * as path from 'path';
import { FileSystem } from '@rushstack/node-core-library';

import { LiquidTemplateEngine } from './LiquidTemplateEngine';
import { TemplateDataConverter } from './TemplateDataConverter';
import { TemplateMerger } from './TemplateMerger';
import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import { ITemplateData, ITemplateEngineOptions } from './TemplateEngine';
import type { ApiItem, ApiItemKind, ApiModel } from '@microsoft/api-extractor-model';
import { createDebugger, type Debugger } from '../utils/debug';
import { LinkValidator } from '../utils/LinkValidator';

const debug: Debugger = createDebugger('liquid-template-manager');

/**
 * Configuration for Liquid template manager
 */
export interface ILiquidTemplateManagerOptions extends ITemplateEngineOptions {
  userTemplateDir?: string;
  defaultTemplateDir?: string;
  /**
   * Individual template overrides - map template names to file paths
   */
  overrides?: Record<string, string>;
  /**
   * API model for type reference resolution
   */
  apiModel?: ApiModel;
  /**
   * Link validator for generating type references
   */
  linkValidator?: LinkValidator;
  /**
   * Whether to trust template data and skip sanitization
   * Default: false (data is sanitized for security)
   */
  trustData?: boolean;
}

/**
 * Template manager that uses LiquidJS with template merging
 */
export class LiquidTemplateManager {
  private _liquidEngine: LiquidTemplateEngine;
  private readonly _templateDataConverter: TemplateDataConverter;
  private readonly _overrides: Record<string, string>;
  private readonly _userTemplateDir?: string;
  private readonly _defaultTemplateDir: string;
  private _mergedTemplateDir?: string;
  private _cache: boolean;
  private _strict: boolean;
  private readonly _trustData: boolean;

  public constructor(options: ILiquidTemplateManagerOptions = {}) {
    this._overrides = options.overrides || {};
    this._userTemplateDir = options.userTemplateDir;
    // Default templates are bundled in lib/templates/defaults after build
    this._defaultTemplateDir = options.defaultTemplateDir || path.join(__dirname, '..', 'templates', 'defaults');
    this._cache = options.cache !== false;
    this._strict = options.strict !== false;
    this._trustData = options.trustData ?? false;

    // Create Liquid engine (will be initialized with merged directory)
    this._liquidEngine = new LiquidTemplateEngine({
      templateDir: this._defaultTemplateDir, // Temporary, will be updated
      cache: this._cache,
      strict: this._strict,
      trustData: this._trustData
    });

    // Create TemplateDataConverter with apiModel and linkValidator if provided
    if (options.apiModel && options.linkValidator) {
      this._templateDataConverter = new TemplateDataConverter(options.apiModel, options.linkValidator);
    } else {
      // For backward compatibility, throw error if not provided
      throw new DocumentationError(
        'apiModel and linkValidator are required for LiquidTemplateManager',
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Initialize the template manager by creating merged template directory
   */
  public async initialize(): Promise<void> {
    // Create merged template directory
    this._mergedTemplateDir = await TemplateMerger.createMergedTemplateDir(
      this._userTemplateDir,
      this._defaultTemplateDir
    );

    // Reinitialize Liquid engine with merged directory
    this._liquidEngine = new LiquidTemplateEngine({
      templateDir: this._mergedTemplateDir,
      cache: this._cache,
      strict: this._strict,
      trustData: this._trustData
    });
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    if (this._mergedTemplateDir) {
      await TemplateMerger.cleanupTempDir(this._mergedTemplateDir);
      this._mergedTemplateDir = undefined;
    }
  }

  /**
   * Render an API item using the appropriate template
   */
  public async renderApiItem(apiItem: ApiItem, data: ITemplateData): Promise<string> {
    if (!this._mergedTemplateDir) {
      throw new DocumentationError(
        'Template manager not initialized. Call initialize() first.',
        ErrorCode.TEMPLATE_ERROR
      );
    }

    const templateName = this._getTemplateName(apiItem);
    return this.renderTemplate(templateName, data);
  }

  /**
   * Render a template with user override support
   */
  public async renderTemplate(templateName: string, data: ITemplateData): Promise<string> {
    if (!this._mergedTemplateDir) {
      throw new DocumentationError(
        'Template manager not initialized. Call initialize() first.',
        ErrorCode.TEMPLATE_ERROR
      );
    }

    // Check for individual template override first (use hasOwnProperty to avoid inherited properties like 'constructor')
    if (Object.prototype.hasOwnProperty.call(this._overrides, templateName)) {
      try {
        const overrideContent = await this._loadOverrideTemplate(templateName);
        return await this._renderLiquidTemplateContent(overrideContent, data, templateName);
      } catch (error) {
        debug.warn(`Template override '${templateName}' failed, falling back to standard templates:`, error);
      }
    }

    // Use Liquid engine directly
    try {
      return await this._liquidEngine.render(templateName, data);
    } catch (error) {
      // Enhanced error message with context about the data being rendered
      const apiItemName = data.apiItem?.name || 'unknown';
      const apiItemKind = data.apiItem?.kind || 'unknown';
      const contextInfo = apiItemName !== 'unknown' ? ` (API item: ${apiItemName} [${apiItemKind}])` : '';

      throw new DocumentationError(
        `Failed to render Liquid template '${templateName}'${contextInfo}: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.TEMPLATE_RENDER_ERROR,
        {
          cause: error instanceof Error ? error : new Error(String(error)),
          data: {
            template: templateName,
            apiItem: data.apiItem,
            availableTemplates: this.getAvailableTemplates()
          }
        }
      );
    }
  }

  /**
   * Render Liquid template content directly (for overrides)
   */
  private async _renderLiquidTemplateContent(content: string, data: ITemplateData, templateName: string): Promise<string> {
    try {
      // Parse and render the template content directly using the Liquid engine
      const result = await this._liquidEngine.liquid.parseAndRender(content, data);
      return this._liquidEngine.postProcessOutput(result);
    } catch (error) {
      // Enhanced error message with context
      const apiItemName = data.apiItem?.name || 'unknown';
      const apiItemKind = data.apiItem?.kind || 'unknown';
      const contextInfo = apiItemName !== 'unknown' ? ` (API item: ${apiItemName} [${apiItemKind}])` : '';

      throw new DocumentationError(
        `Failed to render Liquid template override '${templateName}'${contextInfo}: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.TEMPLATE_RENDER_ERROR,
        {
          cause: error instanceof Error ? error : new Error(String(error)),
          data: {
            template: templateName,
            templateType: 'override',
            apiItem: data.apiItem
          }
        }
      );
    }
  }

  /**
   * Render a layout template
   */
  public async renderLayout(data: ITemplateData): Promise<string> {
    return this.renderTemplate('layout', data);
  }

  /**
   * Get available Liquid templates
   */
  public getAvailableTemplates(): string[] {
    if (!this._mergedTemplateDir) {
      return [];
    }
    return TemplateMerger.getTemplateNames(this._mergedTemplateDir);
  }

  /**
   * Check if a Liquid template exists
   */
  public hasTemplate(templateName: string): boolean {
    if (!this._mergedTemplateDir) {
      return false;
    }
    return TemplateMerger.hasTemplate(this._mergedTemplateDir, templateName);
  }

  /**
   * Get the Liquid engine for direct access
   */
  public get liquidEngine(): LiquidTemplateEngine {
    return this._liquidEngine;
  }

  /**
   * Get template data converter
   */
  public get templateDataConverter(): TemplateDataConverter {
    return this._templateDataConverter;
  }

  /**
   * Get the current merged template directory (for debugging)
   */
  public get mergedTemplateDir(): string | undefined {
    return this._mergedTemplateDir;
  }

  /**
   * Get template name for an API item
   */
  private _getTemplateName(apiItem: ApiItem): string {
    const kind = apiItem.kind;

    // Check if we have a specific template for this kind
    const API_ITEM_TEMPLATE_MAP: Partial<Record<ApiItemKind, string>> = {
      'Class': 'class',
      'Interface': 'interface',
      'Function': 'function',
      'Method': 'method',
      'Constructor': 'constructor',
      'Property': 'property',
      'Enum': 'enum',
      'EnumMember': 'enum-member',
      'TypeAlias': 'type-alias',
      'Variable': 'variable',
      'Namespace': 'namespace',
      'Package': 'package',
      'EntryPoint': 'entry-point',
      'Model': 'model'
    };

    if (API_ITEM_TEMPLATE_MAP[kind]) {
      return API_ITEM_TEMPLATE_MAP[kind]!;
    }

    // Fallback to generic template
    return 'generic';
  }

  /**
   * Load override template content from file
   */
  private async _loadOverrideTemplate(templateName: string): Promise<string> {
    const overridePath = this._overrides[templateName];
    if (!overridePath || typeof overridePath !== 'string') {
      throw new Error(`No override path configured for template '${templateName}'`);
    }

    if (!FileSystem.exists(overridePath)) {
      throw new DocumentationError(
        `Template override file not found: ${overridePath}`,
        ErrorCode.TEMPLATE_NOT_FOUND
      );
    }

    try {
      return FileSystem.readFileToBuffer(overridePath).toString();
    } catch (error) {
      throw new DocumentationError(
        `Failed to read template override file: ${overridePath}`,
        ErrorCode.TEMPLATE_ERROR,
        { cause: error instanceof Error ? error : new Error(String(error)) }
      );
    }
  }

  /**
   * Get template mapping for debugging/information purposes
   */
  public getTemplateMapping(): Partial<Record<ApiItemKind, string>> {
    return {
      'Class': 'class',
      'Interface': 'interface',
      'Function': 'function',
      'Method': 'method',
      'Constructor': 'constructor',
      'Property': 'property',
      'Enum': 'enum',
      'EnumMember': 'enum-member',
      'TypeAlias': 'type-alias',
      'Variable': 'variable',
      'Namespace': 'namespace',
      'Package': 'package',
      'EntryPoint': 'entry-point',
      'Model': 'model'
    };
  }

  /**
   * Clear all template caches
   */
  public clearCache(): void {
    this._liquidEngine.clearCache();
  }

  /**
   * Get template usage statistics
   */
  public getTemplateStats(): {
    overrides: Record<string, string>;
    availableTemplates: string[];
    mergedTemplateDir?: string;
    userTemplateDir?: string;
    defaultTemplateDir: string;
  } {
    return {
      overrides: this._overrides,
      availableTemplates: this.getAvailableTemplates(),
      mergedTemplateDir: this._mergedTemplateDir,
      userTemplateDir: this._userTemplateDir,
      defaultTemplateDir: this._defaultTemplateDir
    };
  }
}