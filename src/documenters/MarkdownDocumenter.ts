import * as path from 'path';
import { PackageName, FileSystem, NewlineKind } from '@rushstack/node-core-library';
import * as clack from '@clack/prompts';

import { SecurityUtils } from '../utils/SecurityUtils';
import { DocumentationError, ErrorCode, FileSystemError, ValidationError } from '../errors/DocumentationError';
import { ErrorBoundary } from '../errors/ErrorBoundary';
import { createDebugger, type Debugger } from '../utils/debug';
import { NavigationManager, NavigationItem } from '../navigation/NavigationManager';
import { CacheManager, getGlobalCacheManager } from '../cache/CacheManager';
import {
  DocSection,
  DocPlainText,
  DocLinkTag,
  type TSDocConfiguration,
  StringBuilder,
  DocNodeKind,
  DocParagraph,
  DocCodeSpan,
  DocFencedCode,
  StandardTags,
  type DocBlock,
  type DocComment,
  type DocNodeContainer
} from '@microsoft/tsdoc';
import {
  type ApiModel,
  type ApiItem,
  type ApiEnum,
  type ApiPackage,
  ApiItemKind,
  ApiReleaseTagMixin,
  ApiDocumentedItem,
  ApiClass,
  ReleaseTag,
  ApiStaticMixin,
  ApiPropertyItem,
  ApiInterface,
  type Excerpt,
  ApiAbstractMixin,
  ApiParameterListMixin,
  ApiReturnTypeMixin,
  ApiDeclaredItem,
  type ApiNamespace,
  ExcerptTokenKind,
  type IResolveDeclarationReferenceResult,
  ApiTypeAlias,
  type ExcerptToken,
  ApiOptionalMixin,
  ApiInitializerMixin,
  ApiProtectedMixin,
  ApiReadonlyMixin,
  type IFindApiItemsResult
} from '@microsoft/api-extractor-model';

import { CustomDocNodes } from '../nodes/CustomDocNodeKind';
import { DocHeading } from '../nodes/DocHeading';
import { DocTable } from '../nodes/DocTable';
import { DocEmphasisSpan } from '../nodes/DocEmphasisSpan';
import { DocTableRow } from '../nodes/DocTableRow';
import { DocTableCell } from '../nodes/DocTableCell';
import { DocNoteBox } from '../nodes/DocNoteBox';
import { Utilities } from '../utils/Utilities';
import { CustomMarkdownEmitter } from '../markdown/CustomMarkdownEmitter';
import { LiquidTemplateManager, TemplateDataConverter } from '../templates';
import { TypeInfoGenerator } from '../utils/TypeInfoGenerator';
import { LinkValidator } from '../utils/LinkValidator';

const debug: Debugger = createDebugger('markdown-documenter');

/**
 * Configuration options for MarkdownDocumenter
 * @public
 */
export interface IMarkdownDocumenterOptions {
  apiModel: ApiModel;
  outputFolder: string;
  docsJsonPath?: string;
  tabName?: string;
  groupName?: string;
  enableMenu?: boolean;
  convertReadme?: boolean;
  readmeTitle?: string;
  verbose?: boolean;

  /**
   * Template configuration for customizing output
   */
  templates?: {
    /**
     * Directory containing user templates (Liquid files)
     */
    userTemplateDir?: string;

    /**
     * Individual template overrides - map template names to file paths
     * Example: `{ class: './my-templates/custom-class.liquid' \}`
     */
    overrides?: Record<string, string>;

    /**
     * Whether to enable template caching (default: true)
     */
    cache?: boolean;

    /**
     * Whether to use strict mode for templates (default: true)
     */
    strict?: boolean;

    /**
     * Configuration for controlling how API items are rendered
     */
    rendering?: {
      /**
       * Whether to hide the value column in string enum member tables (default: true)
       */
      hideStringEnumValues?: boolean;
    };
  };
}


/**
 * Core class for rendering API documentation in Mintlify-compatible MDX format.
 *
 * This class takes TypeScript API model data and converts it into MDX files with proper
 * Mintlify frontmatter, navigation integration, and formatting suitable for documentation sites.
 * The process involves multiple stages including {@link TemplateDataConverter | data conversion}
 * and {@link LiquidTemplateManager | template rendering}.
 *
 * @remarks
 * The main workflow involves:
 * 1. Loading the API model from `.api.json` files
 * 2. Converting API items to template data using {@link TemplateDataConverter}
 * 3. Rendering templates via {@link LiquidTemplateManager}
 * 4. Updating the Mintlify navigation structure
 *
 * For detailed architecture information, see the {@link /architecture/generation-layer | Generation Layer}
 * documentation and the {@link /architecture/overview | Architecture Overview}.
 *
 * @see /architecture/generation-layer - Generation workflow details
 * @see /architecture/overview - System architecture overview
 *
 * @public
 */
export class MarkdownDocumenter {
  private readonly _apiModel: ApiModel;
  private readonly _tsdocConfiguration: TSDocConfiguration;
  private readonly _markdownEmitter: CustomMarkdownEmitter;
  private readonly _outputFolder: string;
  private readonly _docsJsonPath?: string;
  private readonly _navigationManager: NavigationManager;
  private readonly _templateManager: LiquidTemplateManager;
  private readonly _templateDataConverter: TemplateDataConverter;
  private _convertReadme: boolean = false;
  private _readmeTitle: string = 'README';
  private readonly _verbose: boolean = false;
  private readonly _renderingConfig: {
    hideStringEnumValues: boolean;
  };

  /**
   * Icon mapping for different API item types
   */
  private static readonly API_ITEM_ICONS: Partial<Record<ApiItemKind, string>> = {
    [ApiItemKind.Class]: 'box',
    [ApiItemKind.Interface]: 'plug',
    [ApiItemKind.Function]: 'function',
    [ApiItemKind.Method]: 'function',
    [ApiItemKind.Constructor]: 'function',
    [ApiItemKind.Property]: 'variable',
    [ApiItemKind.Enum]: 'list',
    [ApiItemKind.TypeAlias]: 'file-code',
    [ApiItemKind.Variable]: 'variable',
    [ApiItemKind.Namespace]: 'folder',
    [ApiItemKind.Package]: 'package',
    [ApiItemKind.Model]: 'book'
  };

  // Security and resource limits
  private static readonly MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB per file
  private static readonly MAX_TOTAL_OUTPUT_SIZE_BYTES = 500 * 1024 * 1024; // 500MB total
  private static readonly MAX_RECURSION_DEPTH = 25; // Prevent stack overflow
  private static readonly MAX_PROCESSING_TIME_MS = 10 * 60 * 1000; // 10 minutes
  private static readonly MAX_FILENAME_LENGTH = 200; // Reasonable filename limit

  // Track processing state for resource management
  private _currentRecursionDepth = 0;
  private _startTime = Date.now();
  private _totalOutputSize = 0;

  public constructor(options: IMarkdownDocumenterOptions) {
    this._apiModel = options.apiModel;
    this._outputFolder = options.outputFolder;
    this._docsJsonPath = options.docsJsonPath;
    this._convertReadme = options.convertReadme || false;
    this._readmeTitle = options.readmeTitle || 'README';
    this._verbose = options.verbose || false;
    this._tsdocConfiguration = CustomDocNodes.configuration;

    // Initialize resource tracking
    this._startTime = Date.now();
    this._totalOutputSize = 0;
    this._currentRecursionDepth = 0;

    // Initialize rendering config with defaults
    this._renderingConfig = {
      hideStringEnumValues: options.templates?.rendering?.hideStringEnumValues ?? true
    };

    // Initialize link validator for type references
    const linkValidator = new LinkValidator(
      this._apiModel,
      (apiItem) => this._getFilenameForApiItem(apiItem)
    );

    // Initialize template system
    this._templateDataConverter = new TemplateDataConverter(this._apiModel, linkValidator);
    this._templateManager = new LiquidTemplateManager({
      userTemplateDir: options.templates?.userTemplateDir,
      overrides: options.templates?.overrides,
      cache: options.templates?.cache !== false,
      strict: options.templates?.strict !== false,
      apiModel: this._apiModel,
      linkValidator
    });

    // Initialize cache manager for performance
    const cacheManager = getGlobalCacheManager({
      enabled: true,
      enableStats: true,
      typeAnalysis: { maxSize: 1000, enabled: true },
      apiResolution: { maxSize: 500, enabled: true }
    });

    // Create markdown emitter with caching
    this._markdownEmitter = new CustomMarkdownEmitter(this._apiModel);

    // Initialize navigation manager
    this._navigationManager = new NavigationManager({
      docsJsonPath: options.docsJsonPath,
      tabName: options.tabName,
      groupName: options.groupName,
      enableMenu: options.enableMenu,
      outputFolder: this._outputFolder
    });
  }

  public async generateFiles(): Promise<void> {
    const cacheManager = getGlobalCacheManager();

    // Initialize template system
    await this._templateManager.initialize();

    try {
      this._deleteOldOutputFiles();

      // Copy Mintlify components to snippets folder
      this._copyMintlifyComponents();

      // Generate TypeInfo.jsx with type information
      this._generateTypeInfo();

      // Generate ValidRefs.jsx for link validation
      this._generateValidRefs();

      // Generate ValidPages.jsx for page link validation
      this._generateValidPages();

      // Use the new template-based approach
      await this._writeApiItemPageTemplate(this._apiModel);

      // Convert README.md to index.mdx if requested
      if (this._convertReadme) {
        this._convertReadmeToIndex();
      }

      // Generate navigation after all pages are written
      const navigationConfig = this._navigationManager.getStats();
      if (navigationConfig.totalItems > 0) {
        this.generateNavigation();
      }

      // Print cache statistics
      cacheManager.printStats();
    } finally {
      // Cleanup template resources
      await this._templateManager.cleanup();
    }
  }

  /**
   * Write API item page (handles both template and legacy approaches)
   */
  private _writeApiItemPage(apiItem: ApiItem): void {
    // For now, use the legacy approach until we complete the template migration
    // This prevents breaking existing functionality
    this._writeApiItemPageLegacy(apiItem);
  }

