# Schemas Module

**JSON Schema definitions for mintlify-tsdocs configuration**

## Overview

The schemas module contains JSON Schema definitions for mintlify-tsdocs configuration files. These schemas enable IDE autocomplete and validation for the `mintlify-tsdocs.config.json` configuration file created by `mint-ts init`.

## Files

### `config.schema.json`

Unified JSON Schema definition for mintlify-tsdocs configuration.

**Purpose:** Provides IDE autocomplete and validation for `mintlify-tsdocs.config.json` at the project root.

**Key Configuration Options:**

| Property | Type | Description |
|----------|------|-------------|
| `$schema` | string | JSON Schema URL for validation |
| `entryPoint` | string | Path to TypeScript entry point (.d.ts file) - auto-detected if not specified |
| `outputFolder` | string | Directory where MDX files will be generated (default: `./docs/reference`) |
| `docsJson` | string | Path to Mintlify's docs.json for navigation - auto-detected if not specified |
| `tabName` | string | Tab name in Mintlify navigation (default: "API Reference") |
| `groupName` | string | Group name within the tab (default: "API") |
| `convertReadme` | boolean | Convert README.md to index.mdx (default: false) |
| `readmeTitle` | string | Custom title for README page (default: "README") |
| `templates` | object | Template customization options |
| `tsdoc` | object | TSDoc configuration (written to .tsdocs/tsdoc.json) |
| `apiExtractor` | object | API Extractor configuration (written to .tsdocs/api-extractor.json) |

**Usage in IDE:**

```json
{
  "$schema": "./node_modules/mintlify-tsdocs/lib/schemas/config.schema.json",
  "entryPoint": "./lib/index.d.ts",
  "outputFolder": "./docs/reference",
  "docsJson": "./docs/docs.json",
  "tabName": "API Reference",
  "groupName": "API"
}
```

---

## Usage

### Project Setup

The configuration file is automatically created by running:

```bash
mint-ts init
```

This creates `mintlify-tsdocs.config.json` at the project root with auto-detected settings.

### Manual Configuration

If you need to manually create or modify the configuration:

1. **Create the file:**
```bash
touch mintlify-tsdocs.config.json
```

2. **Add configuration:**
```json
{
  "$schema": "./node_modules/mintlify-tsdocs/lib/schemas/config.schema.json",
  "entryPoint": "./lib/index.d.ts",
  "outputFolder": "./docs/reference",
  "docsJson": "./docs/docs.json",
  "tabName": "API Reference",
  "groupName": "API"
}
```

3. **Generate documentation:**
```bash
mint-ts generate
```

The configuration is automatically loaded from `mintlify-tsdocs.config.json` using cosmiconfig.

## Auto-Detection

mintlify-tsdocs can auto-detect many settings:

- **Entry point:** Checks `package.json` `types`/`typings` field, then common paths (`./lib/index.d.ts`, `./dist/index.d.ts`, etc.)
- **docs.json location:** Searches `./docs.json`, `./docs/docs.json`, `./documentation/docs.json`
- **Output folder:** Defaults to `./docs/reference`

## Schema Validation

The schemas are copied to `lib/schemas/` during build:

```json
{
  "scripts": {
    "build": "tsc && cp -r src/schemas lib/"
  }
}
```

## Adding New Configuration Options

To add a new configuration option:

1. **Update schema** (`mintlify-tsdocs.schema.json`):
```json
{
  "properties": {
    "myNewOption": {
      "description": "Description of the new option",
      "type": "string"
    }
  }
}
```

2. **Update template** (`mintlify-tsdocs-template.json`):
```jsonc
{
  /**
   * Description of the new option
   * Example: "value"
   */
  // "myNewOption": "default-value"
}
```

3. **Update GenerateAction** to load the option:
```typescript
private _loadConfigDefaults(): {
  // ... existing options
  myNewOption?: string;
} {
  const config = JSON.parse(FileSystem.readFile(configPath));
  return {
    // ... existing options
    myNewOption: config.myNewOption
  };
}
```

4. **Use in MarkdownDocumenter**:
```typescript
const markdownDocumenter = new MarkdownDocumenter({
  // ... existing options
  myNewOption: this._myNewOptionParameter.value || configDefaults.myNewOption
});
```

## Related Modules

- **`cli/InitAction.ts`** - Creates configuration files
- **`cli/GenerateAction.ts`** - Reads configuration files
- **`documenters/MarkdownDocumenter.ts`** - Uses configuration options

## References

- [JSON Schema Specification](https://json-schema.org/)
- [VS Code JSON Schema Support](https://code.visualstudio.com/docs/languages/json#_json-schemas-and-settings)
