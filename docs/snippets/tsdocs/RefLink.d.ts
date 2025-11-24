/**
 * Type definitions for RefLink component
 *
 * Provides compile-time type safety for API reference links.
 * The target prop is validated against all valid RefIds at runtime.
 */

import type * as React from 'react';
import type { ValidRefId } from './ValidRefs';

/**
 * RefId represents an API reference identifier from the API model
 * Includes all API items: classes, interfaces, enums, functions, type aliases
 * Also includes nested members: properties, methods, constructors
 *
 * Format: "package-name.ItemName" or "package-name.ItemName.MemberName"
 * Package names use dash-case, other names preserve original casing
 *
 * @example Classes and interfaces
 * "mint-tsdocs.MarkdownDocumenter"
 * "mint-tsdocs.ApiExtractorConfig"
 *
 * @example Enums
 * "mint-tsdocs.ErrorCode"
 *
 * @example Constructors, properties, and methods
 * "mint-tsdocs.ApiModelError.constructor"
 * "mint-tsdocs.ApiExtractorApiReportConfig.enabled"
 * "mint-tsdocs.CacheManager.createProduction"
 */
export type RefId = ValidRefId;

/**
 * Props for the RefLink component
 */
export interface RefLinkProps {
  /**
   * The API reference identifier (RefId)
   * Must be a valid reference that exists in the documentation
   *
   * @example
   * "mint-tsdocs.MarkdownDocumenter"
   * "mint-tsdocs.CacheManager.createProduction"
   * "mint-tsdocs.ApiExtractorApiReportConfig.enabled"
   */
  target: RefId;

  /**
   * Optional children to render as link text
   * If not provided, the target will be used as the link text
   */
  children?: React.ReactNode;
}

/**
 * RefLink component - specialized for API reference links
 *
 * @remarks
 * - Simpler than Link component (no kind attribute needed)
 * - Compile-time type safety ensures target is a valid API reference path
 * - No runtime validation to avoid SSR issues
 * - Automatically converts RefId to nested folder path
 * - Supports all API items: classes, interfaces, enums, functions, type aliases
 * - Supports nested references: properties, methods, constructors
 * - RefId format: "package.Class.member" → Path: "./package/Class/member"
 *
 * @example Package reference
 * <RefLink target="mint-tsdocs">mint-tsdocs Package</RefLink>
 * // Resolves to: ./mint-tsdocs
 *
 * @example Class reference
 * <RefLink target="mint-tsdocs.MarkdownDocumenter">Documenter</RefLink>
 * // Resolves to: ./mint-tsdocs/MarkdownDocumenter
 *
 * @example Method reference
 * <RefLink target="mint-tsdocs.MarkdownDocumenter.generateFiles">Generate Files</RefLink>
 * // Resolves to: ./mint-tsdocs/MarkdownDocumenter/generateFiles
 *
 * @example Property reference
 * <RefLink target="mint-tsdocs.ApiExtractorApiReportConfig.enabled">Report Enabled</RefLink>
 * // Resolves to: ./mint-tsdocs/ApiExtractorApiReportConfig/enabled
 */
export const RefLink: React.FC<RefLinkProps>;
