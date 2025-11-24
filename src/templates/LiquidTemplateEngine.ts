import * as path from 'path';
import * as fs from 'fs';
import { FileSystem } from '@rushstack/node-core-library';
import { Liquid } from 'liquidjs';

import { DocumentationError, ErrorCode } from '../errors/DocumentationError';
import type { ITemplateData, ITemplateEngineOptions } from './TemplateEngine';
import type { DocSegment } from '../utils/DocSectionConverter';
import { DocNodeKind } from '@microsoft/tsdoc';

/**
 * LiquidJS-based template engine implementation
 *
 * @see /architecture/generation-layer - Template engine architecture
 */
export class LiquidTemplateEngine {
  private readonly _templateDir: string;
  private readonly _cache: boolean;
  private readonly _strict: boolean;
  private readonly _liquid: Liquid;
  private readonly _templateCache: Map<string, string> = new Map();

  public constructor(options: ITemplateEngineOptions = {}) {
    // Default templates are bundled in lib/templates/defaults after build
    this._templateDir = options.templateDir || path.join(__dirname, '..', 'templates', 'defaults');
    this._cache = options.cache !== false;
    this._strict = options.strict !== false;

    this._liquid = new Liquid({
      root: this._templateDir,
      cache: this._cache,
      extname: '.liquid',
      // NOTE: strictVariables disabled because we have many optional properties in template data
      // Data is already sanitized by _sanitizeTemplateData()
      strictVariables: false,
      strictFilters: this._strict,
      // NOTE: dynamicPartials must be enabled for layout tag to work
      // This is safe in our context because:
      // 1. Template data comes from API Extractor, not user input
      // 2. Templates are either our defaults or user-provided (already trusted)
      // 3. Paths are constrained to the template directory by LiquidJS
      dynamicPartials: true,
      // Custom filters can be added here
      globals: {
        // Add any global variables that should be available in all templates
      }
    });

    // Register custom filters
    this._registerCustomFilters();
  }

  /**
   * Render a template with the provided data
   */
  public async render(templateName: string, data: ITemplateData): Promise<string> {
    try {
      const sanitizedData = this._sanitizeTemplateData(data);

      // Use renderFile instead of parseAndRender to properly support layout tags
      const result = await this._liquid.renderFile(templateName, sanitizedData);

      // Post-process to ensure valid MDX
      return this._postProcessOutput(result);
    } catch (error) {
      throw new DocumentationError(
        `Failed to render template '${templateName}': ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.TEMPLATE_RENDER_ERROR
      );
    }
  }

  /**
   * Check if a template exists
   */
  public hasTemplate(templateName: string): boolean {
    const templatePath = this._getTemplatePath(templateName);
    return FileSystem.exists(templatePath);
  }

  /**
   * Get available template names from the template directory
   */
  public getAvailableTemplates(): string[] {
    if (!FileSystem.exists(this._templateDir)) {
      return [];
    }

    try {
      const files = FileSystem.readFolderItemNames(this._templateDir);
      return files
        .filter((file: string) => file.endsWith('.liquid'))
        .map((file: string) => path.basename(file, '.liquid'));
    } catch {
      return [];
    }
  }

  /**
   * Load a template (with caching)
   */
  private async _loadTemplate(templateName: string): Promise<string> {
    const cacheKey = templateName;

    if (this._cache && this._templateCache.has(cacheKey)) {
      return this._templateCache.get(cacheKey)!;
    }

    const templatePath = this._getTemplatePath(templateName);

    if (!FileSystem.exists(templatePath)) {
      throw new DocumentationError(
        `Template '${templateName}' not found at ${templatePath}`,
        ErrorCode.TEMPLATE_NOT_FOUND
      );
    }

    try {
      const content = FileSystem.readFileToBuffer(templatePath).toString();

      if (this._cache) {
        this._templateCache.set(cacheKey, content);
      }

      return content;
    } catch (error) {
      throw new DocumentationError(
        `Failed to read template '${templateName}': ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.TEMPLATE_ERROR
      );
    }
  }

  /**
   * Get the Liquid engine for direct access
   */
  public get liquid(): Liquid {
    return this._liquid;
  }

