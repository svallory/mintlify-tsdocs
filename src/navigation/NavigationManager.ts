/**
 * Navigation management for Mintlify documentation sites.
 * Handles docs.json structure, navigation generation, and hierarchical organization.
 */

import { FileSystem } from '@rushstack/node-core-library';
import { ApiItemKind } from '@microsoft/api-extractor-model';
import * as path from 'path';
import * as clack from '@clack/prompts';
import { SecurityUtils } from '../utils/SecurityUtils';
import { DocumentationError, ErrorCode, ValidationError } from '../errors/DocumentationError';
import { createDebugger, type Debugger } from '../utils/debug';
import { Utilities } from '../utils/Utilities';

const debug: Debugger = createDebugger('navigation-manager');

/**
 * Navigation item interface for Mintlify docs.json structure
 */
export interface NavigationItem {
  group?: string;
  pages?: Array<string | NavigationItem>;
  icon?: string;
  page?: string;
  apiKind?: ApiItemKind;
  parentPage?: string; // Parent page for member items (methods, properties, etc.)
  displayName?: string; // Display name for the item
}

/**
 * Mintlify docs.json structure interface
 */
export interface DocsJsonStructure {
  navigation?: NavigationItem[] | {
    tabs: Array<{
      tab: string;
      groups: NavigationItem[];
    }>;
  };
  [key: string]: any; // Allow other Mintlify properties
}

/**
 * Configuration options for navigation manager
 */
export interface NavigationManagerOptions {
  /**
   * Path to the docs.json file
   */
  docsJsonPath?: string;

  /**
   * Tab name in Mintlify navigation (default: "Code Reference")
   */
  tabName?: string;

  /**
   * Group name within the tab
   */
  groupName?: string;

  /**
   * Enable menu for the group in navigation
   */
  enableMenu?: boolean;

  /**
   * Output folder path for path calculations
   */
  outputFolder?: string;

  /**
   * Maximum size for docs.json file in bytes (default: 10MB)
   */
  maxDocsJsonSize?: number;

  /**
   * Custom icon mappings for API item types
   */
  customIcons?: Record<ApiItemKind, { displayName: string; icon: string }>;
}

/**
 * Manages Mintlify navigation structure including docs.json updates and hierarchical organization
 *
 * @see /architecture/navigation-layer - Navigation architecture details
 */
export class NavigationManager {
  private readonly _docsJsonPath: string;
  private readonly _tabName: string;
  private readonly _groupName: string;
  private readonly _enableMenu: boolean;
  private readonly _outputFolder: string;
  private readonly _maxDocsJsonSize: number;
  private readonly _customIcons?: Record<ApiItemKind, { displayName: string; icon: string }>;
  private readonly _navigationItems: NavigationItem[] = [];
  private readonly _navigationItemKeys = new Set<string>(); // For O(1) duplicate detection

  /**
   * Category display names and icon mapping for different API item types
   */
  private static readonly CATEGORY_INFO: Record<string, { displayName: string; icon: string }> = {
    [ApiItemKind.Class]: { displayName: 'Classes', icon: 'box' },
    [ApiItemKind.Interface]: { displayName: 'Interfaces', icon: 'plug' },
    [ApiItemKind.Function]: { displayName: 'Functions', icon: 'function' },
    [ApiItemKind.TypeAlias]: { displayName: 'Types', icon: 'file-code' },
    [ApiItemKind.Variable]: { displayName: 'Variables', icon: 'variable' },
    [ApiItemKind.Enum]: { displayName: 'Enums', icon: 'list' },
    [ApiItemKind.Namespace]: { displayName: 'Namespaces', icon: 'folder' }
  };

  constructor(options: NavigationManagerOptions = {}) {
    this._docsJsonPath = options.docsJsonPath || '';
    this._tabName = options.tabName || 'API Reference';
    this._groupName = options.groupName || '';
    this._enableMenu = options.enableMenu || false;
    this._outputFolder = options.outputFolder || '';
    this._maxDocsJsonSize = options.maxDocsJsonSize || 10 * 1024 * 1024; // 10MB default
    this._customIcons = options.customIcons;
  }

