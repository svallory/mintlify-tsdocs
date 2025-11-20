import { ApiModel, ApiItem, ApiItemKind, ApiDocumentedItem } from '@microsoft/api-extractor-model';
import { FileSystem } from '@rushstack/node-core-library';
import * as path from 'path';

/**
 * Coverage statistics for a single API item type
 */
export interface TypeCoverageStats {
  total: number;
  documented: number;
  undocumented: number;
  coveragePercent: number;
}

/**
 * Statistics about the API surface area with per-type coverage
 */
export interface ApiSurfaceStats {
  classes: TypeCoverageStats;
  interfaces: TypeCoverageStats;
  functions: TypeCoverageStats;
  typeAliases: TypeCoverageStats;
  variables: TypeCoverageStats;
  enums: TypeCoverageStats;
  namespaces: TypeCoverageStats;
  methods: TypeCoverageStats;
  properties: TypeCoverageStats;
}

/**
 * Overall documentation coverage statistics
 */
export interface DocumentationCoverageStats {
  documented: number;
  undocumented: number;
  withExamples: number;
  withRemarks: number;
  total: number;
  coveragePercent: number;
}

/**
 * Statistics about generated documentation files
 */
export interface GeneratedFilesStats {
  mdxFiles: number;
  totalSize: number;
  averageSize: number;
}

/**
 * Complete documentation statistics
 */
export interface DocumentationStatistics {
  apiSurface: ApiSurfaceStats;
  coverage: DocumentationCoverageStats;
  generatedFiles: GeneratedFilesStats;
  projectName?: string;
}

/**
 * Utility class for collecting documentation statistics
 */
export class DocumentationStats {
  /**
   * Collect statistics from an API model
   */
  public static collectFromApiModel(apiModel: ApiModel): DocumentationStatistics {
    // Helper to create empty stats
    const createEmptyStats = (): TypeCoverageStats => ({
      total: 0,
      documented: 0,
      undocumented: 0,
      coveragePercent: 0
    });

    const apiSurface: ApiSurfaceStats = {
      classes: createEmptyStats(),
      interfaces: createEmptyStats(),
      functions: createEmptyStats(),
      typeAliases: createEmptyStats(),
      variables: createEmptyStats(),
      enums: createEmptyStats(),
      namespaces: createEmptyStats(),
      methods: createEmptyStats(),
      properties: createEmptyStats()
    };

    const coverage = {
      documented: 0,
      undocumented: 0,
      withExamples: 0,
      withRemarks: 0,
      total: 0,
      coveragePercent: 0
    };

    let projectName: string | undefined;

    // Get project name from first package
    const packages = apiModel.packages;
    if (packages.length > 0) {
      projectName = packages[0].name;
    }

    // Recursively count API items
    const countApiItems = (item: ApiItem): void => {
      // Helper to check if item is documented
      const isDocumented = (apiItem: ApiItem): boolean => {
        if (!(apiItem instanceof ApiDocumentedItem)) return false;
        const tsdocComment = apiItem.tsdocComment;
        if (!tsdocComment) return false;
        const summarySection = tsdocComment.summarySection;
        return !!(summarySection && summarySection.nodes.length > 0);
      };

      // Get the stats object for this item type
      let typeStats: TypeCoverageStats | null = null;

      switch (item.kind) {
        case ApiItemKind.Class:
          typeStats = apiSurface.classes;
          break;
        case ApiItemKind.Interface:
          typeStats = apiSurface.interfaces;
          break;
        case ApiItemKind.Function:
          typeStats = apiSurface.functions;
          break;
        case ApiItemKind.TypeAlias:
          typeStats = apiSurface.typeAliases;
          break;
        case ApiItemKind.Variable:
          typeStats = apiSurface.variables;
          break;
        case ApiItemKind.Enum:
          typeStats = apiSurface.enums;
          break;
        case ApiItemKind.Namespace:
          typeStats = apiSurface.namespaces;
          break;
        case ApiItemKind.Method:
        case ApiItemKind.MethodSignature:
        case ApiItemKind.Constructor:
          typeStats = apiSurface.methods;
          break;
        case ApiItemKind.Property:
        case ApiItemKind.PropertySignature:
          typeStats = apiSurface.properties;
          break;
      }

      // Update type-specific stats
      if (typeStats && item instanceof ApiDocumentedItem) {
        typeStats.total++;
        if (isDocumented(item)) {
          typeStats.documented++;
        } else {
          typeStats.undocumented++;
        }
      }

      // Check documentation coverage for overall stats
      if (item instanceof ApiDocumentedItem) {
        coverage.total++;

        const tsdocComment = item.tsdocComment;
        if (tsdocComment) {
          // Check if has summary
          const summarySection = tsdocComment.summarySection;
          if (summarySection && summarySection.nodes.length > 0) {
            coverage.documented++;
          } else {
            coverage.undocumented++;
          }

          // Check for examples
          const exampleBlocks = tsdocComment.customBlocks.filter(
            block => block.blockTag.tagName === '@example'
          );
          if (exampleBlocks.length > 0) {
            coverage.withExamples++;
          }

          // Check for remarks
          if (tsdocComment.remarksBlock) {
            coverage.withRemarks++;
          }
        } else {
          coverage.undocumented++;
        }
      }

      // Recurse into members
      if ('members' in item) {
        for (const member of (item as any).members) {
          countApiItems(member);
        }
      }
    };

    // Process all packages
    for (const apiPackage of packages) {
      for (const entryPoint of apiPackage.entryPoints) {
        for (const member of entryPoint.members) {
          countApiItems(member);
        }
      }
    }

    // Calculate coverage percentage for each type
    const calculateCoveragePercent = (stats: TypeCoverageStats): void => {
      if (stats.total > 0) {
        stats.coveragePercent = Math.round((stats.documented / stats.total) * 100);
      }
    };

    calculateCoveragePercent(apiSurface.classes);
    calculateCoveragePercent(apiSurface.interfaces);
    calculateCoveragePercent(apiSurface.functions);
    calculateCoveragePercent(apiSurface.typeAliases);
    calculateCoveragePercent(apiSurface.variables);
    calculateCoveragePercent(apiSurface.enums);
    calculateCoveragePercent(apiSurface.namespaces);
    calculateCoveragePercent(apiSurface.methods);
    calculateCoveragePercent(apiSurface.properties);

    // Calculate overall coverage percentage
    if (coverage.total > 0) {
      coverage.coveragePercent = Math.round((coverage.documented / coverage.total) * 100);
    }

    return {
      apiSurface,
      coverage,
      generatedFiles: {
        mdxFiles: 0,
        totalSize: 0,
        averageSize: 0
      },
      projectName
    };
  }