  /**
   * Generate documentation page using templates (new approach)
   */
  private async _writeApiItemPageTemplate(apiItem: ApiItem, parentApiItem?: ApiItem): Promise<void> {
    // Check recursion depth to prevent stack overflow
    if (this._currentRecursionDepth > MarkdownDocumenter.MAX_RECURSION_DEPTH) {
      throw new ValidationError(
        `Maximum recursion depth exceeded (${MarkdownDocumenter.MAX_RECURSION_DEPTH})`,
        { resource: 'apiItem', operation: 'writeApiItemPageTemplate', data: { displayName: apiItem.displayName } }
      );
    }

    // Skip generating pages for EntryPoints - they're just containers
    // Process their members directly instead
    if (apiItem.kind === ApiItemKind.EntryPoint) {
      if ('members' in apiItem) {
        this._currentRecursionDepth++;
        try {
          for (const member of (apiItem as any).members) {
            await this._writeApiItemPageTemplate(member);
          }
        } finally {
          this._currentRecursionDepth--;
        }
      }
      return;
    }

    const icon = this._getIconForApiItem(apiItem);
    const description = this._getDescription(apiItem) || `${apiItem.displayName} API documentation`;

    // Build breadcrumb
    const breadcrumb = this._buildBreadcrumb(apiItem);

    // Build navigation info for top-level items
    const navigation = this._buildNavigationInfo(apiItem);

    // Convert API item to template data
    const templateData = this._templateDataConverter.convertApiItem(apiItem, {
      pageTitle: this._getPageTitle(apiItem),
      pageDescription: description,
      pageIcon: icon,
      breadcrumb: breadcrumb,
      navigation: navigation,
      getLinkFilenameForApiItem: (item: ApiItem) => this._getLinkFilenameForApiItem(item)
    });

    // Add rendering config to template data
    templateData.rendering = this._renderingConfig;

    // Render template
    const renderedContent = await this._templateManager.renderApiItem(apiItem, templateData);

    // Generate filename
    const safeFilename = this._getFilenameForApiItem(apiItem);
    const filename = path.join(this._outputFolder, safeFilename);

    // Validate and write file
    try {
      SecurityUtils.validateFilePath(this._outputFolder, filename);

      // Check total output size limit
      const contentLength = Buffer.byteLength(renderedContent, 'utf8');
      if (this._totalOutputSize + contentLength > MarkdownDocumenter.MAX_TOTAL_OUTPUT_SIZE_BYTES) {
        throw new ValidationError(
          `Total output size would exceed maximum of ${MarkdownDocumenter.MAX_TOTAL_OUTPUT_SIZE_BYTES / (1024 * 1024)}MB`,
          { resource: filename, operation: 'validateTotalSize', data: {
            currentSize: this._totalOutputSize,
            newSize: contentLength,
            maxSize: MarkdownDocumenter.MAX_TOTAL_OUTPUT_SIZE_BYTES
          }}
        );
      }

      // Check individual file size limit
      if (contentLength > MarkdownDocumenter.MAX_FILE_SIZE_BYTES) {
        throw new ValidationError(
          `Generated content exceeds maximum file size of ${MarkdownDocumenter.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB for ${filename}`,
          { resource: filename, operation: 'validateFileContent', data: { size: contentLength } }
        );
      }

      // Ensure parent directory exists for nested folder structure
      const directory = path.dirname(filename);
      FileSystem.ensureFolder(directory);

      FileSystem.writeFile(filename, renderedContent, {
        convertLineEndings: NewlineKind.CrLf
      });

      // Update total output size tracking
      this._totalOutputSize += contentLength;
    } catch (error) {
      if (error instanceof DocumentationError) {
        throw error;
      }
      throw new FileSystemError(
        `Failed to write documentation file: ${filename}`,
        ErrorCode.FILE_WRITE_ERROR,
        {
          resource: filename,
          operation: 'writeFile',
          cause: error instanceof Error ? error : new Error(String(error))
        }
      );
    }

    // Add to navigation (all items, with parent tracking for members)
    const navigationConfig = this._navigationManager.getStats();
    if (navigationConfig.tabName) {
      const parentFilename = parentApiItem ? this._getFilenameForApiItem(parentApiItem) : undefined;
      this._addToNavigation(apiItem, filename, parentFilename);
    }

    // Process child items recursively, passing current item as parent
    // Skip enum members - they are rendered within the parent enum file
    if ('members' in apiItem && apiItem.kind !== ApiItemKind.Enum) {
      this._currentRecursionDepth++;
      try {
        for (const member of (apiItem as any).members) {
          await this._writeApiItemPageTemplate(member, apiItem);
        }
      } finally {
        this._currentRecursionDepth--;
      }
    }
  }

  /**
   * Get icon for API item
   */
  private _getIconForApiItem(apiItem: ApiItem): string {
    return MarkdownDocumenter.API_ITEM_ICONS[apiItem.kind] || 'file';
  }

  /**
   * Get group for API item in navigation
   */
  private _getGroupForApiItem(apiItem: ApiItem): string | undefined {
    // Group by item kind for better organization
    switch (apiItem.kind) {
      case ApiItemKind.Class:
        return 'Classes';
      case ApiItemKind.Interface:
        return 'Interfaces';
      case ApiItemKind.Function:
      case ApiItemKind.Method:
      case ApiItemKind.Constructor:
        return 'Functions & Methods';
      case ApiItemKind.Property:
        return 'Properties';
      case ApiItemKind.Enum:
        return 'Enumerations';
      case ApiItemKind.TypeAlias:
        return 'Type Aliases';
      case ApiItemKind.Variable:
        return 'Variables';
      case ApiItemKind.Namespace:
        return 'Namespaces';
      case ApiItemKind.Package:
        return 'Packages';
      default:
        return undefined;
    }
  }

  /**
   * Get hierarchy of API items from root to current item
   */
  private _getHierarchy(apiItem: ApiItem): ApiItem[] {
    const hierarchy: ApiItem[] = [];
    let current: ApiItem | undefined = apiItem;

    while (current) {
      hierarchy.unshift(current);
      current = current.parent;
    }

    return hierarchy;
  }

  /**
   * Get scoped name within package (e.g., "Namespace.Class.method")
   */
  private _getScopedNameWithinPackage(apiItem: ApiItem): string {
    const parts: string[] = [];
    let current: ApiItem | undefined = apiItem;

    while (current && current.kind !== ApiItemKind.Package && current.kind !== ApiItemKind.Model) {
      if (current.kind !== ApiItemKind.EntryPoint && current.displayName) {
        parts.unshift(Utilities.normalizeDisplayName(current.displayName));
      }
      current = current.parent;
    }

    return parts.join('.') || Utilities.normalizeDisplayName(apiItem.displayName) || 'unknown';
  }

  /**
   * Build breadcrumb navigation data for template
   */
  private _buildBreadcrumb(apiItem: ApiItem): Array<{ name: string; path?: string }> {
    const breadcrumb: Array<{ name: string; path?: string }> = [];
    const ancestors = this._getHierarchy(apiItem);

    for (const ancestor of ancestors) {
      if (ancestor === this._apiModel) {
        breadcrumb.push({ name: 'API Reference', path: undefined });
      } else {
        // Skip items with empty display names
        if (!ancestor.displayName || ancestor.displayName.trim().length === 0) {
          continue;
        }

        const filename = this._getLinkFilenameForApiItem(ancestor);
        breadcrumb.push({
          name: ancestor.displayName,
          path: filename
        });
      }
    }

    return breadcrumb;
  }

  /**
   * Build navigation info for top-level items
   */
  private _buildNavigationInfo(apiItem: ApiItem): { id: string; title: string; group?: string } | undefined {
    // Only add navigation for top-level items (packages, main namespaces)
    if (apiItem.parent === this._apiModel ||
        (apiItem.parent?.kind === ApiItemKind.Package && apiItem.parent.parent === this._apiModel)) {
      // Skip items with empty display names
      if (!apiItem.displayName || apiItem.displayName.trim().length === 0) {
        return undefined;
      }

      return {
        id: this._getFilenameForApiItem(apiItem),
        title: apiItem.displayName,
        group: this._getGroupForApiItem(apiItem)
      };
    }
    return undefined;
  }

  /**
   * Get page title for API item
   */
  private _getPageTitle(apiItem: ApiItem): string {
    // Check if this is a member of a class or interface
    const isMemberItem = apiItem.parent && [
      ApiItemKind.Class,
      ApiItemKind.Interface
    ].includes(apiItem.parent.kind);

    // For member items (methods, properties, constructors), use just the display name (normalized)
    if (isMemberItem) {
      const displayName = Utilities.normalizeDisplayName(apiItem.displayName);

      switch (apiItem.kind) {
        case ApiItemKind.Method:
        case ApiItemKind.MethodSignature:
          return displayName;
        case ApiItemKind.Constructor:
        case ApiItemKind.ConstructSignature:
          return displayName;
        case ApiItemKind.Property:
        case ApiItemKind.PropertySignature:
          return displayName;
        default:
          return displayName;
      }
    }

    // For top-level items, use the scoped name
    const scopedName = this._getScopedNameWithinPackage(apiItem);

    switch (apiItem.kind) {
      case ApiItemKind.Class:
        return `${scopedName} class`;
      case ApiItemKind.Interface:
        return `${scopedName} interface`;
      case ApiItemKind.Function:
        return `${scopedName} function`;
      case ApiItemKind.Method:
      case ApiItemKind.MethodSignature:
        return `${scopedName} method`;
      case ApiItemKind.Constructor:
      case ApiItemKind.ConstructSignature:
        return scopedName;
      case ApiItemKind.Property:
      case ApiItemKind.PropertySignature:
        return `${scopedName} property`;
      case ApiItemKind.Enum:
        return `${scopedName} enum`;
      case ApiItemKind.TypeAlias:
        return `${scopedName} type`;
      case ApiItemKind.Variable:
        return `${scopedName} variable`;
      case ApiItemKind.Namespace:
        return `${scopedName} namespace`;
      case ApiItemKind.Package:
        const unscopedPackageName: string = PackageName.getUnscopedName(apiItem.displayName);
        return `${unscopedPackageName} package`;
      case ApiItemKind.Model:
        return 'API Reference';
      default:
        return scopedName;
    }
  }


  /**
   * Get text content from DocSection
   */
  private _getTextFromDocSection(docSection: DocSection): string {
    const stringBuilder = new StringBuilder();
    this._markdownEmitter.emit(stringBuilder, docSection, {
      contextApiItem: undefined,
      onGetFilenameForApiItem: () => undefined
    });
    return stringBuilder.toString().trim();
  }

  /**
   * DEPRECATED: Generate documentation page using DocNode building (old approach)
   * This method will be removed once template system is fully implemented
   */
  private _writeApiItemPageLegacy(apiItem: ApiItem): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;
    const output: DocSection = new DocSection({ configuration });

    this._writeBreadcrumb(output, apiItem);

    const scopedName: string = this._getScopedNameWithinPackage(apiItem);

    switch (apiItem.kind) {
      case ApiItemKind.Class:
        output.appendNode(new DocHeading({ configuration, title: `${scopedName} class` }));
        break;
      case ApiItemKind.Enum:
        output.appendNode(new DocHeading({ configuration, title: `${scopedName} enum` }));
        break;
      case ApiItemKind.Interface:
        output.appendNode(new DocHeading({ configuration, title: `${scopedName} interface` }));
        break;
      case ApiItemKind.Constructor:
      case ApiItemKind.ConstructSignature:
        output.appendNode(new DocHeading({ configuration, title: scopedName }));
        break;
      case ApiItemKind.Method:
      case ApiItemKind.MethodSignature:
        output.appendNode(new DocHeading({ configuration, title: `${scopedName} method` }));
        break;
      case ApiItemKind.Function:
        output.appendNode(new DocHeading({ configuration, title: `${scopedName} function` }));
        break;
      case ApiItemKind.Model:
        output.appendNode(new DocHeading({ configuration, title: `API Reference` }));
        break;
      case ApiItemKind.Namespace:
        output.appendNode(new DocHeading({ configuration, title: `${scopedName} namespace` }));
        break;
      case ApiItemKind.Package:
        debug.info(`Writing ${apiItem.displayName} package`);
        const unscopedPackageName: string = PackageName.getUnscopedName(apiItem.displayName);
        output.appendNode(new DocHeading({ configuration, title: `${unscopedPackageName} package` }));
        break;
      case ApiItemKind.Property:
      case ApiItemKind.PropertySignature:
        output.appendNode(new DocHeading({ configuration, title: `${scopedName} property` }));
        break;
      case ApiItemKind.TypeAlias:
        output.appendNode(new DocHeading({ configuration, title: `${scopedName} type` }));
        break;
      case ApiItemKind.Variable:
        output.appendNode(new DocHeading({ configuration, title: `${scopedName} variable` }));
        break;
      default:
        throw new Error('Unsupported API item kind: ' + apiItem.kind);
    }

    if (ApiReleaseTagMixin.isBaseClassOf(apiItem)) {
      if (apiItem.releaseTag === ReleaseTag.Alpha) {
        this._writeAlphaWarning(output);
      } else if (apiItem.releaseTag === ReleaseTag.Beta) {
        this._writeBetaWarning(output);
      }
    }

