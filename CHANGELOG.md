# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.5] - 2025-11-24

### Fixed

- **CRITICAL: Cache Key Collisions (ApiResolutionCache)** - Eliminated cache collisions that caused wrong data to be returned
  - Replaced unreliable `toString()` based key generation with proper object serialization
  - Cache keys now include packageName, memberReferences, and structural data for uniqueness
  - Fixed bug where different API references with identical `toString()` output would share cache entries
  - Added comprehensive collision tests to prevent regression

- **CRITICAL: Global State Corruption (CacheManager)** - Fixed silent configuration failures in global cache
  - `getGlobalCacheManager()` now throws explicit error when attempting reconfiguration
  - Prevents unpredictable behavior where first module to import determines app-wide cache config
  - Added clear error message directing users to either reset global cache or create new instance
  - Eliminates hours of debugging silent configuration overrides

- **CRITICAL: Security Validation Gaps (SecurityUtils)** - Fixed path traversal and command injection vulnerabilities
  - Corrected validation order to check dangerous patterns BEFORE `path.basename()` strips them
  - Now properly rejects path traversal attempts like `../../../passwd`
  - Fixed detection of shell redirection operators (`>`, `<`) in CLI input
  - Properly blocks absolute paths that could access sensitive system files

### Added

- **Comprehensive Test Suite** - Established complete testing infrastructure with 197 tests
  - Added Vitest 4.0 as test framework with coverage support and interactive UI
  - Created 115 tests for cache module (CacheManager, TypeAnalysisCache, ApiResolutionCache)
  - Created 67 tests for SecurityUtils covering all validation functions
  - Created 15 tests for CLI path validation
  - All tests passing with 100% pass rate
  - Tests document both correct behavior and edge cases

- **Test Infrastructure**
  - `vitest.config.ts` - Comprehensive Vitest configuration with coverage thresholds
  - `test/setup.ts` - Global test setup with cache isolation
  - `test/helpers/fixtures.ts` - Reusable test data and sample inputs
  - `test/helpers/mocks.ts` - Mock utilities for ApiItem, DeclarationReference, etc.
  - `test/helpers/assertions.ts` - Custom assertions for validating output

- **Documentation**
  - `docs/testing/TEST_PLAN.md` - Comprehensive testing strategy and test cases
  - `docs/testing/TEST_SETUP_SUMMARY.md` - Complete test setup documentation
  - `agent/reports/review/fixes/cache-fixes-summary.md` - Detailed fix documentation
  - Updated `CLAUDE.md` with accurate testing information

### Changed

- **Mock Test Helpers** - Improved mock uniqueness to reflect actual object behavior
  - `createMockApiItem()` now generates unique `canonicalReference.toString()` values
  - Ensures mocks accurately represent production behavior for better test reliability

- **Package Scripts** - Added test commands to package.json
  - `test` - Run all tests once
  - `test:watch` - Run tests in watch mode
  - `test:coverage` - Generate coverage report
  - `test:ui` - Open interactive test UI

### Internal

- Enhanced cache key generation algorithm with multiple discriminators
- Improved error messages throughout cache module
- Added validation for cache configuration options
- Better separation of test concerns with dedicated helper modules
- Established patterns for future test development

---

## [0.0.4] - 2025-11-22

### Added

- **TypeInfo Generation System** - Auto-generates `TypeInfo.jsx` containing structured type information for all API items
  - Provides TypeTree-compatible data with IDE autocomplete support
  - Includes TypeScript declaration file (`TypeInfo.d.ts`) for VSCode IntelliSense
  - Enables documentation authors to reference type information programmatically in MDX files
  - Supports nested property analysis for complex object types

- **Link Components with Dual Validation** - RefLink and PageLink components now provide both compile-time and runtime link validation
  - **Compile-time safety**: Auto-generates `ValidRefs.d.ts` and `ValidPages.d.ts` with TypeScript union types
  - **Runtime validation**: Checks links against generated Sets and highlights broken links with `broken-link` CSS class
  - **IDE autocomplete**: Type-safe target selection with IntelliSense
  - **Visual feedback**: Invalid links display with title tooltip and CSS class for custom styling
  - **SSR-safe**: Validation only runs client-side, gracefully handles server-side rendering
  - Helps documentation authors catch broken links immediately during development

