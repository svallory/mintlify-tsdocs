# mint-tsdocs

Generate beautiful, Mintlify-native API documentation from your TypeScript code.

This tool automatically generates [Mintlify](https://mintlify.com/)-compatible MDX documentation for your TypeScript library. It uses [API Extractor](https://api-extractor.com/) to analyze your code and creates rich, interactive documentation with Mintlify components.

## Features

- **Mintlify-Native Components** - Uses `<ParamField>`, `<ResponseField>`, and `<Expandable>` for rich, interactive documentation
- **Automatic Navigation** - Updates your `docs.json` file automatically with proper tabs and groups
- **Complex Type Support** - Full support for nested objects, unions, intersections, and generics
- **Smart Auto-Detection** - Finds your TypeScript entry point, Mintlify config, and output folder automatically
- **Zero Configuration** - Works out of the box with sensible defaults
- **Template Customization** - Fully customizable Liquid templates for complete control over output

## Quick Start

```bash
# Initialize and configure (auto-detects your TypeScript setup)
npx mint-tsdocs

# Build your TypeScript project to generate .d.ts files
bun run build  # or your build command

# Generate documentation
npx mint-tsdocs generate
```

That's it! Your API documentation is ready in the `docs/reference` folder.

## Installation

You can use mint-tsdocs without installing it:

```bash
npx mint-tsdocs
```

Or install it locally/globally:

```bash
# Local (recommended)
bun add -D mint-tsdocs
# or: npm install -D mint-tsdocs

# Global
bun add -g mint-tsdocs
# or: npm install -g mint-tsdocs
```

The package provides two command aliases:
- `mint-tsdocs` (short, recommended)
- `mintlify-tsdocs` (full name)

## Configuration

mint-tsdocs uses a single configuration file at the project root: `mint-tsdocs.config.json`

### Auto-Detection

The tool auto-detects:

- TypeScript entry point (from `package.json` `types`/`typings` field or common paths)
- Mintlify `docs.json` location
- Output folder

### Example Configuration

```json
{
  "$schema": "./node_modules/mint-tsdocs/lib/schemas/config.schema.json",
  "entryPoint": "./lib/index.d.ts",
  "outputFolder": "./docs/reference",
  "docsJson": "./docs/docs.json",
  "tabName": "API Reference",
  "groupName": "API"
}
```

See the [JSON Schema](./src/schemas/config.schema.json) for all available options.

## CLI Commands

### `mint-tsdocs` or `mint-tsdocs init`

Initialize a project with mint-tsdocs configuration. Auto-detects your TypeScript entry point, Mintlify docs folder, and creates `mint-tsdocs.config.json`.

**Options:**
- `--yes`, `-y` - Skip prompts and use auto-detected defaults
- `--skip-mintlify` - Skip Mintlify initialization (if already set up)
- `--project-dir <path>` - Project directory (default: current directory)

### `mint-tsdocs generate`

Generate documentation from TypeScript source. Automatically runs API Extractor and creates MDX files with Mintlify components.

**Options:**
- `--skip-extractor` - Skip API Extractor step (use cached `.api.json` files)
- `--verbose`, `-v` - Show detailed output
- `--debug` - Show debug output
- `--quiet`, `-q` - Suppress all output except errors

### `mint-tsdocs customize`

Copy default Liquid templates to a directory for customization.

**Options:**
- `-t, --template-dir <path>` - Directory where templates should be created
- `--force` - Overwrite existing templates

### `mint-tsdocs show`

Display current configuration or cache statistics.

**Options:**
- `config` - Show current configuration (default)
- `stats` - Show cache statistics and performance metrics

## Documentation

- **[Full Documentation](https://mint-tsdocs.saulo.engineer/)** - Complete guide with examples
- **[Quick Start](https://mint-tsdocs.saulo.engineer/quickstart)** - Get started in 2 minutes
- **[CLI Reference](https://mint-tsdocs.saulo.engineer/cli-reference)** - All commands and options
- **[Configuration](https://mint-tsdocs.saulo.engineer/config-reference)** - Configuration options
- **[API Reference](https://mint-tsdocs.saulo.engineer/reference)** - Generated API docs (dogfooding!)

## Requirements

- Node.js 18 or higher
- TypeScript project with `declaration: true` in `tsconfig.json`

## Built On

This project uses Microsoft's excellent [API Extractor](https://api-extractor.com/) and [TSDoc](https://tsdoc.org/) for TypeScript analysis, enhanced with Mintlify-specific features and components.

## Contributing

Contributions are welcome! Please check out the [Contributing Guide](./CONTRIBUTING.md) and [Architecture Documentation](./docs/architecture/overview.mdx).

## License

MIT - See [LICENSE](./LICENSE) file for details