    const decoratorBlocks: DocBlock[] = [];

    if (apiItem instanceof ApiDocumentedItem) {
      const tsdocComment: DocComment | undefined = apiItem.tsdocComment;

      if (tsdocComment) {
        decoratorBlocks.push(
          ...tsdocComment.customBlocks.filter(
            (block) => block.blockTag.tagNameWithUpperCase === StandardTags.decorator.tagNameWithUpperCase
          )
        );

        if (tsdocComment.deprecatedBlock) {
          output.appendNode(
            new DocNoteBox({ configuration }, [
              new DocParagraph({ configuration }, [
                new DocPlainText({
                  configuration,
                  text: 'Warning: This API is now obsolete. '
                })
              ]),
              ...tsdocComment.deprecatedBlock.content.nodes
            ])
          );
        }

        this._appendSection(output, tsdocComment.summarySection);
      }
    }

    if (apiItem instanceof ApiDeclaredItem) {
      if (apiItem.excerpt.text.length > 0) {
        output.appendNode(
          new DocParagraph({ configuration }, [
            new DocEmphasisSpan({ configuration, bold: true }, [
              new DocPlainText({ configuration, text: 'Signature:' })
            ])
          ])
        );
        output.appendNode(
          new DocFencedCode({
            configuration,
            code: apiItem.getExcerptWithModifiers(),
            language: 'typescript'
          })
        );
      }

      this._writeHeritageTypes(output, apiItem);
    }

    if (decoratorBlocks.length > 0) {
      output.appendNode(
        new DocParagraph({ configuration }, [
          new DocEmphasisSpan({ configuration, bold: true }, [
            new DocPlainText({ configuration, text: 'Decorators:' })
          ])
        ])
      );
      for (const decoratorBlock of decoratorBlocks) {
        output.appendNodes(decoratorBlock.content.nodes);
      }
    }

    let appendRemarks: boolean = true;
    switch (apiItem.kind) {
      case ApiItemKind.Class:
      case ApiItemKind.Interface:
      case ApiItemKind.Namespace:
      case ApiItemKind.Package:
        this._writeRemarksSection(output, apiItem);
        appendRemarks = false;
        break;
    }

    switch (apiItem.kind) {
      case ApiItemKind.Class:
        this._writeClassTables(output, apiItem as ApiClass);
        break;
      case ApiItemKind.Enum:
        this._writeEnumTables(output, apiItem as ApiEnum);
        break;
      case ApiItemKind.Interface:
        this._writeInterfaceTables(output, apiItem as ApiInterface);
        break;
      case ApiItemKind.Constructor:
      case ApiItemKind.ConstructSignature:
      case ApiItemKind.Method:
      case ApiItemKind.MethodSignature:
      case ApiItemKind.Function:
        this._writeParameterTables(output, apiItem as ApiParameterListMixin);
        this._writeThrowsSection(output, apiItem);
        break;
      case ApiItemKind.Namespace:
        this._writePackageOrNamespaceTables(output, apiItem as ApiNamespace);
        break;
      case ApiItemKind.Model:
        this._writeModelTable(output, apiItem as ApiModel);
        break;
      case ApiItemKind.Package:
        this._writePackageOrNamespaceTables(output, apiItem as ApiPackage);
        break;
      case ApiItemKind.Property:
      case ApiItemKind.PropertySignature:
        break;
      case ApiItemKind.TypeAlias:
        break;
      case ApiItemKind.Variable:
        break;
      default:
        throw new Error('Unsupported API item kind: ' + apiItem.kind);
    }

    if (appendRemarks) {
      this._writeRemarksSection(output, apiItem);
    }

    // Validate the output folder path and generate safe filename
    const safeFilename = this._getFilenameForApiItem(apiItem);

    // Ensure the filename is safe and doesn't contain path traversal
    let filename: string;
    try {
      // Validate that the generated filename is safe
      const validatedFilename = SecurityUtils.validateFilename(safeFilename);

      // Validate the full path stays within the output folder
      filename = path.join(this._outputFolder, validatedFilename);
      const validatedPath = SecurityUtils.validateFilePath(this._outputFolder, filename);

      // Use the validated path for the actual filename
      filename = validatedPath;
    } catch (error) {
      throw new ValidationError(
        `Invalid filename generated for API item: ${apiItem.displayName}`,
        {
          resource: apiItem.displayName,
          operation: 'generateFilename',
          cause: error instanceof Error ? error : new Error(String(error)),
          suggestion: 'Check if the API item name contains special characters'
        }
      );
    }
    const stringBuilder: StringBuilder = new StringBuilder();

    // Add Mintlify frontmatter
    stringBuilder.append(this._generateFrontmatter(apiItem));
    stringBuilder.append('\n');
    
    stringBuilder.append(
      '{/* Do not edit this file. It is automatically generated by API Documenter. */}\n\n'
    );

    this._markdownEmitter.emit(stringBuilder, output, {
      contextApiItem: apiItem,
      onGetFilenameForApiItem: (apiItemForFilename: ApiItem) => {
        return this._getLinkFilenameForApiItem(apiItemForFilename);
      }
    });

    let pageContent: string = stringBuilder.toString();

    // Validate file path and content before writing
    try {
      // Validate that the filename is within the allowed output directory
      const validatedFilename = SecurityUtils.validateFilePath(this._outputFolder, filename);

      // Validate file content size (prevent DoS with huge files)
      const maxFileSize = 50 * 1024 * 1024; // 50MB limit
      if (pageContent.length > maxFileSize) {
        throw new ValidationError(
          `Generated content exceeds maximum file size of 50MB for ${filename}`,
          { resource: filename, operation: 'validateFileContent', data: { size: pageContent.length } }
        );
      }

      // Ensure parent directory exists for nested folder structure
      const directory = path.dirname(validatedFilename);
      FileSystem.ensureFolder(directory);

      // Write file with error handling
      FileSystem.writeFile(validatedFilename, pageContent, {
        convertLineEndings: NewlineKind.CrLf
      });
    } catch (error) {
      if (error instanceof DocumentationError) {
        throw error;
      }
      throw new FileSystemError(
        `Failed to write documentation file: ${filename}`,
        ErrorCode.FILE_WRITE_ERROR,
        {
          resource: filename,
          operation: 'writeDocumentationFile',
          cause: error instanceof Error ? error : new Error(String(error)),
          suggestion: 'Check file permissions and available disk space'
        }
      );
    }