- **Preview Component** - New `Preview.jsx` component for showcasing documentation examples
  - Bordered container with customizable title header
  - Dark mode support with Tailwind CSS theming
  - Code block aesthetic styling
  - Ideal for wrapping TypeTree and other component demonstrations

- **Doc Section Converter** - New `DocSectionConverter` utility for converting TSDoc nodes to template-friendly segments
  - Converts TSDoc `DocSection` nodes to structured segments
  - Preserves code blocks, links, and formatting
  - Supports customizable conversion options (flatten paragraphs, preserve code blocks, etc.)
  - Enables flexible template rendering of TSDoc content

- **Rendering Configuration** - New rendering options in template configuration
  - `hideStringEnumValues` option to control enum value visibility in documentation
  - Configurable via `templates.rendering` in `mint-tsdocs.config.json`
  - Defaults to `true` for cleaner enum documentation

- **CLI Enhancements**
  - Added `--project-dir` parameter to `generate` command for specifying project location
  - Support for positional project directory argument
  - Improved help documentation with usage examples
  - Better error messages and user feedback
  - **New `coverage` command** - Calculate TSDocs coverage with filtering, grouping, and threshold support
  - **New `lint` command** - Check documentation quality and find issues

### Changed

- **MDX Language Server Support** - Now generates `tsconfig.json` instead of `jsconfig.json` in snippet folders
  - Provides better TypeScript language server support for MDX files
  - Improves IDE autocomplete and type checking in documentation
  - Maintains backward compatibility

- **Template Data Converter** - Enhanced with API model awareness for better cross-referencing
  - Constructor now accepts `ApiModel` and `LinkValidator` parameters
  - Improved handling of type references between API items
  - Better path resolution for nested items

- **Template System Updates**
  - `LiquidTemplateManager` now accepts `apiModel` and `linkValidator` options
  - Improved template data structure with rendering configuration
  - Better support for complex type rendering
  - Enhanced cross-reference generation in templates

- **Cache System Improvements**
  - Added statistics tracking to `ApiResolutionCache`
  - Added statistics tracking to `TypeAnalysisCache`
  - Better debugging output for cache performance
  - Improved cache manager with global instance support

- **Navigation Generation**
  - Improved hierarchical navigation structure
  - Better parent-child relationship tracking
  - Fixed navigation for nested API items
  - Skips EntryPoint items to avoid unnecessary navigation entries

- **Documentation Structure**
  - Enum members are now rendered within parent enum file (no separate pages)
  - EntryPoint items no longer generate separate documentation pages
  - Improved folder structure with proper nesting for child items

### Fixed

- **React Component Issues**
  - Fixed React hooks destructuring to use global React object
  - Removed unnecessary React imports from snippet files
  - Components now properly work in Mintlify's MDX environment

- **TypeScript Configuration** - Fixed MDX language server configuration for better IDE support

### Internal

- Added `DocSectionConverter.ts` for structured TSDoc conversion
- Added `TypeInfoGenerator.ts` for automated type information generation
- Added `LinkValidator.ts` for link path resolution and RefId generation
- Enhanced error handling throughout the codebase
- Improved type safety with stricter TypeScript configuration
- Better separation of concerns in documentation generation pipeline
- Improved JSDoc comments and inline documentation

---

## [0.0.3] - 2024-11-20

### Added

- First public release
- Core documentation generation from TypeScript API Extractor models
- Mintlify-compatible MDX output with frontmatter
- LiquidJS-based template system with customization support
- Navigation integration with `docs.json`
- Custom TSDoc nodes for tables, headings, note boxes, and expandables
- Caching system for type analysis and API resolution
- Security utilities for input sanitization
- Comprehensive error handling with `DocumentationError` and `ErrorBoundary`
- CLI with `init`, `generate`, and `customize` commands
- TypeTree component for rendering type hierarchies
- Configuration via `mint-tsdocs.config.json` with cosmiconfig support

### Features

- Automatic API Extractor configuration generation
- TSDoc configuration generation
- Support for custom templates and overrides
- README.md conversion to MDX
- Icon selection based on API item kind
- Breadcrumb generation for navigation
- Cross-references between API items
- Type analysis with property extraction
- Performance monitoring and statistics

---

## Previous Versions

See Git history for changes prior to 0.0.3.

[0.0.5]: https://github.com/svallory/mintlify-tsdocs/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/svallory/mintlify-tsdocs/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/svallory/mintlify-tsdocs/releases/tag/v0.0.3
