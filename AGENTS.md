# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**mintlify-tsdocs** generates Mintlify-compatible MDX documentation from TypeScript API documentation. It reads `*.api.json` files produced by [API Extractor](https://api-extractor.com/) and converts them to MDX files with proper frontmatter, navigation integration, and Mintlify-specific components.

## Commands

### Build & Development
```bash
# Build TypeScript to JavaScript
bun run build

# Clean build artifacts
bun run clean

# Clean and rebuild
bun run rebuild

# Watch mode (not configured - run build after changes)
```

### Project Initialization
```bash
# Initialize mintlify-tsdocs configuration
# Creates mintlify-tsdocs.config.json at project root with auto-detected settings
# Optionally initializes Mintlify (mint new) if not already set up
# Auto-adds "mint-ts" script to package.json
mint-ts init

# Use auto-detected defaults (no prompts)
mint-ts init --yes

# Skip Mintlify initialization
mint-ts init --skip-mintlify

# Initialize in a specific directory
mint-ts init --project-dir <directory>
```

### Documentation Generation
```bash
# Generate documentation (uses mintlify-tsdocs.config.json from project root)
# Auto-generates API Extractor and TSDoc configs in .tsdocs/ cache directory
mint-ts generate

# Skip running api-extractor (use existing .api.json files in .tsdocs/)
mint-ts generate --skip-extractor

# Recommended package.json script (auto-added by `mint-ts init`)
# "mint-ts": "mint-ts generate"
```

### Template Customization
```bash
# Initialize template directory for customization
mint-ts customize -t ./templates

# Overwrite existing templates
mint-ts customize -t ./templates --force
```

### Testing
```bash
# Run tests
bun test

# Update snapshots (after intentional output changes)
bun test -- -u
# or
bun jest --updateSnapshot
```

### Linting
```bash
# Run linter
bun run lint

# Fix lint issues automatically
bun run lint:fix
```

### Local Testing
To test local changes against a real project:
```bash
# Create global symlink
bun link

# Navigate to test project and run
mintlify-tsdocs markdown -i ./input -o ./output-test
```

## Architecture

### Core Flow
```
TypeScript → api-extractor → *.api.json → ApiModel → MarkdownDocumenter → MDX files + docs.json
```

1. **CLI Layer** (`src/cli/`)
   - `ApiDocumenterCommandLine.ts` - Main CLI parser
   - `InitAction.ts` - Handles `init` command for project setup (uses @clack/prompts)
   - `GenerateAction.ts` - Handles `generate` command (orchestrates api-extractor + docs generation)
   - `CustomizeAction.ts` - Handles `customize` command for template initialization
   - `BaseAction.ts` - Shared action base class

2. **Documentation Generation** (`src/documenters/`)
   - `MarkdownDocumenter.ts` - Main orchestrator
     - Loads API model from `*.api.json` files
     - Converts API items to template data
     - Renders templates to MDX files
     - Updates Mintlify navigation (`docs.json`)

3. **Template System** (`src/templates/`)
   - **LiquidJS-based** template engine with layout inheritance
   - `LiquidTemplateEngine.ts` - Liquid template renderer
   - `LiquidTemplateManager.ts` - Template resolution and override system
   - `TemplateDataConverter.ts` - Converts `ApiItem` → `ITemplateData`
   - `TemplateMerger.ts` - Merges user + default templates
   - Default templates in `src/templates/defaults/`

4. **Markdown Rendering** (`src/markdown/`)
   - `CustomMarkdownEmitter.ts` - Converts TSDoc nodes to Markdown/MDX
   - Handles custom nodes (tables, note boxes, expandables)
   - Special handling for Mintlify components (`<ParamField>`, `<ResponseField>`)

5. **Navigation Management** (`src/navigation/`)
   - `NavigationManager.ts` - Updates `docs.json` with generated pages
   - Supports tabs, groups, and menu configuration

6. **Performance & Caching** (`src/cache/`)
   - `CacheManager.ts` - Centralized cache coordinator
   - `TypeAnalysisCache.ts` - Caches type structure analysis (LRU)
   - `ApiResolutionCache.ts` - Caches API reference resolution (LRU)
   - Use `CacheManager.createProduction()` for production builds