    // Add to navigation if this is a top-level item and navigation is configured
    const navigationConfig = this._navigationManager.getStats();
    if (navigationConfig.tabName && this._isTopLevelItem(apiItem)) {
      this._addToNavigation(apiItem, filename);
    }
  }

  private _writeHeritageTypes(output: DocSection, apiItem: ApiDeclaredItem): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    if (apiItem instanceof ApiClass) {
      if (apiItem.extendsType) {
        const extendsParagraph: DocParagraph = new DocParagraph({ configuration }, [
          new DocEmphasisSpan({ configuration, bold: true }, [
            new DocPlainText({ configuration, text: 'Extends: ' })
          ])
        ]);
        this._appendExcerptWithHyperlinks(extendsParagraph, apiItem.extendsType.excerpt);
        output.appendNode(extendsParagraph);
      }
      if (apiItem.implementsTypes.length > 0) {
        const implementsParagraph: DocParagraph = new DocParagraph({ configuration }, [
          new DocEmphasisSpan({ configuration, bold: true }, [
            new DocPlainText({ configuration, text: 'Implements: ' })
          ])
        ]);
        let needsComma: boolean = false;
        for (const implementsType of apiItem.implementsTypes) {
          if (needsComma) {
            implementsParagraph.appendNode(new DocPlainText({ configuration, text: ', ' }));
          }
          this._appendExcerptWithHyperlinks(implementsParagraph, implementsType.excerpt);
          needsComma = true;
        }
        output.appendNode(implementsParagraph);
      }
    }

    if (apiItem instanceof ApiInterface) {
      if (apiItem.extendsTypes.length > 0) {
        const extendsParagraph: DocParagraph = new DocParagraph({ configuration }, [
          new DocEmphasisSpan({ configuration, bold: true }, [
            new DocPlainText({ configuration, text: 'Extends: ' })
          ])
        ]);
        let needsComma: boolean = false;
        for (const extendsType of apiItem.extendsTypes) {
          if (needsComma) {
            extendsParagraph.appendNode(new DocPlainText({ configuration, text: ', ' }));
          }
          this._appendExcerptWithHyperlinks(extendsParagraph, extendsType.excerpt);
          needsComma = true;
        }
        output.appendNode(extendsParagraph);
      }
    }

    if (apiItem instanceof ApiTypeAlias) {
      const refs: ExcerptToken[] = apiItem.excerptTokens.filter(
        (token) =>
          token.kind === ExcerptTokenKind.Reference &&
          token.canonicalReference &&
          this._apiModel.resolveDeclarationReference(token.canonicalReference, undefined).resolvedApiItem
      );
      if (refs.length > 0) {
        const referencesParagraph: DocParagraph = new DocParagraph({ configuration }, [
          new DocEmphasisSpan({ configuration, bold: true }, [
            new DocPlainText({ configuration, text: 'References: ' })
          ])
        ]);
        let needsComma: boolean = false;
        const visited: Set<string> = new Set();
        for (const ref of refs) {
          if (visited.has(ref.text)) {
            continue;
          }
          visited.add(ref.text);

          if (needsComma) {
            referencesParagraph.appendNode(new DocPlainText({ configuration, text: ', ' }));
          }

          this._appendExcerptTokenWithHyperlinks(referencesParagraph, ref);
          needsComma = true;
        }
        output.appendNode(referencesParagraph);
      }
    }
  }

  private _writeRemarksSection(output: DocSection, apiItem: ApiItem): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    if (apiItem instanceof ApiDocumentedItem) {
      const tsdocComment: DocComment | undefined = apiItem.tsdocComment;

      if (tsdocComment) {
        // Write the @remarks block
        if (tsdocComment.remarksBlock) {
          output.appendNode(new DocHeading({ configuration, title: 'Remarks' }));
          this._appendSection(output, tsdocComment.remarksBlock.content);
        }

        // Write the @example blocks
        const exampleBlocks: DocBlock[] = tsdocComment.customBlocks.filter(
          (x) => x.blockTag.tagNameWithUpperCase === StandardTags.example.tagNameWithUpperCase
        );

        let exampleNumber: number = 1;
        for (const exampleBlock of exampleBlocks) {
          const heading: string = exampleBlocks.length > 1 ? `Example ${exampleNumber}` : 'Example';

          output.appendNode(new DocHeading({ configuration, title: heading }));

          this._appendSection(output, exampleBlock.content);

          ++exampleNumber;
        }
      }
    }
  }

  private _writeThrowsSection(output: DocSection, apiItem: ApiItem): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    if (apiItem instanceof ApiDocumentedItem) {
      const tsdocComment: DocComment | undefined = apiItem.tsdocComment;

      if (tsdocComment) {
        // Write the @throws blocks
        const throwsBlocks: DocBlock[] = tsdocComment.customBlocks.filter(
          (x) => x.blockTag.tagNameWithUpperCase === StandardTags.throws.tagNameWithUpperCase
        );

        if (throwsBlocks.length > 0) {
          const heading: string = 'Exceptions';
          output.appendNode(new DocHeading({ configuration, title: heading }));

          for (const throwsBlock of throwsBlocks) {
            this._appendSection(output, throwsBlock.content);
          }
        }
      }
    }
  }

  /**
   * GENERATE PAGE: MODEL
   */
  private _writeModelTable(output: DocSection, apiModel: ApiModel): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    const packagesTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Package', 'Description']
    });

    for (const apiMember of apiModel.members) {
      const row: DocTableRow = new DocTableRow({ configuration }, [
        this._createTitleCell(apiMember),
        this._createDescriptionCell(apiMember)
      ]);

      switch (apiMember.kind) {
        case ApiItemKind.Package:
          packagesTable.addRow(row);
          // Generate individual page for package
          this._writeApiItemPage(apiMember);
          break;
      }
    }

    if (packagesTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Packages' }));
      output.appendNode(packagesTable);
    }
  }

  /**
   * GENERATE PAGE: PACKAGE or NAMESPACE
   */
  private _writePackageOrNamespaceTables(output: DocSection, apiContainer: ApiPackage | ApiNamespace): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    const abstractClassesTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Abstract Class', 'Description']
    });

    const classesTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Class', 'Description']
    });

    const enumerationsTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Enumeration', 'Description']
    });

    const functionsTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Function', 'Description']
    });

    const interfacesTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Interface', 'Description']
    });

    const namespacesTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Namespace', 'Description']
    });

    const variablesTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Variable', 'Description']
    });

    const typeAliasesTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Type Alias', 'Description']
    });

    const apiMembers: ReadonlyArray<ApiItem> =
      apiContainer.kind === ApiItemKind.Package
        ? (apiContainer as ApiPackage).entryPoints[0].members
        : (apiContainer as ApiNamespace).members;

    for (const apiMember of apiMembers) {
      const row: DocTableRow = new DocTableRow({ configuration }, [
        this._createTitleCell(apiMember),
        this._createDescriptionCell(apiMember)
      ]);

      switch (apiMember.kind) {
        case ApiItemKind.Class:
          if (ApiAbstractMixin.isBaseClassOf(apiMember) && apiMember.isAbstract) {
            abstractClassesTable.addRow(row);
          } else {
            classesTable.addRow(row);
          }
          // Generate individual page for class
          this._writeApiItemPage(apiMember);
          break;

        case ApiItemKind.Enum:
          enumerationsTable.addRow(row);
          // Generate individual page for enum
          this._writeApiItemPage(apiMember);
          break;

        case ApiItemKind.Interface:
          interfacesTable.addRow(row);
          // Generate individual page for interface
          this._writeApiItemPage(apiMember);
          break;

        case ApiItemKind.Namespace:
          namespacesTable.addRow(row);
          // Generate individual page for namespace
          this._writeApiItemPage(apiMember);
          break;

        case ApiItemKind.Function:
          functionsTable.addRow(row);
          // Generate individual page for function
          this._writeApiItemPage(apiMember);
          break;

        case ApiItemKind.TypeAlias:
          typeAliasesTable.addRow(row);
          // Generate individual page for type alias
          this._writeApiItemPage(apiMember);
          break;

        case ApiItemKind.Variable:
          variablesTable.addRow(row);
          // Generate individual page for variable
          this._writeApiItemPage(apiMember);
          break;
      }
    }

    if (classesTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Classes' }));
      output.appendNode(classesTable);
    }

    if (abstractClassesTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Abstract Classes' }));
      output.appendNode(abstractClassesTable);
    }

    if (enumerationsTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Enumerations' }));
      output.appendNode(enumerationsTable);
    }
    if (functionsTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Functions' }));
      output.appendNode(functionsTable);
    }

    if (interfacesTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Interfaces' }));
      output.appendNode(interfacesTable);
    }

    if (namespacesTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Namespaces' }));
      output.appendNode(namespacesTable);
    }

    if (variablesTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Variables' }));
      output.appendNode(variablesTable);
    }

    if (typeAliasesTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Type Aliases' }));
      output.appendNode(typeAliasesTable);
    }
  }

  /**
   * GENERATE PAGE: CLASS
   */
  private _writeClassTables(output: DocSection, apiClass: ApiClass): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    const eventsTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Property', 'Modifiers', 'Type', 'Description']
    });

    const constructorsTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Constructor', 'Modifiers', 'Description']
    });

    const propertiesTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Property', 'Modifiers', 'Type', 'Description']
    });

    const methodsTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Method', 'Modifiers', 'Description']
    });

    const apiMembers: readonly ApiItem[] = this._getMembersAndWriteIncompleteWarning(apiClass, output);
    for (const apiMember of apiMembers) {
      const isInherited: boolean = apiMember.parent !== apiClass;
      switch (apiMember.kind) {
        case ApiItemKind.Constructor: {
          constructorsTable.addRow(
            new DocTableRow({ configuration }, [
              this._createTitleCell(apiMember),
              this._createModifiersCell(apiMember),
              this._createDescriptionCell(apiMember, isInherited)
            ])
          );

          // Individual member pages removed - members are included in parent page
          break;
        }
        case ApiItemKind.Method: {
          methodsTable.addRow(
            new DocTableRow({ configuration }, [
              this._createTitleCell(apiMember),
              this._createModifiersCell(apiMember),
              this._createDescriptionCell(apiMember, isInherited)
            ])
          );

          // Individual member pages removed - members are included in parent page
          break;
        }
        case ApiItemKind.Property: {
          if ((apiMember as ApiPropertyItem).isEventProperty) {
            eventsTable.addRow(
              new DocTableRow({ configuration }, [
                this._createTitleCell(apiMember),
                this._createModifiersCell(apiMember),
                this._createPropertyTypeCell(apiMember),
                this._createDescriptionCell(apiMember, isInherited)
              ])
            );
          } else {
            propertiesTable.addRow(
              new DocTableRow({ configuration }, [
                this._createTitleCell(apiMember),
                this._createModifiersCell(apiMember),
                this._createPropertyTypeCell(apiMember),
                this._createDescriptionCell(apiMember, isInherited)
              ])
            );
          }

          // Individual member pages removed - members are included in parent page
          break;
        }
      }
    }

    if (eventsTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Events' }));
      output.appendNode(eventsTable);
    }

    if (constructorsTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Constructors' }));
      output.appendNode(constructorsTable);
    }

    if (propertiesTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Properties' }));
      output.appendNode(propertiesTable);
    }

    if (methodsTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Methods' }));
      output.appendNode(methodsTable);
    }
  }

  /**
   * GENERATE PAGE: ENUM
   */
  private _writeEnumTables(output: DocSection, apiEnum: ApiEnum): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    const enumMembersTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Member', 'Value', 'Description']
    });

    for (const apiEnumMember of apiEnum.members) {
      enumMembersTable.addRow(
        new DocTableRow({ configuration }, [
          new DocTableCell({ configuration }, [
            new DocParagraph({ configuration }, [
              new DocPlainText({ configuration, text: Utilities.getConciseSignature(apiEnumMember) })
            ])
          ]),
          this._createInitializerCell(apiEnumMember),
          this._createDescriptionCell(apiEnumMember)
        ])
      );
    }

    if (enumMembersTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Enumeration Members' }));
      output.appendNode(enumMembersTable);
    }
  }

  /**
   * GENERATE PAGE: INTERFACE
   */
  private _writeInterfaceTables(output: DocSection, apiInterface: ApiInterface): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    const eventsTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Property', 'Modifiers', 'Type', 'Description']
    });

    const propertiesTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Property', 'Modifiers', 'Type', 'Description']
    });

    const methodsTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Method', 'Description']
    });

    const apiMembers: readonly ApiItem[] = this._getMembersAndWriteIncompleteWarning(apiInterface, output);
    for (const apiMember of apiMembers) {
      const isInherited: boolean = apiMember.parent !== apiInterface;
      switch (apiMember.kind) {
        case ApiItemKind.ConstructSignature:
        case ApiItemKind.MethodSignature: {
          methodsTable.addRow(
            new DocTableRow({ configuration }, [
              this._createTitleCell(apiMember),
              this._createDescriptionCell(apiMember, isInherited)
            ])
          );

          // Individual member pages removed - members are included in parent page
          break;
        }
        case ApiItemKind.PropertySignature: {
          if ((apiMember as ApiPropertyItem).isEventProperty) {
            eventsTable.addRow(
              new DocTableRow({ configuration }, [
                this._createTitleCell(apiMember),
                this._createModifiersCell(apiMember),
                this._createPropertyTypeCell(apiMember),
                this._createDescriptionCell(apiMember, isInherited)
              ])
            );
          } else {
            propertiesTable.addRow(
              new DocTableRow({ configuration }, [
                this._createTitleCell(apiMember),
                this._createModifiersCell(apiMember),
                this._createPropertyTypeCell(apiMember),
                this._createDescriptionCell(apiMember, isInherited)
              ])
            );
          }

          // Individual member pages removed - members are included in parent page
          break;
        }
      }
    }

    if (eventsTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Events' }));
      output.appendNode(eventsTable);
    }

    if (propertiesTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Properties' }));
      output.appendNode(propertiesTable);
    }

    if (methodsTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Methods' }));
      output.appendNode(methodsTable);
    }
  }

  /**
   * GENERATE PAGE: FUNCTION-LIKE
   */
  private _writeParameterTables(output: DocSection, apiParameterListMixin: ApiParameterListMixin): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    const parametersTable: DocTable = new DocTable({
      configuration,
      headerTitles: ['Parameter', 'Type', 'Description']
    });
    for (const apiParameter of apiParameterListMixin.parameters) {
      const parameterDescription: DocSection = new DocSection({ configuration });

      if (apiParameter.isOptional) {
        parameterDescription.appendNodesInParagraph([
          new DocEmphasisSpan({ configuration, italic: true }, [
            new DocPlainText({ configuration, text: '(Optional)' })
          ]),
          new DocPlainText({ configuration, text: ' ' })
        ]);
      }

      if (apiParameter.tsdocParamBlock) {
        this._appendAndMergeSection(parameterDescription, apiParameter.tsdocParamBlock.content);
      }

      parametersTable.addRow(
        new DocTableRow({ configuration }, [
          new DocTableCell({ configuration }, [
            new DocParagraph({ configuration }, [
              new DocPlainText({ configuration, text: apiParameter.name })
            ])
          ]),
          new DocTableCell({ configuration }, [
            this._createParagraphForTypeExcerpt(apiParameter.parameterTypeExcerpt)
          ]),
          new DocTableCell({ configuration }, parameterDescription.nodes)
        ])
      );
    }

    if (parametersTable.rows.length > 0) {
      output.appendNode(new DocHeading({ configuration, title: 'Parameters' }));
      output.appendNode(parametersTable);
    }

    if (ApiReturnTypeMixin.isBaseClassOf(apiParameterListMixin)) {
      const returnTypeExcerpt: Excerpt = apiParameterListMixin.returnTypeExcerpt;
      output.appendNode(
        new DocParagraph({ configuration }, [
          new DocEmphasisSpan({ configuration, bold: true }, [
            new DocPlainText({ configuration, text: 'Returns:' })
          ])
        ])
      );

      output.appendNode(this._createParagraphForTypeExcerpt(returnTypeExcerpt));

      if (apiParameterListMixin instanceof ApiDocumentedItem) {
        if (apiParameterListMixin.tsdocComment && apiParameterListMixin.tsdocComment.returnsBlock) {
          this._appendSection(output, apiParameterListMixin.tsdocComment.returnsBlock.content);
        }
      }
    }
  }

  private _createParagraphForTypeExcerpt(excerpt: Excerpt): DocParagraph {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    const paragraph: DocParagraph = new DocParagraph({ configuration });

    if (!excerpt.text.trim()) {
      paragraph.appendNode(new DocPlainText({ configuration, text: '(not declared)' }));
    } else {
      // Check if the entire type signature is complex and should be treated as a code block
      const fullText = excerpt.text.trim();
      if (this._isComplexTypeSignature(fullText)) {
        // For very complex types, render as a single code span to avoid MDX parsing issues
        paragraph.appendNode(new DocCodeSpan({ configuration, code: fullText }));
      } else {
        this._appendExcerptWithHyperlinks(paragraph, excerpt);
      }
    }

    return paragraph;
  }

  private _appendExcerptWithHyperlinks(docNodeContainer: DocNodeContainer, excerpt: Excerpt): void {
    for (const token of excerpt.spannedTokens) {
      this._appendExcerptTokenWithHyperlinks(docNodeContainer, token);
    }
  }

  private _appendExcerptTokenWithHyperlinks(docNodeContainer: DocNodeContainer, token: ExcerptToken): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    // Markdown doesn't provide a standardized syntax for hyperlinks inside code spans, so we will render
    // the type expression as DocPlainText.  Instead of creating multiple DocParagraphs, we can simply
    // discard any newlines and let the renderer do normal word-wrapping.
    const unwrappedTokenText: string = token.text.replace(/[\r\n]+/g, ' ');

    // If it's hyperlinkable, then append a DocLinkTag
    if (token.kind === ExcerptTokenKind.Reference && token.canonicalReference) {
      const apiItemResult: IResolveDeclarationReferenceResult = this._apiModel.resolveDeclarationReference(
        token.canonicalReference,
        undefined
      );

      if (apiItemResult.resolvedApiItem) {
        docNodeContainer.appendNode(
          new DocLinkTag({
            configuration,
            tagName: '@link',
            linkText: unwrappedTokenText,
            urlDestination: this._getLinkFilenameForApiItem(apiItemResult.resolvedApiItem)
          })
        );
        return;
      }
    }

    // For complex type signatures that might cause MDX parsing issues, wrap them in a code span
    // This is particularly important for types with curly braces, complex generics, or function signatures
    if (this._isComplexTypeSignature(unwrappedTokenText)) {
      docNodeContainer.appendNode(new DocCodeSpan({ configuration, code: unwrappedTokenText }));
    } else {
      // Otherwise append non-hyperlinked text
      docNodeContainer.appendNode(new DocPlainText({ configuration, text: unwrappedTokenText }));
    }
  }

  private _isComplexTypeSignature(text: string): boolean {
    // Check for patterns that commonly cause MDX parsing issues
    return (
      // Function signatures with constructor syntax
      text.includes('{ new (') ||
      // Complex generic types
      (text.includes('<') && text.includes('>') && text.includes('{')) ||
      // Multi-part object types
      (text.includes('{') && text.includes('}') && text.includes(':')) ||
      // Array types with complex generics
      (text.includes('[]') && text.includes('<')) ||
      // Union types with complex members
      (text.includes(' | ') && (text.includes('{') || text.includes('('))) ||
      // Very long type signatures that might wrap awkwardly
      text.length > 80
    );
  }

  private _createTitleCell(apiItem: ApiItem): DocTableCell {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    let linkText: string = Utilities.getConciseSignature(apiItem);
    if (ApiOptionalMixin.isBaseClassOf(apiItem) && apiItem.isOptional) {
      linkText += '?';
    }

    return new DocTableCell({ configuration }, [
      new DocParagraph({ configuration }, [
        new DocLinkTag({
          configuration,
          tagName: '@link',
          linkText: linkText,
          urlDestination: this._getLinkFilenameForApiItem(apiItem)
        })
      ])
    ]);
  }

  /**
   * This generates a DocTableCell for an ApiItem including the summary section and "(BETA)" annotation.
   *
   * @remarks
   * We mostly assume that the input is an ApiDocumentedItem, but it's easier to perform this as a runtime
   * check than to have each caller perform a type cast.
   */
  private _createDescriptionCell(apiItem: ApiItem, isInherited: boolean = false): DocTableCell {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    const section: DocSection = new DocSection({ configuration });

    if (ApiReleaseTagMixin.isBaseClassOf(apiItem)) {
      if (apiItem.releaseTag === ReleaseTag.Alpha || apiItem.releaseTag === ReleaseTag.Beta) {
        section.appendNodesInParagraph([
          new DocEmphasisSpan({ configuration, bold: true, italic: true }, [
            new DocPlainText({
              configuration,
              text: `(${apiItem.releaseTag === ReleaseTag.Alpha ? 'ALPHA' : 'BETA'})`
            })
          ]),
          new DocPlainText({ configuration, text: ' ' })
        ]);
      }
    }

    if (ApiOptionalMixin.isBaseClassOf(apiItem) && apiItem.isOptional) {
      section.appendNodesInParagraph([
        new DocEmphasisSpan({ configuration, italic: true }, [
          new DocPlainText({ configuration, text: '(Optional)' })
        ]),
        new DocPlainText({ configuration, text: ' ' })
      ]);
    }

    if (apiItem instanceof ApiDocumentedItem) {
      if (apiItem.tsdocComment !== undefined) {
        this._appendAndMergeSection(section, apiItem.tsdocComment.summarySection);
      }
    }

    if (isInherited && apiItem.parent) {
      section.appendNode(
        new DocParagraph({ configuration }, [
          new DocPlainText({ configuration, text: '(Inherited from ' }),
          new DocLinkTag({
            configuration,
            tagName: '@link',
            linkText: apiItem.parent.displayName,
            urlDestination: this._getLinkFilenameForApiItem(apiItem.parent)
          }),
          new DocPlainText({ configuration, text: ')' })
        ])
      );
    }

    return new DocTableCell({ configuration }, section.nodes);
  }

  private _createModifiersCell(apiItem: ApiItem): DocTableCell {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    const section: DocSection = new DocSection({ configuration });

    // Output modifiers in syntactically correct order: first access modifier (here: `protected`), then
    // `static` or `abstract` (no member can be both, so the order between the two of them does not matter),
    // last `readonly`. If `override` was supported, it would go directly before `readonly`.

    if (ApiProtectedMixin.isBaseClassOf(apiItem)) {
      if (apiItem.isProtected) {
        section.appendNode(
          new DocParagraph({ configuration }, [new DocCodeSpan({ configuration, code: 'protected' })])
        );
      }
    }

    if (ApiStaticMixin.isBaseClassOf(apiItem)) {
      if (apiItem.isStatic) {
        section.appendNode(
          new DocParagraph({ configuration }, [new DocCodeSpan({ configuration, code: 'static' })])
        );
      }
    }

    if (ApiAbstractMixin.isBaseClassOf(apiItem)) {
      if (apiItem.isAbstract) {
        section.appendNode(
          new DocParagraph({ configuration }, [new DocCodeSpan({ configuration, code: 'abstract' })])
        );
      }
    }

    if (ApiReadonlyMixin.isBaseClassOf(apiItem)) {
      if (apiItem.isReadonly) {
        section.appendNode(
          new DocParagraph({ configuration }, [new DocCodeSpan({ configuration, code: 'readonly' })])
        );
      }
    }

    return new DocTableCell({ configuration }, section.nodes);
  }

  private _createPropertyTypeCell(apiItem: ApiItem): DocTableCell {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    const section: DocSection = new DocSection({ configuration });

    if (apiItem instanceof ApiPropertyItem) {
      section.appendNode(this._createParagraphForTypeExcerpt(apiItem.propertyTypeExcerpt));
    }

    return new DocTableCell({ configuration }, section.nodes);
  }

  private _createInitializerCell(apiItem: ApiItem): DocTableCell {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    const section: DocSection = new DocSection({ configuration });

    if (ApiInitializerMixin.isBaseClassOf(apiItem)) {
      if (apiItem.initializerExcerpt) {
        section.appendNodeInParagraph(
          new DocCodeSpan({ configuration, code: apiItem.initializerExcerpt.text })
        );
      }
    }

    return new DocTableCell({ configuration }, section.nodes);
  }

  private _writeBreadcrumb(output: DocSection, apiItem: ApiItem): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;

    output.appendNodeInParagraph(
      new DocLinkTag({
        configuration,
        tagName: '@link',
        linkText: 'Home',
        urlDestination: this._getLinkFilenameForApiItem(this._apiModel)
      })
    );

    for (const hierarchyItem of this._getHierarchy(apiItem)) {
      switch (hierarchyItem.kind) {
        case ApiItemKind.Model:
        case ApiItemKind.EntryPoint:
          // We don't show the model as part of the breadcrumb because it is the root-level container.
          // We don't show the entry point because today API Extractor doesn't support multiple entry points;
          // this may change in the future.
          break;
        default:
          output.appendNodesInParagraph([
            new DocPlainText({
              configuration,
              text: ' > '
            }),
            new DocLinkTag({
              configuration,
              tagName: '@link',
              linkText: hierarchyItem.displayName,
              urlDestination: this._getLinkFilenameForApiItem(hierarchyItem)
            })
          ]);
      }
    }
  }

  private _writeAlphaWarning(output: DocSection): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;
    const betaWarning: string =
      'This API is provided as an alpha preview for developers and may change' +
      ' based on feedback that we receive.  Do not use this API in a production environment.';
    output.appendNode(
      new DocNoteBox({ configuration }, [
        new DocParagraph({ configuration }, [new DocPlainText({ configuration, text: betaWarning })])
      ])
    );
  }

  private _writeBetaWarning(output: DocSection): void {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;
    const betaWarning: string =
      'This API is provided as a beta preview for developers and may change' +
      ' based on feedback that we receive.  Do not use this API in a production environment.';
    output.appendNode(
      new DocNoteBox({ configuration }, [
        new DocParagraph({ configuration }, [new DocPlainText({ configuration, text: betaWarning })])
      ])
    );
  }

  private _appendSection(output: DocSection, docSection: DocSection): void {
    for (const node of docSection.nodes) {
      output.appendNode(node);
    }
  }

  private _appendAndMergeSection(output: DocSection, docSection: DocSection): void {
    let firstNode: boolean = true;
    for (const node of docSection.nodes) {
      if (firstNode) {
        if (node.kind === DocNodeKind.Paragraph) {
          output.appendNodesInParagraph(node.getChildNodes());
          firstNode = false;
          continue;
        }
      }
      firstNode = false;

      output.appendNode(node);
    }
  }

  private _getMembersAndWriteIncompleteWarning(
    apiClassOrInterface: ApiClass | ApiInterface,
    output: DocSection
  ): readonly ApiItem[] {
    const configuration: TSDocConfiguration = this._tsdocConfiguration;
    const showInheritedMembers: boolean = false; // Simplified: always false for clarity
    if (!showInheritedMembers) {
      return apiClassOrInterface.members;
    }

    const result: IFindApiItemsResult = apiClassOrInterface.findMembersWithInheritance();

    // If the result is potentially incomplete, write a short warning communicating this.
    if (result.maybeIncompleteResult) {
      output.appendNode(
        new DocParagraph({ configuration }, [
          new DocEmphasisSpan({ configuration, italic: true }, [
            new DocPlainText({
              configuration,
              text: '(Some inherited members may not be shown because they are not represented in the documentation.)'
            })
          ])
        ])
      );
    }

    // Log the messages for diagnostic purposes.
    for (const message of result.messages) {
      debug.info(`Diagnostic message for findMembersWithInheritance: ${message.text}`);
    }

    return result.items;
  }

  private _getFilenameForApiItem(apiItem: ApiItem): string {
    if (apiItem.kind === ApiItemKind.Model) {
      return 'index.mdx';
    }

    const pathParts: string[] = [];

    // Validate API item before processing
    this._validateApiItem(apiItem);

    for (const hierarchyItem of this._getHierarchy(apiItem)) {
      // Skip items that should not be included in filename or have empty names
      switch (hierarchyItem.kind) {
        case ApiItemKind.Model:
        case ApiItemKind.EntryPoint:
        case ApiItemKind.EnumMember:
          continue;
        case ApiItemKind.Package:
          const packageName = hierarchyItem.displayName || 'package';
          const unscopedName = PackageName.getUnscopedName(packageName);

          // Validate package name
          if (this._isDangerousName(unscopedName)) {
            throw new ValidationError(
              `Dangerous package name detected: "${unscopedName}"`,
              { resource: 'apiItem', operation: 'validateFilename', data: { packageName } }
            );
          }

          pathParts.push(unscopedName);
          continue;
      }

      // Skip items with no displayName
      if (!hierarchyItem.displayName) {
        continue;
      }

      // Normalize the display name (removes parentheses from constructors)
      let itemName: string = Utilities.normalizeDisplayName(hierarchyItem.displayName);

      // For overloaded methods, add a suffix such as "MyClass/myMethod_2".
      if (ApiParameterListMixin.isBaseClassOf(hierarchyItem)) {
        if (hierarchyItem.overloadIndex > 1) {
          // Subtract one for compatibility with earlier releases of API Documenter.
          // (This will get revamped when we fix GitHub issue #1308)
          itemName += `_${hierarchyItem.overloadIndex - 1}`;
        }
      }

      // Validate item name for dangerous patterns
      if (this._isDangerousName(itemName)) {
        throw new ValidationError(
          `Dangerous API item name detected: "${itemName}"`,
          { resource: 'apiItem', operation: 'validateFilename', data: { itemName } }
        );
      }

      // Sanitize while preserving case for nested folder structure
      const safeName = Utilities.getSafeFilenamePreservingCase(itemName);

      // Additional validation for the sanitized name
      if (safeName.length > MarkdownDocumenter.MAX_FILENAME_LENGTH) {
        throw new ValidationError(
          `API item name too long: "${safeName}" exceeds ${MarkdownDocumenter.MAX_FILENAME_LENGTH} characters`,
          { resource: 'apiItem', operation: 'validateFilename', data: { itemName, length: safeName.length } }
        );
      }

      pathParts.push(safeName);
    }

    if (pathParts.length === 0) {
      throw new ValidationError(
        'Unable to generate filename: no valid path parts',
        { resource: 'apiItem', operation: 'validateFilename', data: { apiItem: apiItem.displayName } }
      );
    }

    // Join with platform-specific path separator and add .mdx extension
    const filename = path.join(...pathParts) + '.mdx';

    // Final validation to ensure no path traversal
    if (filename.includes('..') || path.isAbsolute(filename)) {
      throw new ValidationError(
        `Generated filename contains dangerous path: "${filename}"`,
        { resource: 'apiItem', operation: 'validateFilename', data: { filename } }
      );
    }

    return filename;
  }

  private _getLinkFilenameForApiItem(apiItem: ApiItem): string {
    return './' + this._getFilenameForApiItem(apiItem);
  }

  /**
   * Validates an API item for dangerous content or malformed data
   */
  private _validateApiItem(apiItem: ApiItem): void {
    if (!apiItem) {
      throw new ValidationError(
        'Invalid API item: null or undefined',
        { resource: 'apiItem', operation: 'validateApiItem' }
      );
    }

    // Check for processing time limit
    const elapsedTime = Date.now() - this._startTime;
    if (elapsedTime > MarkdownDocumenter.MAX_PROCESSING_TIME_MS) {
      throw new ValidationError(
        `Processing time limit exceeded: ${elapsedTime}ms > ${MarkdownDocumenter.MAX_PROCESSING_TIME_MS}ms`,
        { resource: 'apiItem', operation: 'validateApiItem', data: { elapsedTime } }
      );
    }

    // Basic validation of display name
    if (apiItem.displayName) {
      if (apiItem.displayName.length > 1000) {
        throw new ValidationError(
          `API item display name too long: ${apiItem.displayName.length} characters`,
          { resource: 'apiItem', operation: 'validateApiItem', data: { displayName: apiItem.displayName } }
        );
      }

      if (this._isDangerousName(apiItem.displayName)) {
        throw new ValidationError(
          `Dangerous API item display name: "${apiItem.displayName}"`,
          { resource: 'apiItem', operation: 'validateApiItem', data: { displayName: apiItem.displayName } }
        );
      }
    }
  }

  /**
   * Checks if a name contains dangerous patterns that could lead to path traversal or other security issues
   */
  private _isDangerousName(name: string): boolean {
    if (!name || typeof name !== 'string') {
      return true;
    }

    // Check for path traversal patterns
    if (name.includes('..') || name.includes('~') || name.includes('//')) {
      return true;
    }

    // Check for absolute path patterns
    if (name.startsWith('/') || name.startsWith('\\')) {
      return true;
    }

    // Check for null bytes or other dangerous characters
    if (name.includes('\0') || name.includes('<') || name.includes('>')) {
      return true;
    }

    // Check for Windows device names or reserved patterns
    const dangerousPatterns = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    const upperName = name.toUpperCase();
    if (dangerousPatterns.includes(upperName)) {
      return true;
    }

    return false;
  }

  private _generateFrontmatter(apiItem: ApiItem): string {
    const title = this._getTitle(apiItem);
    const icon = this._getIcon(apiItem);
    const description = this._getDescription(apiItem);

    const frontmatter: any = {
      title
    };

    if (icon) {
      frontmatter.icon = icon;
    }

    if (description) {
      frontmatter.description = description;
    }

    // Sanitize frontmatter values to prevent YAML injection
    try {
      const sanitizedEntries = Object.entries(frontmatter).map(([key, value]) => {
        if (typeof value === 'string') {
          // Use SecurityUtils to sanitize YAML text
          const sanitizedValue = SecurityUtils.sanitizeYamlText(value);
          return `${key}: ${sanitizedValue}`;
        } else {
          // For non-string values, use JSON.stringify but validate first
          const stringValue = JSON.stringify(value);
          // Validate the JSON string doesn't contain dangerous patterns
          if (stringValue.includes('__proto__') || stringValue.includes('constructor')) {
            throw new ValidationError(
              `Invalid frontmatter value for key "${key}": contains dangerous patterns`,
              { resource: key, operation: 'sanitizeFrontmatter' }
            );
          }
          return `${key}: ${stringValue}`;
        }
      });

      return '---\n' + sanitizedEntries.join('\n') + '\n---';
    } catch (error) {
      if (error instanceof DocumentationError) {
        throw error;
      }
      throw new DocumentationError(
        `Failed to generate frontmatter for ${apiItem.displayName}`,
        ErrorCode.RENDER_ERROR,
        {
          resource: apiItem.displayName,
          operation: 'generateFrontmatter',
          cause: error instanceof Error ? error : new Error(String(error))
        }
      );
    }
  }

  private _getTitle(apiItem: ApiItem): string {
    const scopedName: string = this._getScopedNameWithinPackage(apiItem);

    switch (apiItem.kind) {
      case ApiItemKind.Class:
        return `${scopedName} class`;
      case ApiItemKind.Enum:
        return `${scopedName} enum`;
      case ApiItemKind.Interface:
        return `${scopedName} interface`;
      case ApiItemKind.Constructor:
      case ApiItemKind.ConstructSignature:
        // For constructors, use just "constructor" without parentheses
        return Utilities.normalizeDisplayName(scopedName);
      case ApiItemKind.Method:
      case ApiItemKind.MethodSignature:
        return `${scopedName} method`;
      case ApiItemKind.Function:
        return `${scopedName} function`;
      case ApiItemKind.Model:
        return 'API Reference';
      case ApiItemKind.Namespace:
        return `${scopedName} namespace`;
      case ApiItemKind.Package:
        const unscopedPackageName: string = PackageName.getUnscopedName(apiItem.displayName);
        return `${unscopedPackageName} package`;
      case ApiItemKind.Property:
      case ApiItemKind.PropertySignature:
        return `${scopedName} property`;
      case ApiItemKind.TypeAlias:
        return `${scopedName} type`;
      case ApiItemKind.Variable:
        return `${scopedName} variable`;
      default:
        return scopedName;
    }
  }

  private _getIcon(apiItem: ApiItem): string | undefined {
    const iconMap: Map<ApiItemKind, string> = new Map([
      [ApiItemKind.Class, 'box'],
      [ApiItemKind.Interface, 'square-dashed'],
      [ApiItemKind.Function, 'function'],
      [ApiItemKind.Method, 'function'],
      [ApiItemKind.Property, 'variable'],
      [ApiItemKind.Enum, 'list'],
      [ApiItemKind.TypeAlias, 'type'],
      [ApiItemKind.Namespace, 'folder'],
      [ApiItemKind.Package, 'package'],
      [ApiItemKind.Variable, 'variable']
    ]);

    return iconMap.get(apiItem.kind);
  }

  private _getDescription(apiItem: ApiItem): string | null {
    if (!(apiItem instanceof ApiDocumentedItem) || !apiItem.tsdocComment?.summarySection) {
      return null;
    }

    let description = this._renderDocSection(apiItem.tsdocComment.summarySection);

    // Remove TSDoc block tags that shouldn't appear in descriptions
    // These tags like @param, @returns, @enum, etc. should not be in the summary
    // Match both @tag and @tag {type} patterns
    description = description.replace(/@(param|returns?|throws?|example|remarks?|see|alpha|beta|deprecated|internal|public|private|protected|readonly|virtual|override|sealed|event|eventProperty|typeParam|enum|namespace|package|module|class|interface|function|method|property|constructor|variable|typedef|callback|extends|implements)(\s+\{[^}]*\})?(\s+[^\n@]*)?/gi, '');

    // Clean up any extra whitespace that may have been left
    description = description.replace(/\s+/g, ' ').trim();

    // Sanitize for use in YAML frontmatter
    return this._sanitizeForFrontmatter(description);
  }

  /**
   * Sanitize text for safe use in YAML frontmatter
   * Removes newlines, strips markdown formatting, and ensures proper escaping
   */
  private _sanitizeForFrontmatter(text: string): string {
    if (!text) return '';

    // Remove markdown formatting
    let sanitized = text
      // Remove inline code with JSX comments
      .replace(/\{\s*\/\*\s*\*\/\s*\}/g, '')
      // Remove leftover curly braces from TSDoc type parameters
      .replace(/\{[^}]*\}/g, '')
      // Remove inline code backticks
      .replace(/`([^`]+)`/g, '$1')
      // Remove bold/italic markers
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // Remove markdown links
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove HTML tags (they break MDX compilation in descriptions)
      .replace(/<([^>]+)>/g, '&lt;$1&gt;')
      // Remove common standalone type/class names at the end (leftovers from @extends, @enum, etc.)
      // Only remove if preceded by period and space/punctuation
      .replace(/[.!?]\s+(Error|string|number|boolean|object|any|void|null|undefined|never|unknown)\s*$/gi, '.')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      .trim();

    // Escape special characters for YAML
    // Note: We don't use SecurityUtils.sanitizeYamlText here because it's too aggressive
    // and escapes newlines to literal \n which doesn't work in quoted strings
    sanitized = sanitized
      .replace(/\\/g, '\\\\')  // Escape backslashes
      .replace(/"/g, '\\"');    // Escape double quotes

    return sanitized;
  }

  private _renderDocSection(section: DocSection): string {
    const stringBuilder: StringBuilder = new StringBuilder();
    this._markdownEmitter.emit(stringBuilder, section, {
      contextApiItem: this._apiModel,
      onGetFilenameForApiItem: (apiItemForFilename: ApiItem) => {
        return this._getLinkFilenameForApiItem(apiItemForFilename);
      }
    });
    return stringBuilder.toString().trim();
  }

  private _deleteOldOutputFiles(): void {
    clack.log.info('Deleting old output from ' + this._outputFolder);

    // Additional safety check: ensure the folder is actually a documentation output folder
    // by checking if it contains expected files or is empty
    try {
      if (FileSystem.exists(this._outputFolder)) {
        const contents = FileSystem.readFolderItemNames(this._outputFolder);
        const hasExpectedFiles = contents.some(item =>
          item.endsWith('.mdx') ||
          item.endsWith('.md') ||
          item === 'docs.json' ||
          item === 'snippets'
        );

        if (!hasExpectedFiles && contents.length > 0) {
          clack.log.warn(`Output folder ${this._outputFolder} contains unexpected files. Skipping deletion for safety.`);
          return;
        }
      }

      FileSystem.ensureEmptyFolder(this._outputFolder);
    } catch (error) {
      throw new FileSystemError(
        `Failed to clean output folder: ${this._outputFolder}`,
        ErrorCode.FILE_WRITE_ERROR,
        {
          resource: this._outputFolder,
          operation: 'deleteOldOutputFiles',
          cause: error instanceof Error ? error : new Error(String(error)),
          suggestion: 'Check folder permissions and ensure the path is correct'
        }
      );
    }
  }

  private _isTopLevelItem(apiItem: ApiItem): boolean {
    return [
      ApiItemKind.Class,
      ApiItemKind.Interface,
      ApiItemKind.Function,
      ApiItemKind.TypeAlias,
      ApiItemKind.Enum,
      ApiItemKind.Variable,
      ApiItemKind.Namespace
    ].includes(apiItem.kind);
  }

  private _addToNavigation(apiItem: ApiItem, filename: string, parentFilename?: string): void {
    this._navigationManager.addApiItem(apiItem, filename, parentFilename);
  }

  public generateNavigation(): void {
    try {
      this._navigationManager.generateNavigation();
    } catch (error) {
      clack.log.error(`❌ Failed to generate navigation: ${error}`);
      throw error;
    }
  }

  /**
   * Generate tsconfig.json for VSCode path mapping and MDX language server.
   * This allows VSCode to resolve /snippets/* imports correctly and enables
   * strict type checking in MDX files.
   */
  private _generateJsConfig(): void {
    const docsRoot = path.dirname(this._outputFolder);
    const tsconfigPath = path.join(docsRoot, 'tsconfig.json');

    // Check if tsconfig.json already exists
    if (FileSystem.exists(tsconfigPath)) {
      // Don't overwrite existing tsconfig.json
      clack.log.info('   ⚠ tsconfig.json already exists, skipping generation');
      return;
    }

    try {
      const tsconfigContent = {
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '/snippets/*': ['./snippets/*']
          },
          jsx: 'react',
          module: 'esnext',
          moduleResolution: 'bundler',
          allowSyntheticDefaultImports: true,
          checkJs: false,
          // Allow JavaScript files to be compiled
          allowJs: true,
          // Don't emit output - this is just for IDE
          noEmit: true
        },
        // MDX language server configuration
        mdx: {
          // Enable strict type checking in MDX files
          checkMdx: true
        },
        include: [
          '**/*.jsx',
          '**/*.mdx',
          '**/*.js',
          '**/*.ts',
          '**/*.tsx'
        ],
        exclude: [
          'node_modules',
          '.tsdocs'
        ]
      };

      FileSystem.writeFile(
        tsconfigPath,
        JSON.stringify(tsconfigContent, null, 2) + '\n'
      );

      clack.log.success('   ✓ Generated tsconfig.json for VSCode path resolution and MDX support');
    } catch (error) {
      clack.log.warn(`   ⚠ Failed to generate tsconfig.json: ${error}`);
      debug.warn('tsconfig.json generation failed:', error);
    }
  }

  /**
   * Generate TypeInfo.jsx file with type information for all API items.
   * This allows documentation authors to reference types with IDE autocomplete.
   */
  private _generateTypeInfo(): void {
    const docsRoot = path.dirname(this._outputFolder);
    const snippetsFolder = path.join(docsRoot, 'snippets', 'tsdocs');
    const typeInfoJsPath = path.join(snippetsFolder, 'TypeInfo.jsx');
    const typeInfoDtsPath = path.join(snippetsFolder, 'TypeInfo.d.ts');

    try {
      // Ensure snippets folder exists
      FileSystem.ensureFolder(snippetsFolder);

      // Generate TypeInfo content
      const generator = new TypeInfoGenerator(this._apiModel);

      // Generate JavaScript module
      const jsContent = generator.generateTypeInfoModule();
      FileSystem.writeFile(typeInfoJsPath, jsContent);

      // Generate TypeScript declarations for VSCode autocomplete
      const dtsContent = generator.generateTypeInfoDeclaration();
      FileSystem.writeFile(typeInfoDtsPath, dtsContent);

      clack.log.success('   ✓ Generated TypeInfo.jsx with type information');
      clack.log.success('   ✓ Generated TypeInfo.d.ts for VSCode autocomplete');
    } catch (error) {
      // Log warning but don't fail the build
      clack.log.warn(`   ⚠ Failed to generate TypeInfo: ${error}`);
      debug.warn('TypeInfo generation failed:', error);
    }
  }

  /**
   * Generate ValidRefs.jsx with all valid API reference IDs for link validation
   */
  private _generateValidRefs(): void {
    const docsRoot = path.dirname(this._outputFolder);
    const snippetsFolder = path.join(docsRoot, 'snippets', 'tsdocs');
    const validRefsPath = path.join(snippetsFolder, 'ValidRefs.jsx');

    try {
      // Ensure snippets folder exists
      FileSystem.ensureFolder(snippetsFolder);

      // Collect all valid RefIds from the API model using the same format as LinkValidator
      const validRefs = new Set<string>();

      const collectRefs = (apiItem: ApiItem): void => {
        // Skip certain kinds that don't generate pages
        if (
          apiItem.kind === ApiItemKind.EntryPoint ||
          apiItem.kind === ApiItemKind.Model ||
          apiItem.kind === ApiItemKind.EnumMember
        ) {
          // Still recurse into members (except for EnumMember which has none)
          if (apiItem.members) {
            for (const member of apiItem.members) {
              collectRefs(member);
            }
          }
          return;
        }

        // Build RefId using dash-case to match actual file paths
        const parts: string[] = [];
        let current: ApiItem | undefined = apiItem;

        while (current) {
          if (current.kind === ApiItemKind.Package) {
            const packageName = current.displayName || 'package';
            const unscopedName = PackageName.getUnscopedName(packageName);
            // Keep original dash-case for package names to match file paths
            parts.unshift(unscopedName);
            break;
          }

          if (current.kind !== ApiItemKind.EntryPoint && current.displayName) {
            // Normalize display name to remove parentheses from constructors
            parts.unshift(Utilities.normalizeDisplayName(current.displayName));
          }

          current = current.parent;
        }

        if (parts.length > 0) {
          const refId = parts.join('.');
          validRefs.add(refId);
        }

        // Recursively collect from members
        if (apiItem.members) {
          for (const member of apiItem.members) {
            collectRefs(member);
          }
        }
      };

      // Collect from all packages
      for (const apiMember of this._apiModel.members) {
        collectRefs(apiMember);
      }

      // Generate JavaScript module with the set
      const refsArray = Array.from(validRefs).sort();
      const jsContent = `// @ts-nocheck