  /**
   * Collect statistics about generated files
   */
  public static collectGeneratedFilesStats(outputFolder: string): GeneratedFilesStats {
    const stats: GeneratedFilesStats = {
      mdxFiles: 0,
      totalSize: 0,
      averageSize: 0
    };

    if (!FileSystem.exists(outputFolder)) {
      return stats;
    }

    // Find all .mdx files
    const files = FileSystem.readFolderItemNames(outputFolder);
    const mdxFiles = files.filter((file: string) => file.endsWith('.mdx'));

    stats.mdxFiles = mdxFiles.length;

    // Calculate total size
    for (const file of mdxFiles) {
      const filePath = path.join(outputFolder, file);
      const fileStats = FileSystem.getStatistics(filePath);
      stats.totalSize += fileStats.size;
    }

    // Calculate average size
    if (stats.mdxFiles > 0) {
      stats.averageSize = Math.round(stats.totalSize / stats.mdxFiles);
    }

    return stats;
  }

  /**
   * Collect complete statistics
   */
  public static collectStats(apiModel: ApiModel, outputFolder: string): DocumentationStatistics {
    const stats = this.collectFromApiModel(apiModel);
    stats.generatedFiles = this.collectGeneratedFilesStats(outputFolder);
    return stats;
  }

  /**
   * Format file size in human-readable format
   */
  public static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Calculate total stats across all API surface types
   */
  public static getTotalStats(apiSurface: ApiSurfaceStats): TypeCoverageStats {
    const total: TypeCoverageStats = {
      total: 0,
      documented: 0,
      undocumented: 0,
      coveragePercent: 0
    };

    const types: Array<TypeCoverageStats> = [
      apiSurface.classes,
      apiSurface.interfaces,
      apiSurface.functions,
      apiSurface.typeAliases,
      apiSurface.variables,
      apiSurface.enums,
      apiSurface.namespaces,
      apiSurface.methods,
      apiSurface.properties
    ];

    for (const typeStats of types) {
      total.total += typeStats.total;
      total.documented += typeStats.documented;
      total.undocumented += typeStats.undocumented;
    }

    if (total.total > 0) {
      total.coveragePercent = Math.round((total.documented / total.total) * 100);
    }

    return total;
  }
}