  /**
   * Add a navigation item to the manager
   */
  public addNavigationItem(item: NavigationItem): void {
    // Prevent duplicate entries using O(1) Set lookup
    const key = `${item.page}:${item.group || ''}`;
    if (!this._navigationItemKeys.has(key)) {
      this._navigationItems.push(item);
      this._navigationItemKeys.add(key);
    }
  }

  /**
   * Add an API item to navigation with automatic categorization
   * @param apiItem - The API item to add
   * @param filename - The filename of the generated page
   * @param parentFilename - Optional parent filename for member items
   */
  public addApiItem(apiItem: any, filename: string, parentFilename?: string): void {
    try {
      // Calculate relative path from docs.json to the output file
      const docsJsonDir = path.dirname(this._docsJsonPath);
      const fullOutputPath = path.resolve(this._outputFolder, filename);
      const relativePath = path.relative(docsJsonDir, fullOutputPath);
      let normalizedPath = relativePath.replace(/\\/g, '/'); // Normalize path separators

      // Remove .mdx extension for Mintlify (Mintlify expects paths without extensions)
      normalizedPath = normalizedPath.replace(/\.mdx$/, '');

      const navigationItem: NavigationItem = {
        page: normalizedPath,
        apiKind: apiItem.kind,
        displayName: Utilities.normalizeDisplayName(apiItem.displayName)
      };

      // Track parent relationship for member items
      if (parentFilename) {
        const parentFullPath = path.resolve(this._outputFolder, parentFilename);
        const parentRelativePath = path.relative(docsJsonDir, parentFullPath);
        navigationItem.parentPage = parentRelativePath.replace(/\\/g, '/').replace(/\.mdx$/, '');
      }

      this.addNavigationItem(navigationItem);
    } catch (error) {
      throw new DocumentationError(
        `Failed to add API item to navigation: ${apiItem.displayName}`,
        ErrorCode.NAVIGATION_ERROR,
        {
          resource: apiItem.displayName,
          operation: 'addApiItem',
          cause: error instanceof Error ? error : new Error(String(error))
        }
      );
    }
  }