/**
 * Valid API Reference IDs
 * Auto-generated by mint-tsdocs during documentation build.
 * Used by Link component for runtime validation.
 *
 * @generated
 */

/**
 * Set of all valid RefIds in the documentation
 */
export const VALID_REFS = new Set(${JSON.stringify(refsArray, null, 2)});

/**
 * Check if a RefId is valid
 * @param {string} refId - The RefId to validate
 * @returns {boolean} True if the RefId exists
 */
export function isValidRef(refId) {
  return VALID_REFS.has(refId);
}
`;

      FileSystem.writeFile(validRefsPath, jsContent);

      // Also generate TypeScript declaration file with union type
      const validRefsDtsPath = path.join(snippetsFolder, 'ValidRefs.d.ts');
      const refUnion = refsArray.map(ref => `  | ${JSON.stringify(ref)}`).join('\n');
      const refsDtsContent = `/**
 * Type declarations for ValidRefs
 * Auto-generated from API model structure.
 *
 * @generated
 */

/**
 * Union type of all valid API reference IDs
 */
export type ValidRefId =
${refUnion};

/**
 * Set of all valid RefIds in the documentation
 */
export const VALID_REFS: Set<ValidRefId>;

/**
 * Check if a RefId is valid
 */
export function isValidRef(refId: string): refId is ValidRefId;
`;

      FileSystem.writeFile(validRefsDtsPath, refsDtsContent);
      clack.log.success(`   ✓ Generated ValidRefs.jsx with ${validRefs.size} reference IDs`);
    } catch (error) {
      // Log warning but don't fail the build
      clack.log.warn(`   ⚠ Failed to generate ValidRefs: ${error}`);
      debug.warn('ValidRefs generation failed:', error);
    }
  }

  /**
   * Generate ValidPages.jsx with all valid page IDs from docs.json for link validation
   */
  private _generateValidPages(): void {
    const docsRoot = path.dirname(this._outputFolder);
    const snippetsFolder = path.join(docsRoot, 'snippets', 'tsdocs');
    const validPagesPath = path.join(snippetsFolder, 'ValidPages.jsx');

    try {
      // Ensure snippets folder exists
      FileSystem.ensureFolder(snippetsFolder);

      // Read docs.json if it exists
      const docsJsonPath = this._docsJsonPath || path.join(docsRoot, 'docs.json');
      if (!FileSystem.exists(docsJsonPath)) {
        debug.warn('docs.json not found, skipping ValidPages generation');
        return;
      }

      const docsJsonContent = FileSystem.readFile(docsJsonPath);
      const docsJson = JSON.parse(docsJsonContent);

      // Collect all valid page IDs from docs.json navigation
      const validPages = new Set<string>();

      const collectPages = (item: any): void => {
        if (typeof item === 'string') {
          // Simple page reference
          validPages.add(item);
        } else if (item && typeof item === 'object') {
          // Group or nested structure
          if (item.page) {
            validPages.add(item.page);
          }
          if (item.pages && Array.isArray(item.pages)) {
            for (const page of item.pages) {
              collectPages(page);
            }
          }
          if (item.groups && Array.isArray(item.groups)) {
            for (const group of item.groups) {
              collectPages(group);
            }
          }
        }
      };

      // Start from navigation.tabs or navigation directly
      if (docsJson.navigation) {
        if (docsJson.navigation.tabs && Array.isArray(docsJson.navigation.tabs)) {
          for (const tab of docsJson.navigation.tabs) {
            collectPages(tab);
          }
        } else {
          collectPages(docsJson.navigation);
        }
      }

      // Generate JavaScript module with the set
      const pagesArray = Array.from(validPages).sort();
      const jsContent = `// @ts-nocheck