7. **Utilities** (`src/utils/`)
   - `ObjectTypeAnalyzer.ts` - Parses complex TypeScript types
   - `DocumentationHelper.ts` - TSDoc extraction helpers
   - `SecurityUtils.ts` - Input sanitization
   - `Utilities.ts` - General utilities

8. **Custom Nodes** (`src/nodes/`)
   - Extended TSDoc nodes for documentation features
   - `DocTable`, `DocHeading`, `DocNoteBox`, `DocExpandable`, etc.

### Template System Details

**Template Variables Structure:**
```typescript
{
  apiItem: { name, kind, displayName, description },
  page: { title, description, icon, breadcrumb },

  // Semantic variables (direct access - NOT tables.*)
  constructors: Array<ITableRow>,
  properties: Array<ITableRow>,
  methods: Array<ITableRow>,
  parameters: Array<ITableRow>,
  returnType: { type, description },
  members: Array<ITableRow>,      // Enum members
  classes: Array<ITableRow>,      // Namespace items
  interfaces: Array<ITableRow>,
  functions: Array<ITableRow>,

  examples: Array<string>,
  heritageTypes: Array<{ name, path }>
}
```

**Template Inheritance:**
```liquid
{% layout "layout" %}

{% block content %}
# {{ apiItem.displayName }}
{{ apiItem.description }}
{% endblock %}
```

**Template Priority:**
1. Individual overrides (`overrides/class.liquid`)
2. Merged user templates (`temp/class.liquid`)
3. Default templates (`src/templates/defaults/class.liquid`)

## Key Patterns

### API Item Processing
The main flow in `MarkdownDocumenter.ts`:
1. Load API model from `*.api.json` files
2. Get all packages from model
3. For each package/entry point:
   - Convert to template data via `TemplateDataConverter`
   - Render template via `LiquidTemplateManager`
   - Write MDX file with frontmatter
4. Update `docs.json` navigation

### Type Analysis Caching
When analyzing complex types:
```typescript
const cacheManager = getGlobalCacheManager();
const cached = cacheManager.typeAnalysis.get(typeString);
if (cached) return cached;

const result = analyzeType(typeString);
cacheManager.typeAnalysis.set(typeString, result);
```

### Error Handling
- Use `DocumentationError` with specific `ErrorCode`
- `ErrorBoundary` wraps risky operations
- Validation happens early (file paths, options)

### Security
- All user input sanitized via `SecurityUtils`
- Template data sanitization in `LiquidTemplateEngine`
- Path traversal protection in file operations
- Prototype pollution protection in template overrides

## Important Conventions

### Template Development
- Use semantic variables (`properties`, not `tables.properties`)
- Always provide `{% layout "layout" %}` for consistency
- Use blocks (`{% block content %}`) for extensibility
- Check for existence: `{% if properties and properties.size > 0 %}`

### Code Style
- Strict TypeScript enabled
- Prefer explicit types over inference
- Document public APIs with JSDoc
- Use conventional commits for commit messages

### Testing
- Snapshot tests for MDX output in `src/markdown/test/`
- Manually verify MDX renders in Mintlify after changes
- Update snapshots only after intentional changes

### Performance
- Use caching for expensive operations
- Enable statistics in development: `CacheManager.createDevelopment({ enableStats: true })`
- Monitor cache hit rates for optimization opportunities

## File Organization

```
src/
├── cli/              # Command-line interface
│   ├── InitAction.ts          # Complete project setup (Mintlify + API Extractor)
│   └── GenerateAction.ts      # Documentation generation
├── documenters/      # Main documentation generators
├── markdown/         # Markdown/MDX emission
├── templates/        # Template system (Liquid)
│   └── defaults/     # Bundled templates (copied to lib/)
├── navigation/       # docs.json management
├── cache/            # Performance caching
├── utils/            # Shared utilities
├── nodes/            # Custom TSDoc nodes
├── errors/           # Error handling
└── performance/      # Performance monitoring

# Project structure after running `mint-ts init`:
project-root/
├── mintlify-tsdocs.config.json  # Main configuration file
├── package.json
└── docs/
    ├── docs.json                # Mintlify navigation
    └── .tsdocs/                 # Cache directory (gitignored)
        ├── api-extractor.json   # Auto-generated from config
        ├── tsdoc.json           # Auto-generated from config
        ├── *.api.json           # Generated by API Extractor
        ├── tsdoc-metadata.json  # Generated by API Extractor
        └── README.md            # Explains cache directory
```