  /**
   * Generate and write navigation to docs.json file
   */
  public async generateNavigation(): Promise<void> {
    if (!this._docsJsonPath || this._navigationItems.length === 0) {
      return;
    }

    debug.info(`📋 Generating navigation in ${this._docsJsonPath}...`);

    try {
      // Resolve to absolute path (allow parent directories in monorepo context)
      const validatedDocsJsonPath = path.resolve(process.cwd(), this._docsJsonPath);

      // Read existing docs.json if it exists
      let docsJson: DocsJsonStructure = {};
      try {
        if (FileSystem.exists(validatedDocsJsonPath)) {
          const existingContent = FileSystem.readFile(validatedDocsJsonPath);
          // docs.json is user-controlled navigation config that may legitimately contain
          // security-related terms in page titles/descriptions (e.g., "Prototype Pollution Prevention")
          SecurityUtils.validateJsonContent(existingContent, { skipPatternCheck: true });
          docsJson = JSON.parse(existingContent);
        }
      } catch (error) {
        // File doesn't exist or is invalid, start with empty object
        if (FileSystem.exists(validatedDocsJsonPath)) {
          debug.warn(`⚠️  Could not read existing docs.json: ${error instanceof Error ? error.message : String(error)}`);
          debug.info('   Starting with empty docs.json structure...');
        } else {
          debug.info('   Creating new docs.json file...');
        }
      }

      // Generate navigation structure
      this._updateDocsJsonNavigation(docsJson);

      // Ensure scripts section exists for link validation
      this._ensureScriptsSection(docsJson);

      // Ensure styles section exists for TSDocs styles
      this._ensureStylesSection(docsJson);

      // Validate docs.json structure
      this._validateDocsJsonStructure(docsJson);

      // Validate and write the updated docs.json
      const jsonString = JSON.stringify(docsJson, null, 2);

      if (jsonString.length > this._maxDocsJsonSize) {
        throw new ValidationError(
          `Generated docs.json exceeds maximum size of ${this._maxDocsJsonSize} bytes`,
          { resource: this._docsJsonPath, operation: 'validateDocsJsonSize', data: { size: jsonString.length, maxSize: this._maxDocsJsonSize } }
        );
      }

      SecurityUtils.validateJsonContent(jsonString);

      // Ensure output directory exists
      const docsJsonDir = path.dirname(validatedDocsJsonPath);
      FileSystem.ensureFolder(docsJsonDir);

      // Create backup before overwriting
      if (FileSystem.exists(validatedDocsJsonPath)) {
        const backupPath = `${validatedDocsJsonPath}.backup`;
        FileSystem.copyFile({
          sourcePath: validatedDocsJsonPath,
          destinationPath: backupPath
        });
        debug.info(`   Created backup: ${backupPath}`);
      }

      // Write updated docs.json
      FileSystem.writeFile(validatedDocsJsonPath, jsonString);

      debug.info(`   ✓ Generated navigation for ${this._navigationItems.length} pages`);
      clack.log.success('Mintlify docs.json updated');
    } catch (error) {
      if (error instanceof DocumentationError) {
        throw error;
      }
      throw new DocumentationError(
        `Failed to generate navigation: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.NAVIGATION_ERROR,
        {
          resource: this._docsJsonPath,
          operation: 'generateNavigation',
          cause: error instanceof Error ? error : new Error(String(error)),
          suggestion: 'Check file permissions and ensure the docs.json path is correct'
        }
      );
    }
  }

  /**
   * Generate hierarchical navigation structure with categories
   */
  public generateHierarchicalNavigation(): any[] {
    if (this._groupName) {
      // Generate the hierarchical structure using default logic
      const hierarchicalGroups = this._generateDefaultHierarchicalNavigation();

      return [{
        group: this._groupName,
        icon: this._enableMenu ? 'code' : undefined,
        pages: hierarchicalGroups
      }];
    } else {
      // Return flat navigation if no group name specified
      return this._navigationItems.map(item => item.page);
    }
  }

  /**
   * Get navigation statistics
   */
  public getStats(): { totalItems: number; hasHierarchical: boolean; tabName: string; groupName: string; docsJsonPath: string } {
    return {
      totalItems: this._navigationItems.length,
      hasHierarchical: this._groupName !== '',
      tabName: this._tabName,
      groupName: this._groupName,
      docsJsonPath: this._docsJsonPath
    };
  }

  /**
   * Clear all navigation items
   */
  public clear(): void {
    this._navigationItems.length = 0;
    this._navigationItemKeys.clear();
  }

  /**
   * Validate docs.json structure against Mintlify schema
   */
  private _validateDocsJsonStructure(docsJson: DocsJsonStructure): void {
    // Basic validation for navigation structure
    if (docsJson.navigation !== undefined) {
      if (Array.isArray(docsJson.navigation)) {
        // Simple navigation array
        for (const item of docsJson.navigation) {
          if (typeof item === 'object' && item !== null) {
            if (item.group && typeof item.group !== 'string') {
              throw new ValidationError(
                'Invalid docs.json structure: group must be a string',
                { resource: this._docsJsonPath, operation: 'validateDocsJsonStructure' }
              );
            }
            if (item.pages && !Array.isArray(item.pages)) {
              throw new ValidationError(
                'Invalid docs.json structure: pages must be an array',
                { resource: this._docsJsonPath, operation: 'validateDocsJsonStructure' }
              );
            }
          }
        }
      } else if (typeof docsJson.navigation === 'object' && docsJson.navigation.tabs) {
        // Tabbed navigation structure
        if (!Array.isArray(docsJson.navigation.tabs)) {
          throw new ValidationError(
            'Invalid docs.json structure: navigation.tabs must be an array',
            { resource: this._docsJsonPath, operation: 'validateDocsJsonStructure' }
          );
        }
        for (const tab of docsJson.navigation.tabs) {
          if (typeof tab.tab !== 'string') {
            throw new ValidationError(
              'Invalid docs.json structure: tab.tab must be a string',
              { resource: this._docsJsonPath, operation: 'validateDocsJsonStructure' }
            );
          }
          if (tab.groups && !Array.isArray(tab.groups)) {
            throw new ValidationError(
              'Invalid docs.json structure: tab.groups must be an array',
              { resource: this._docsJsonPath, operation: 'validateDocsJsonStructure' }
            );
          }
        }
      }
    }
  }

  /**
   * Update docs.json navigation structure
   */
  private _updateDocsJsonNavigation(docsJson: DocsJsonStructure): void {
    // Handle different docs.json structures
    if (docsJson.navigation && typeof docsJson.navigation === 'object' && 'tabs' in docsJson.navigation) {
      // Mintlify v4 structure with tabs
      this._updateTabStructure(docsJson);
    } else {
      // Simple navigation array structure
      this._updateSimpleStructure(docsJson);
    }
  }

  /**
   * Update Mintlify v4 tab structure
   */
  private _updateTabStructure(docsJson: DocsJsonStructure): void {
    if (!docsJson.navigation) {
      docsJson.navigation = { tabs: [] };
    }

    const navigation = docsJson.navigation as { tabs: Array<{ tab: string; groups: NavigationItem[] }> };

    if (!Array.isArray(navigation.tabs)) {
      navigation.tabs = [];
    }

    // Find existing tab or create new one
    let existingTab = navigation.tabs.find((tab: any) =>
      tab.tab === this._tabName
    );

    if (!existingTab) {
      existingTab = {
        tab: this._tabName,
        groups: []
      };
      navigation.tabs.push(existingTab);
    }

    // Merge hierarchical navigation with existing groups
    const newGroups = this.generateHierarchicalNavigation();

    // Update or add groups
    for (const newGroup of newGroups) {
      const groupIndex = existingTab!.groups.findIndex((group: any) =>
        group.group === newGroup.group
      );

      if (groupIndex >= 0) {
        existingTab!.groups[groupIndex] = newGroup;
        debug.info(`   ✓ Updated existing "${newGroup.group}" group`);
      } else {
        existingTab!.groups.push(newGroup);
        debug.info(`   ✓ Added new "${newGroup.group}" group`);
      }
    }
  }

  /**
   * Update simple navigation array structure
   */
  private _updateSimpleStructure(docsJson: DocsJsonStructure): void {
    if (!docsJson.navigation) {
      docsJson.navigation = [];
    }

    if (!Array.isArray(docsJson.navigation)) {
      docsJson.navigation = [];
    }

    // Find or create our group
    let groupIndex = -1;
    if (this._groupName) {
      groupIndex = docsJson.navigation.findIndex((item: any) =>
        item.group === this._groupName
      );
    }

    const groupEntry = {
      group: this._groupName || 'API Reference',
      icon: this._enableMenu ? 'code' : undefined,
      pages: this.generateHierarchicalNavigation()
    };

    if (groupIndex >= 0) {
      docsJson.navigation[groupIndex] = groupEntry;
      debug.info(`   ✓ Updated existing "${this._groupName}" group`);
    } else {
      docsJson.navigation.push(groupEntry);
      debug.info(`   ✓ Added new "${this._groupName}" group`);
    }
  }

  /**
   * Ensure scripts section exists in docs.json for TSDocs runtime components
   * Adds tsdocs-config.js, ValidRefs.js, and ValidPages.js if not already present
   */
  private _ensureScriptsSection(docsJson: DocsJsonStructure): void {
    const requiredScripts = [
      '/.tsdocs/client/tsdocs-config.js',
      '/.tsdocs/client/ValidRefs.js',
      '/.tsdocs/client/ValidPages.js'
    ];

    // Initialize scripts array if it doesn't exist
    if (!docsJson.scripts) {
      docsJson.scripts = [];
      debug.info('   ✓ Created scripts section in docs.json');
    }

    if (!Array.isArray(docsJson.scripts)) {
      debug.warn('   ⚠️  scripts field exists but is not an array, replacing with array');
      docsJson.scripts = [];
    }

    // Add each required script if not already present
    let addedCount = 0;
    for (const script of requiredScripts) {
      if (!docsJson.scripts.includes(script)) {
        docsJson.scripts.push(script);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      debug.info(`   ✓ Added ${addedCount} TSDocs scripts to docs.json`);
    } else {
      debug.info('   ✓ All TSDocs scripts already present in docs.json');
    }
  }

  /**
   * Ensure styles section exists in docs.json for TSDocs CSS
   * Adds tsdocs-styles.css if not already present
   */
  private _ensureStylesSection(docsJson: DocsJsonStructure): void {
    const requiredStyles = [
      '/.tsdocs/client/tsdocs-styles.css'
    ];

    // Initialize styles array if it doesn't exist
    if (!docsJson.styles) {
      docsJson.styles = [];
      debug.info('   ✓ Created styles section in docs.json');
    }

    if (!Array.isArray(docsJson.styles)) {
      debug.warn('   ⚠️  styles field exists but is not an array, replacing with array');
      docsJson.styles = [];
    }

    // Add each required style if not already present
    let addedCount = 0;
    for (const style of requiredStyles) {
      if (!docsJson.styles.includes(style)) {
        docsJson.styles.push(style);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      debug.info(`   ✓ Added ${addedCount} TSDocs styles to docs.json`);
    } else {
      debug.info('   ✓ All TSDocs styles already present in docs.json');
    }
  }

  /**
   * Generate default hierarchical navigation grouped by API item types with nested members
   */
  private _generateDefaultHierarchicalNavigation(): any[] {
    // Separate top-level items from member items
    const topLevelItems: NavigationItem[] = [];
    const memberItems: NavigationItem[] = [];

    for (const item of this._navigationItems) {
      if (item.parentPage) {
        memberItems.push(item);
      } else {
        topLevelItems.push(item);
      }
    }

    // Group top-level items by category
    const groups = new Map<string, NavigationItem[]>();

    for (const item of topLevelItems) {
      if (item.apiKind) {
        const categoryInfo = (this._customIcons ? this._customIcons[item.apiKind] : undefined) ||
          NavigationManager.CATEGORY_INFO[item.apiKind] ||
          { displayName: 'Miscellaneous', icon: 'file-text' };

        if (!groups.has(categoryInfo.displayName)) {
          groups.set(categoryInfo.displayName, []);
        }

        groups.get(categoryInfo.displayName)!.push(item);
      }
    }

    // Build hierarchical structure with nested members
    const result: any[] = [];
    for (const [groupName, items] of groups) {
      const categoryInfo = Object.values(NavigationManager.CATEGORY_INFO).find(
        cat => cat.displayName === groupName
      ) || { displayName: groupName, icon: 'file-text' };

      const pages: any[] = [];

      // Sort items by display name
      const sortedItems = items.sort((a, b) =>
        (a.displayName || '').localeCompare(b.displayName || '')
      );

      for (const item of sortedItems) {
        // Find members for this parent
        const children = memberItems.filter(m => m.parentPage === item.page);

        if (children.length > 0) {
          // Create nested group for item with members
          const memberPages = children
            .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
            .map(m => m.page!);

          pages.push({
            group: item.displayName || 'Unknown',
            pages: [
              item.page, // Parent page first
              ...memberPages // Then all member pages
            ]
          });
        } else {
          // No members, just add the page directly
          pages.push(item.page!);
        }
      }

      result.push({
        group: groupName,
        icon: categoryInfo.icon,
        pages: pages
      });
    }

    // Sort groups by display name
    return result.sort((a, b) => a.group.localeCompare(b.group));
  }

  /**
   * Determine if an API item should be included in top-level navigation
   */
  private _isTopLevelItem(apiItem: any): boolean {
    return [
      ApiItemKind.Class,
      ApiItemKind.Interface,
      ApiItemKind.Enum,
      ApiItemKind.Namespace,
      ApiItemKind.Function,
      ApiItemKind.TypeAlias,
      ApiItemKind.Variable
    ].includes(apiItem.kind);
  }
}