/**
 * Valid Documentation Page IDs
 * Auto-generated by mint-tsdocs during documentation build.
 * Extracted from docs.json navigation structure.
 * Used by PageLink component for runtime validation.
 *
 * @generated
 */

/**
 * Set of all valid PageIds in the documentation
 */
export const VALID_PAGES = new Set(${JSON.stringify(pagesArray, null, 2)});

/**
 * Check if a PageId is valid
 * @param {string} pageId - The PageId to validate
 * @returns {boolean} True if the PageId exists
 */
export function isValidPage(pageId) {
  return VALID_PAGES.has(pageId);
}
`;

      FileSystem.writeFile(validPagesPath, jsContent);

      // Also generate TypeScript declaration file with union type
      const validPagesDtsPath = path.join(snippetsFolder, 'ValidPages.d.ts');
      const pageUnion = pagesArray.map(page => `  | ${JSON.stringify(page)}`).join('\n');
      const dtsContent = `/**
 * Type declarations for ValidPages
 * Auto-generated from docs.json navigation structure.
 *
 * @generated
 */

/**
 * Union type of all valid page IDs from docs.json
 */
export type ValidPageId =
${pageUnion};

/**
 * Set of all valid PageIds in the documentation
 */
export const VALID_PAGES: Set<ValidPageId>;