## Build Output

- **`lib/`** - Compiled JavaScript + declarations
- **`lib/schemas/`** - JSON schemas (copied from `src/schemas/`)
- **`lib/components/`** - React components (copied from `src/components/`)
- **`lib/templates/defaults/`** - Default templates (copied from `src/templates/defaults/`)

## Dependencies

### Key External Dependencies
- `@microsoft/api-extractor-model` - API model parsing
- `@microsoft/tsdoc` - TSDoc parsing
- `liquidjs` - Template engine
- `@rushstack/ts-command-line` - CLI framework

### Development Tools
- TypeScript compiler for builds
- Jest for testing
- Bun for package management

## Common Tasks

### Setting Up a New Project
1. Run `mint-ts init` in the project directory
   - Auto-detects TypeScript entry point from package.json or common paths
   - Optionally initializes Mintlify (via `mint new`) if needed
   - Creates `mintlify-tsdocs.config.json` at project root
   - Creates `.tsdocs/` cache directory (gitignored)
2. Follow the interactive prompts (or use `--yes` for auto-detected defaults):
   - TypeScript entry point (.d.ts file)
   - Documentation output folder
   - Mintlify navigation settings (tab name, group name)
3. Build your TypeScript project: `bun run build`
4. Generate documentation: `mint-ts generate`
   - Config is automatically loaded from `mintlify-tsdocs.config.json`
   - API Extractor and TSDoc configs are auto-generated in `.tsdocs/`

### Configuration File (mintlify-tsdocs.config.json)

The config file supports cosmiconfig search locations:
- `mintlify-tsdocs.config.json`
- `.mintlify-tsdocsrc` / `.mintlify-tsdocsrc.json`
- `mintlifyTsdocs` field in `package.json`

**Minimal example:**
```json
{
  "$schema": "./node_modules/mintlify-tsdocs/lib/schemas/config.schema.json",
  "entryPoint": "./lib/index.d.ts",
  "outputFolder": "./docs/reference"
}
```

**Full example with all options:**
```json
{
  "$schema": "./node_modules/mintlify-tsdocs/lib/schemas/config.schema.json",
  "entryPoint": "./lib/index.d.ts",
  "outputFolder": "./docs/reference",
  "docsJson": "./docs/docs.json",
  "tabName": "API Reference",
  "groupName": "API",
  "convertReadme": false,
  "readmeTitle": "README",
  "templates": {
    "userTemplateDir": "./templates",
    "cache": true,
    "strict": true
  },
  "tsdoc": {
    "extends": ["@microsoft/api-extractor/extends/tsdoc-base.json"]
  },
  "apiExtractor": {
    "bundledPackages": [],
    "docModel": {
      "projectFolderUrl": "https://github.com/user/repo/tree/main"
    }
  }
}
```

**Auto-detection:**
- `entryPoint` - Auto-detected from package.json `types`/`typings` field or common paths
- `docsJson` - Auto-detected by searching for docs.json in common locations
- `outputFolder` - Defaults to `./docs/reference`

### Adding a New Template Variable
1. Update `ITemplateData` in `src/templates/TemplateEngine.ts`
2. Add conversion logic in `src/templates/TemplateDataConverter.ts`
3. Update template files to use new variable
4. Update tests and snapshots

### Adding Support for New API Item Type
1. Add template mapping in `src/templates/TemplateManager.ts`
2. Create template file in `src/templates/defaults/`
3. Add conversion logic in `TemplateDataConverter`
4. Add tests for new item type

### Customizing MDX Output
1. Modify `CustomMarkdownEmitter.ts` for structural changes
2. Modify templates in `src/templates/defaults/` for content changes
3. Run `bun run build` to copy templates to `lib/`
4. Test with `bun run docs:verbose`

## Known Issues

### Template System
- Temp directories from `TemplateMerger` not cleaned up (disk space leak)
- No template validation before render (errors only at runtime)
- Sanitization overhead even for trusted API Extractor data

### Cache System
- `ApiResolutionCache` uses slow `JSON.stringify()` for keys
- No TTL or auto-invalidation (manual clear required)

### General
- Watch mode not configured (manual rebuild required)
- No hot reload for template development