  /**
   * Post-process template output (public for template manager)
   */
  public postProcessOutput(output: string): string {
    return this._postProcessOutput(output);
  }

  /**
   * Get the template directory (public for template manager)
   */
  public get templateDir(): string {
    return this._templateDir;
  }

  /**
   * Get the full path for a template
   */
  private _getTemplatePath(templateName: string): string {
    // Try with .liquid extension first, then without extension
    const liquidPath = path.join(this._templateDir, `${templateName}.liquid`);
    if (FileSystem.exists(liquidPath)) {
      return liquidPath;
    }

    // For backward compatibility, also try the path as-is
    const directPath = path.join(this._templateDir, templateName);
    if (FileSystem.exists(directPath)) {
      return directPath;
    }

    return liquidPath; // Return the expected path for error messages
  }

  /**
   * Sanitize template data to prevent XSS and ensure valid output
   */
  private _sanitizeTemplateData(data: ITemplateData): ITemplateData {
    // Keys that should NOT be sanitized (code/type content and YAML frontmatter)
    const skipSanitizationKeys = new Set(['type', 'signature', 'code', 'typePath', 'defaultValue', 'title', 'description', 'icon']);

    // Track objects we've already processed to prevent infinite recursion
    const processedObjects = new WeakSet();

    // Deep clone and sanitize strings
    const sanitize = (value: any, key?: string, parentKey?: string): any => {
      // Prevent infinite recursion
      if (typeof value === 'object' && value !== null) {
        if (processedObjects.has(value)) {
          return value; // Return as-is to prevent infinite recursion
        }
        processedObjects.add(value);
      }

      // Skip sanitization for segment arrays - they contain structured data for template rendering
      if (Array.isArray(value) && value.length > 0 && value[0] && typeof value[0] === 'object' && value[0].kind) {
        // This is a DocSegment array, preserve it as-is
        return value;
      }

      if (typeof value === 'string') {
        // Skip sanitization for:
        // 1. Code/type fields - they're from API Extractor (trusted) and need to preserve <, >, & for TypeScript syntax
        // 2. Page metadata fields - they're used in YAML frontmatter where HTML entities are invalid
        if (key && skipSanitizationKeys.has(key)) {
          return value;
        }
        // Also skip if parent key is 'page' (all page metadata)
        if (parentKey === 'page') {
          return value;
        }

        // Basic HTML escaping for security
        return value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
      if (Array.isArray(value)) {
        return value.map((item) => sanitize(item, key, parentKey));
      }
      if (typeof value === 'object' && value !== null) {
        const sanitized: any = {};
        for (const objKey in value) {
          sanitized[objKey] = sanitize(value[objKey], objKey, key);
        }
        return sanitized;
      }
      return value;
    };

    return sanitize(data) as ITemplateData;
  }

  /**
   * Post-process template output to ensure valid MDX
   */
  private _postProcessOutput(output: string): string {
    // Remove any potentially harmful content
    let processed = output.trim();

    // Remove script tags and javascript: protocols
    processed = processed.replace(/<script[^\u003e]*>[\s\S]*?<\/script\u003e/gi, '');
    processed = processed.replace(/javascript:/gi, '');

    return processed;
  }

  /**
   * Register custom Liquid filters
   */
  private _registerCustomFilters(): void {
    // Add a 'markdown' filter for converting text to markdown
    this._liquid.registerFilter('markdown', (input: string) => {
      // Basic markdown escaping
      return input.replace(/[\`*_{}[\]()#+\-.!]/g, '\\$\u0026');
    });

    // Add a 'kebab_case' filter
    this._liquid.registerFilter('kebab_case', (input: string) => {
      return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    });

    // Add a 'snake_case' filter
    this._liquid.registerFilter('snake_case', (input: string) => {
      return input.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    });

    // Add a 'title_case' filter
    this._liquid.registerFilter('title_case', (input: string) => {
      return input.replace(/([A-Z])/g, ' $1').trim();
    });

    // Add a 'pluralize' filter
    this._liquid.registerFilter('pluralize', (input: string, count: number) => {
      if (count === 1) return input;
      // Simple pluralization rules
      if (input.endsWith('y')) return input.slice(0, -1) + 'ies';
      if (input.endsWith('s') || input.endsWith('x') || input.endsWith('z') || input.endsWith('ch') || input.endsWith('sh')) {
        return input + 'es';
      }
      return input + 's';
    });

    // Add a 'truncate' filter
    this._liquid.registerFilter('truncate', (input: string, length: number = 100, suffix: string = '...') => {
      if (input.length <= length) return input;
      return input.substring(0, length - suffix.length) + suffix;
    });

    // Add a 'is_multiline' filter to check if type has newlines
    this._liquid.registerFilter('is_multiline', (input: string) => {
      return input && input.includes('\n');
    });

    // Add a 'format_type' filter for proper type rendering in MDX
    this._liquid.registerFilter('format_type', (input: string) => {
      if (!input) return '';

      // If type contains newlines or is complex (has curly braces), use code block
      if (input.includes('\n') || (input.includes('{') && input.length > 50)) {
        return `\n\n\`\`\`typescript\n${input}\n\`\`\`\n`;
      }

      // For simple types, return inline code (without backticks - template will add them)
      return input;
    });

    // Add 'render_segments' filter for rendering DocSegment arrays
    this._liquid.registerFilter('render_segments', (segments: DocSegment[] | undefined) => {
      // Handle cases where segments might be a string (fallback)
      if (typeof segments === 'string') {
        return this._escapeHtml(segments);
      }

      if (!segments || !Array.isArray(segments)) {
        return '';
      }

      return segments.map(segment => {
        if (!segment || !segment.kind) {
          return '';
        }

        switch (segment.kind) {
          case DocNodeKind.PlainText:
            return this._escapeHtml(segment.props?.text || '');

          case DocNodeKind.LinkTag:
            const destination = segment.props?.urlDestination || segment.props?.codeDestination;
            const linkText = segment.props?.linkText || destination || 'link';

            // Ensure destination is a string
            if (typeof destination === 'string') {
              if (destination.startsWith('/')) {
                return `<PageLink target="${destination}">${this._escapeHtml(linkText)}</PageLink>`;
              } else if (!destination.startsWith('http')) {
                return `<Link kind="ref" target="${destination}">${this._escapeHtml(linkText)}</Link>`;
              } else {
                return `<Link target="${destination}">${this._escapeHtml(linkText)}</Link>`;
              }
            }
            return this._escapeHtml(linkText);

          case DocNodeKind.CodeSpan:
            return `<code>${this._escapeHtml(segment.props?.code || '')}</code>`;

          case DocNodeKind.SoftBreak:
            return ' ';

          default:
            return segment.props?.text ? this._escapeHtml(segment.props.text) : '';
        }
      }).join('');
    });

    // Add 'render_segment' filter for rendering single DocSegment
    this._liquid.registerFilter('render_segment', (segment: DocSegment | undefined) => {
      if (!segment) return '';

      switch (segment.kind) {
        case DocNodeKind.PlainText:
          return this._escapeHtml(segment.props.text || '');

        case DocNodeKind.LinkTag:
          const destination = segment.props.urlDestination || segment.props.codeDestination;
          const linkText = segment.props.linkText || destination || 'link';

          if (destination && destination.startsWith('/')) {
            return `<PageLink target="${destination}">${this._escapeHtml(linkText)}</PageLink>`;
          } else if (destination && !destination.startsWith('http')) {
            return `<Link kind="ref" target="${destination}">${this._escapeHtml(linkText)}</Link>`;
          } else if (destination) {
            return `<Link target="${destination}">${this._escapeHtml(linkText)}</Link>`;
          }
          return this._escapeHtml(linkText);

        case DocNodeKind.CodeSpan:
          return `<code>${this._escapeHtml(segment.props.code || '')}</code>`;

        default:
          return segment.props.text ? this._escapeHtml(segment.props.text) : '';
      }
    });

    // Add 'type_of' filter for debugging
    this._liquid.registerFilter('type_of', (value: any) => {
      return Array.isArray(value) ? 'array' : typeof value;
    });
  }

  /**
   * Escape HTML characters for safe rendering
   */
  private _escapeHtml(text: any): string {
    // Convert to string if not already a string
    if (typeof text !== 'string') {
      return String(text);
    }

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Clear the template cache
   */
  public clearCache(): void {
    this._templateCache.clear();
  }
}