/**
 * Check if a PageId is valid
 */
export function isValidPage(pageId: string): pageId is ValidPageId;
`;

      FileSystem.writeFile(validPagesDtsPath, dtsContent);
      clack.log.success(`   ✓ Generated ValidPages.jsx with ${validPages.size} page IDs`);
    } catch (error) {
      // Log warning but don't fail the build
      clack.log.warn(`   ⚠ Failed to generate ValidPages: ${error}`);
      debug.warn('ValidPages generation failed:', error);
    }
  }

  /**
   * Copy Mintlify components (like TypeTree) to the user's docs/snippets/tsdocs folder.
   * This allows generated MDX files to use these components.
   *
   * Note: Mintlify requires components to be in the docs/snippets folder.
   * They cannot be imported directly from npm packages.
   * We use a tsdocs subfolder to avoid conflicts with user's own components.
   */
  private _copyMintlifyComponents(): void {
    // Determine the snippets folder relative to the output folder
    // Typically output is ./docs/api and snippets should be ./docs/snippets/tsdocs
    const docsRoot = path.dirname(this._outputFolder);
    const snippetsFolder = path.join(docsRoot, 'snippets', 'tsdocs');

    // Source components directory in our package
    // When compiled, this will be in lib/documenters/, components will be in lib/components/
    const componentsSource = path.resolve(__dirname, '../components');

    // Check if components source exists
    if (!FileSystem.exists(componentsSource)) {
      throw new DocumentationError(
        `INTERNAL ERROR: Components directory not found: ${componentsSource}\n` +
        `This indicates the package was not built correctly. The build script should copy src/components/ to lib/components/.\n` +
        `Please report this issue at: https://github.com/anthropics/claude-code/issues`,
        ErrorCode.FILE_NOT_FOUND,
        {
          resource: componentsSource,
          operation: 'copyMintlifyComponents',
          suggestion: 'Rebuild the package with: bun run rebuild'
        }
      );
    }

    // Ensure snippets folder exists
    FileSystem.ensureFolder(snippetsFolder);

    // Dynamically discover all component files
    const componentFiles = this._discoverComponentFiles(componentsSource);

    clack.log.info('📦 Installing Mintlify components...');

    let installedCount = 0;
    let updatedCount = 0;

    for (const componentFile of componentFiles) {
      try {
        const sourcePath = path.join(componentsSource, componentFile);
        const targetPath = path.join(snippetsFolder, componentFile);

        // Validate paths before processing
        SecurityUtils.validateFilePath(componentsSource, sourcePath);
        SecurityUtils.validateFilePath(snippetsFolder, targetPath);

        // Check if we should update the component
        let shouldCopy = true;
        if (FileSystem.exists(targetPath)) {
          // Component already exists - check version
          shouldCopy = this._shouldUpdateComponent(sourcePath, targetPath);
        }

        if (shouldCopy) {
          FileSystem.ensureFolder(path.dirname(targetPath));
          const componentContent = FileSystem.readFile(sourcePath);

          // Validate component content size
          const contentLength = Buffer.byteLength(componentContent, 'utf8');
          if (contentLength > MarkdownDocumenter.MAX_FILE_SIZE_BYTES) {
            throw new ValidationError(
              `Component file too large: ${componentFile} (${contentLength} bytes)`,
              { resource: componentFile, operation: 'installComponent', data: { size: contentLength } }
            );
          }

          FileSystem.writeFile(targetPath, componentContent);
          installedCount++;
          if (this._verbose) {
            clack.log.success(`   ✓ Installed ${componentFile}`);
          }
        } else {
          updatedCount++;
          if (this._verbose) {
            clack.log.info(`   ✓ ${componentFile} is up to date`);
          }
        }
      } catch (error) {
        if (error instanceof DocumentationError) {
          throw error;
        }
        throw new FileSystemError(
          `Failed to install component: ${componentFile}`,
          ErrorCode.FILE_WRITE_ERROR,
          {
            resource: componentFile,
            operation: 'installComponent',
            cause: error instanceof Error ? error : new Error(String(error))
          }
        );
      }
    }

    // Show summary if not in verbose mode
    if (!this._verbose) {
      const totalComponents = installedCount + updatedCount;
      if (installedCount > 0 && updatedCount > 0) {
        clack.log.success(`   ✓ Installed ${installedCount} and updated ${updatedCount} of ${totalComponents} components`);
      } else if (installedCount > 0) {
        clack.log.success(`   ✓ Installed ${installedCount} component${installedCount === 1 ? '' : 's'}`);
      } else if (updatedCount > 0) {
        clack.log.success(`   ✓ All ${updatedCount} components up to date`);
      }
    }
  }

  /**
   * Recursively discover all component files in the components directory
   */
  private _discoverComponentFiles(dir: string, baseDir: string = dir): string[] {
    const files: string[] = [];

    try {
      // Validate the directory exists and is accessible
      if (!FileSystem.exists(dir)) {
        throw new FileSystemError(
          `Components directory does not exist: ${dir}`,
          ErrorCode.FILE_NOT_FOUND,
          { resource: dir, operation: 'discoverComponentFiles' }
        );
      }

      const items = FileSystem.readFolderItemNames(dir);

      for (const item of items) {
        try {
          const fullPath = path.join(dir, item);

          // Validate the path
          SecurityUtils.validateFilePath(dir, fullPath);

          const stats = FileSystem.getStatistics(fullPath);

          if (stats.isDirectory()) {
            // Recursively search subdirectories
            files.push(...this._discoverComponentFiles(fullPath, baseDir));
          } else if (stats.isFile()) {
            // Include .jsx files (compiled from .jsx or .tsx), .d.ts files (for TypeScript support), and README.md
            // Mintlify can import .jsx files with raw JSX syntax
            // .d.ts files provide type checking in MDX files
            if (/\.jsx$/i.test(item) || /\.d\.ts$/i.test(item) || item === 'README.md') {
              const relativePath = path.relative(baseDir, fullPath);

              // Validate relative path doesn't contain dangerous patterns
              if (relativePath.includes('..')) {
                throw new ValidationError(
                  `Component path contains dangerous pattern: ${relativePath}`,
                  { resource: relativePath, operation: 'discoverComponentFiles' }
                );
              }

              files.push(relativePath);
            }
          }
        } catch (error) {
          if (error instanceof DocumentationError) {
            throw error;
          }
          // Log warning for individual file issues but continue processing
          debug.warn(`Warning: Failed to process component file ${item}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      if (error instanceof DocumentationError) {
        throw error;
      }
      throw new FileSystemError(
        `Failed to discover component files in directory: ${dir}`,
        ErrorCode.FILE_READ_ERROR,
        {
          resource: dir,
          operation: 'discoverComponentFiles',
          cause: error instanceof Error ? error : new Error(String(error))
        }
      );
    }

    return files;
  }

  /**
   * Check if a component should be updated based on version comparison
   */
  private _shouldUpdateComponent(sourcePath: string, targetPath: string): boolean {
    try {
      const sourceContent = FileSystem.readFile(sourcePath);
      const targetContent = FileSystem.readFile(targetPath);

      // Extract version from @version JSDoc comment
      const versionRegex = /@version\s+([\d.]+)/;
      const sourceMatch = sourceContent.match(versionRegex);
      const targetMatch = targetContent.match(versionRegex);

      if (!sourceMatch || !targetMatch) {
        // If we can't determine versions, always update
        return true;
      }

      const sourceVersion = sourceMatch[1];
      const targetVersion = targetMatch[1];

      // Simple version comparison (assumes semantic versioning)
      return this._compareVersions(sourceVersion, targetVersion) > 0;
    } catch (error) {
      // On any error, default to updating
      return true;
    }
  }

  /**
   * Compare two semantic version strings
   * Returns: 1 if v1 \> v2, -1 if v1 \< v2, 0 if equal
   */
  private _compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;

      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }

    return 0;
  }

  private _convertReadmeToIndex(): void {
    clack.log.info('🔍 Looking for README.md to convert to index.mdx...');
    
    // Find the API model's package to determine the source directory
    let sourceDirectory = '';
    
    // Check if we can determine source directory from the API model
    for (const apiMember of this._apiModel.members) {
      if (ApiItemKind.Package === apiMember.kind) {
        // Try to find README.md in the package's likely source directory
        // Common locations: current working directory, parent directories
        const possiblePaths = [
          path.resolve('.'),  // Current working directory
          path.resolve('..'), // Parent directory
          path.resolve('../..'), // Grandparent directory
        ];
        
        for (const candidatePath of possiblePaths) {
          const readmePath = path.join(candidatePath, 'README.md');
          if (FileSystem.exists(readmePath)) {
            sourceDirectory = candidatePath;
            clack.log.success(`   ✓ Found README.md at: ${readmePath}`);
            break;
          }
        }
        break;
      }
    }
    
    if (!sourceDirectory) {
      clack.log.info('   ❌ No README.md found in expected locations');
      return;
    }
    
    const readmePath = path.join(sourceDirectory, 'README.md');
    const indexPath = path.join(this._outputFolder, 'index.mdx');
    
    try {
      // Read the README content
      const readmeContent = FileSystem.readFile(readmePath);
      
      // Use custom title or default to 'README'
      const title = this._readmeTitle;
      
      // Convert to MDX with Mintlify frontmatter
      const mdxContent = this._convertReadmeToMdx(readmeContent, title);
      
      // Write the index.mdx file
      FileSystem.writeFile(indexPath, mdxContent);
      
      // Add to navigation if configured
      const navigationConfig = this._navigationManager.getStats();
      if (navigationConfig.docsJsonPath) {
        // Calculate relative path for navigation
        const docsJsonDir = path.dirname(navigationConfig.docsJsonPath);
        const relativePath = path.relative(docsJsonDir, this._outputFolder);
        const indexNavPath = path.posix.join(relativePath, 'index').replace(/\\/g, '/');

        // Add index page to navigation
        this._navigationManager.addNavigationItem({
          page: indexNavPath
        });
      }
      
      clack.log.success(`   ✓ Converted README.md to index.mdx`);
      
    } catch (error) {
      clack.log.error(`   ❌ Failed to convert README.md: ${error}`);
    }
  }
  
  private _convertReadmeToMdx(readmeContent: string, title: string): string {
    // Generate Mintlify frontmatter
    const frontmatter = [
      '---',
      `title: "${title}"`,
      'icon: "book-open"',
      'description: "Overview and introduction to the library"',
      '---'
    ].join('\n');
    
    // Convert HTML comments to MDX comments
    let mdxContent = readmeContent.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');
    
    // Remove the first # heading since it's now in the frontmatter
    mdxContent = mdxContent.replace(/^#\s+.+$/m, '');
    
    // Clean up any leading whitespace after removing the heading
    mdxContent = mdxContent.replace(/^\s*\n/, '');
    
    // Add auto-generation notice
    const notice = '{/* This file was auto-generated from README.md by mint-tsdocs */}\n\n';
    
    return `${frontmatter}\n${notice}${mdxContent}`;
  }

  /**
   * Convert kebab-case or snake_case to PascalCase
   * Used to match TypeInfo package name format
   */
  private _toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

}
